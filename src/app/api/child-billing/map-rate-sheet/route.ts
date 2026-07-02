import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

const db = prisma as any;
const enc = new TextEncoder();
function sse(data: object) { return enc.encode(`data: ${JSON.stringify(data)}\n\n`); }

function to24h(t: string | null): string {
  if (!t) return "";
  const m = t.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return t.trim();
  let h = parseInt(m[1], 10);
  const min = m[2], sec = m[3] ?? "00", ampm = m[4].toUpperCase();
  if (ampm === "AM") { if (h === 12) h = 0; }
  else               { if (h !== 12) h += 12; }
  return `${String(h).padStart(2, "0")}:${min}:${sec}`;
}

// POST /api/child-billing/map-rate-sheet
// Matches each ChildBillingRow to Rate Sheet using "Rate Card Key (FC28)" in rawData.
export async function POST(_req: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sse({ phase: "init", message: "Loading Rate Sheet data…" }));

        const latestRS = await db.rateSheetBatch.findFirst({ orderBy: { uploadedAt: "desc" } });
        if (!latestRS) {
          controller.enqueue(sse({ phase: "complete", message: "No Rate Sheet data found. Upload Rate Sheets first.", mapped: 0, unmapped: 0, total: 0 }));
          controller.close(); return;
        }

        const rateRows = await db.rateSheetRow.findMany({ where: { batchId: latestRS.id } });

        // Build rate map: rateCardKey → { itemName, itemValue }
        const rateMap = new Map<string, { itemName: string; itemValue: string }>();
        for (const r of rateRows) {
          const centerShort = (r.center ?? "").split(",")[0].trim();
          const key = [centerShort, r.versionName ?? "", to24h(r.dropOff), to24h(r.pickUp), r.program ?? "", r.itemName ?? ""].join("|");
          rateMap.set(key, { itemName: r.itemName ?? "", itemValue: r.itemValue ?? "" });
        }

        // Classroom mappings
        const classroomRows: { fc28Classroom: string; rateSheetItem: string | null }[] = await db.classroomMapping.findMany();
        const classroomMap = new Map<string, string>();
        for (const c of classroomRows) { if (c.rateSheetItem) classroomMap.set(c.fc28Classroom, c.rateSheetItem); }

        controller.enqueue(sse({ phase: "init", message: `Loaded ${rateMap.size} Rate Sheet entries — collecting child rate keys…` }));

        const batch = await db.childBillingBatch.findFirst({ orderBy: { createdAt: "desc" } });
        if (!batch) {
          controller.enqueue(sse({ phase: "error", message: "No child billing data. Run Aggregate first." }));
          controller.close(); return;
        }

        // Get distinct rate card keys from child billing rows
        const keyRows: { rateKey: string }[] = await prisma.$queryRawUnsafe(
          `SELECT DISTINCT "rawData"->>'Rate Card Key (FC28)' AS "rateKey" FROM "ChildBillingRow" WHERE "batchId"=$1 AND "rawData"->>'Rate Card Key (FC28)' IS NOT NULL AND "rawData"->>'Rate Card Key (FC28)' != ''`,
          batch.id
        );
        const rateKeys = keyRows.map((r) => r.rateKey).filter(Boolean);
        const total = rateKeys.length;

        if (total === 0) {
          controller.enqueue(sse({ phase: "complete", message: "No Rate Card Keys found. Run Map FC28 first.", mapped: 0, unmapped: 0, total: 0 }));
          controller.close(); return;
        }

        controller.enqueue(sse({ phase: "mapping", message: `Found ${total} unique Rate Card Keys — mapping…`, total, done: 0, mapped: 0, unmapped: 0, pct: 0 }));

        const BATCH_SIZE = 500;
        let mapped = 0, unmapped = 0, done = 0;

        for (let i = 0; i < rateKeys.length; i += BATCH_SIZE) {
          const chunk = rateKeys.slice(i, i + BATCH_SIZE);
          const valueParts: string[] = [];
          const params: any[] = [];
          let pi = 1;

          for (const rateCardKey of chunk) {
            let match = rateMap.get(rateCardKey);
            let mappedKey = rateCardKey;

            if (!match && classroomMap.size > 0) {
              const parts = rateCardKey.split("|");
              if (parts.length === 6) {
                const mappedClassroom = classroomMap.get(parts[5]);
                if (mappedClassroom) {
                  mappedKey = [...parts.slice(0, 5), mappedClassroom].join("|");
                  match = rateMap.get(mappedKey);
                }
              }
            }
            if (!match) { unmapped++; continue; }

            const patch: Record<string, string> = {
              "Item Name (Rate Sheet)":  match.itemName,
              "Item Value (Rate Sheet)": match.itemValue,
            };
            if (mappedKey !== rateCardKey) patch["Rate Card Key (FC28)"] = mappedKey;

            valueParts.push(`($${pi}::text, $${pi+1}::jsonb)`);
            params.push(rateCardKey, JSON.stringify(patch));
            pi += 2; mapped++;
          }

          if (valueParts.length > 0) {
            await prisma.$executeRawUnsafe(
              `UPDATE "ChildBillingRow" AS t SET "rawData"=t."rawData"||v.patch FROM (VALUES ${valueParts.join(",")}) AS v(rate_key,patch) WHERE t."batchId"=$${pi} AND t."rawData"->>'Rate Card Key (FC28)'=v.rate_key`,
              ...params, batch.id
            );
          }

          done = Math.min(i + chunk.length, total);
          controller.enqueue(sse({ phase: "mapping", done, total, mapped, unmapped, pct: Math.round((done/total)*100) }));
        }

        controller.enqueue(sse({ phase: "complete", done: total, total, mapped, unmapped, pct: 100, message: `Done — ${mapped} keys matched, ${unmapped} not in Rate Sheet` }));
      } catch (err: any) {
        controller.enqueue(sse({ phase: "error", message: err.message ?? "Mapping failed" }));
      } finally { controller.close(); }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" },
  });
}
