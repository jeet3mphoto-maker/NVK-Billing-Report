import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const db = prisma as any;
const enc = new TextEncoder();
function sse(data: object) { return enc.encode(`data: ${JSON.stringify(data)}\n\n`); }

// POST /api/child-billing/map-agencies
// For each ChildBillingRow, resolves "Agency 1 (FC28)" and "Agency 2 (FC28)" via:
//   1. AgencyNameMapping  → canonical agency name
//   2. AgencySetting      → matched by (name, contractPeriod)
// Writes resolved fields back into rawData.
export async function POST(_req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sse({ phase: "init", message: "Loading Agency Name Mappings…" }));

        // Build AgencyNameMapping lookup: fc28Name → canonicalName
        const nameMappings: { fc28AgencyName: string; agencySettingName: string | null }[] =
          await db.agencyNameMapping.findMany();
        const nameMap = new Map<string, string>();
        for (const m of nameMappings) {
          if (m.agencySettingName) nameMap.set(m.fc28AgencyName.trim().toLowerCase(), m.agencySettingName);
        }

        controller.enqueue(sse({ phase: "init", message: `Loaded ${nameMap.size} agency name mappings. Loading Agency Settings…` }));

        // Build AgencySetting lookup: `${name.lower}|${contractPeriod.lower}` → setting row
        const settings: { name: string | null; contractPeriod: string | null; center: string | null; active: string | null; type: string | null; useBlackoutDates: string | null; discountsPermitted: string | null }[] =
          await db.agencySetting.findMany();

        type SettingRow = typeof settings[0];
        // Multiple settings can share (name, contractPeriod) across centers — collect all, use first match or most common
        const settingMap = new Map<string, SettingRow>();
        for (const s of settings) {
          if (!s.name) continue;
          const key = `${s.name.trim().toLowerCase()}|${(s.contractPeriod ?? "").trim().toLowerCase()}`;
          if (!settingMap.has(key)) settingMap.set(key, s);
        }
        // Also index by name only (for when contractPeriod doesn't match)
        const settingByName = new Map<string, SettingRow>();
        for (const s of settings) {
          if (!s.name) continue;
          const key = s.name.trim().toLowerCase();
          if (!settingByName.has(key)) settingByName.set(key, s);
        }

        controller.enqueue(sse({ phase: "init", message: `Loaded ${settingMap.size} agency+period combinations. Processing rows…` }));

        const batch = await db.childBillingBatch.findFirst({ orderBy: { createdAt: "desc" } });
        if (!batch) {
          controller.enqueue(sse({ phase: "error", message: "No child billing data. Run Aggregate first." }));
          controller.close(); return;
        }

        const rows: { id: number; rawData: any }[] = await prisma.$queryRawUnsafe(
          `SELECT id, "rawData" FROM "ChildBillingRow" WHERE "batchId" = $1`, batch.id
        );

        const total = rows.length;
        controller.enqueue(sse({ phase: "mapping", message: `Mapping ${total} rows…`, total, done: 0, pct: 0 }));

        const BATCH = 500;
        let matched1 = 0, matched2 = 0, done = 0;

        function resolveAgency(fc28Name: string | null, contractPeriod: string | null): Record<string, string> {
          if (!fc28Name?.trim()) return {};
          const canonical = nameMap.get(fc28Name.trim().toLowerCase()) ?? null;
          if (!canonical) return { "Revised Agency Name": fc28Name };

          const cpKey  = `${canonical.trim().toLowerCase()}|${(contractPeriod ?? "").trim().toLowerCase()}`;
          const setting = settingMap.get(cpKey) ?? settingByName.get(canonical.trim().toLowerCase()) ?? null;

          return {
            "Revised Agency Name":    canonical,
            "Agency Name (Agency)":   setting?.name               ?? canonical,
            "Contract Period (Agency)": setting?.contractPeriod   ?? contractPeriod ?? "",
            "Agency Type (Agency)":   setting?.type               ?? "",
            "Agency Active":          setting?.active             ?? "",
            "Use Blackout Dates":     setting?.useBlackoutDates   ?? "",
            "Discounts Permitted":    setting?.discountsPermitted ?? "",
          };
        }

        for (let i = 0; i < rows.length; i += BATCH) {
          const chunk = rows.slice(i, i + BATCH);
          const valueParts: string[] = [];
          const params: any[] = [];
          let pi = 1;

          for (const row of chunk) {
            const rd = row.rawData as Record<string, any>;

            const agency1 = rd["Agency 1 (FC28)"] ?? null;
            const cp1     = rd["Contract Period 1 (FC28)"] ?? null;
            const agency2 = rd["Agency 2 (FC28)"] ?? null;
            const cp2     = rd["Contract Period 2 (FC28)"] ?? null;

            const r1 = resolveAgency(agency1, cp1);
            const r2 = resolveAgency(agency2, cp2);

            const patch: Record<string, string> = {};
            for (const [k, v] of Object.entries(r1)) patch[`Agency 1 - ${k}`] = v;
            for (const [k, v] of Object.entries(r2)) patch[`Agency 2 - ${k}`] = v;

            if (Object.keys(r1).length > 0) matched1++;
            if (Object.keys(r2).length > 0) matched2++;

            // Concat canonical agency names (ignore blank)
            const ag1Name = r1["Agency Name (Agency)"] ?? r1["Revised Agency Name"] ?? "";
            const ag2Name = r2["Agency Name (Agency)"] ?? r2["Revised Agency Name"] ?? "";
            const agencyName = [ag1Name, ag2Name].filter(Boolean).join(", ");
            if (agencyName) patch["Agency Name"] = agencyName;

            // Sum Estimated Contract Amount 1 + 2
            const toNum = (v: any) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; };
            const ca1 = toNum(rd["Estimated Contract Amount 1 (FC28)"]);
            const ca2 = toNum(rd["Estimated Contract Amount 2 (FC28)"]);
            const totalCA = Math.round((ca1 + ca2) * 100) / 100;
            if (totalCA) patch["Estimated Contract Amount"] = String(totalCA);

            valueParts.push(`($${pi}::int, $${pi + 1}::jsonb)`);
            params.push(row.id, JSON.stringify(patch));
            pi += 2;
          }

          if (valueParts.length > 0) {
            await prisma.$executeRawUnsafe(
              `UPDATE "ChildBillingRow" AS t
               SET "rawData" = t."rawData" || v.patch
               FROM (VALUES ${valueParts.join(",")}) AS v(id, patch)
               WHERE t.id = v.id`,
              ...params
            );
          }

          done = Math.min(i + chunk.length, total);
          controller.enqueue(sse({ phase: "mapping", done, total, pct: Math.round((done / total) * 100), message: `${done}/${total} rows processed` }));
        }

        controller.enqueue(sse({
          phase: "complete",
          done: total, total, pct: 100,
          message: `Done — Agency 1 resolved for ${matched1} rows, Agency 2 resolved for ${matched2} rows`,
        }));
      } catch (err: any) {
        controller.enqueue(sse({ phase: "error", message: err.message ?? "Mapping failed" }));
      } finally { controller.close(); }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
