import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string | null;

    if (!file || !type) {
      return NextResponse.json({ success: false, message: "Missing file or type" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // FIN02 has a center-address line in row 1 and real column headers in row 2.
    // We capture the center name from row 1 then re-parse from row 2 onward.
    let rows: Record<string, any>[];
    let fin02CenterName: string | null = null;
    if (type === "FIN02") {
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
      fin02CenterName = extractFin02CenterName(String(raw[0]?.[0] ?? ""));
      rows = XLSX.utils.sheet_to_json(ws, { range: 1, defval: null }) as Record<string, any>[];
    } else {
      rows = XLSX.utils.sheet_to_json(ws, { defval: null }) as Record<string, any>[];
    }

    // For FIN14 files: remove repeated header rows (rows where the cell values
    // match the column header names — these appear when multiple center exports
    // are concatenated and each file's header row ends up in the data).
    if (type === "FIN14_AR" || type === "FIN14") {
      const headerKeys = rows.length > 0 ? Object.keys(rows[0]) : [];
      rows = rows.filter((row) => {
        // A row is a repeated header if any key matches its own value exactly
        const isHeader = headerKeys.some(
          (k) => String(row[k] ?? "").trim() === k.trim()
        );
        // Also remove completely blank rows
        const isEmpty = headerKeys.every((k) => row[k] === null || row[k] === undefined || String(row[k]).trim() === "");
        return !isHeader && !isEmpty;
      });
    }

    const upload = await prisma.fileUpload.create({
      data: {
        fileName: file.name,
        fileType: type as any,
        fileSize: file.size,
        status: "PROCESSING",
        recordsTotal: rows.length,
        snapshotDate: new Date(),
      },
    });

    let processed = 0;
    let rejected = 0;
    const errors: string[] = [];

    if (type === "FC28") {
      const result = await processFC28(rows, upload.id);
      processed = result.processed;
      rejected = result.rejected;
      errors.push(...result.errors);
    } else if (type === "FIN14_AR") {
      const result = await processFIN14AR(rows, upload.id, file.name);
      processed = result.processed;
      rejected = result.rejected;
    } else if (type === "FIN14") {
      const result = await processFIN14AR(rows, upload.id, file.name);
      processed = result.processed;
      rejected = result.rejected;
    } else if (type === "FIN02") {
      const result = await processFIN02(rows, upload.id, fin02CenterName);
      processed = result.processed;
      rejected = result.rejected;
      errors.push(...result.errors);
    }

    await prisma.fileUpload.update({
      where: { id: upload.id },
      data: {
        status: rejected > 0 && processed === 0 ? "FAILED" : rejected > 0 ? "PARTIAL" : "COMPLETED",
        recordsProcessed: processed,
        recordsRejected: rejected,
        processedAt: new Date(),
        errorLog: errors.length ? errors : undefined,
      },
    });

    return NextResponse.json({ success: true, records: processed, errors: rejected, message: "Processed successfully" });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message ?? "Internal error" }, { status: 500 });
  }
}

// ── Parsing helpers for the real ASA export formats ─────────────────────────
/** Parse currency text like "$1,181.25", "-$1,181.25", "($45.00)" → number. */
function parseMoney(val: any): number {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  let s = String(val).trim();
  if (!s) return 0;
  const negative = s.startsWith("-") || /^\(.*\)$/.test(s); // accounting-style ( ) = negative
  s = s.replace(/[(),$\s%]/g, "").replace(/-/g, "");
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return negative ? -n : n;
}

/** Parse a date from a Date object or strings like "05/01/2026" (MM/DD/YYYY). */
function parseDate(val: any): Date | null {
  if (val === null || val === undefined || val === "") return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const s = String(val).trim();
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const dt = new Date(s);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Split "Last, First" or "First Last" into name parts. */
function parseName(raw: any): { firstName: string; lastName: string; fullName: string } {
  const full = String(raw ?? "").trim();
  if (!full) return { firstName: "", lastName: "", fullName: "" };
  if (full.includes(",")) {
    const [last, ...firstParts] = full.split(",");
    const first = firstParts.join(",").trim();
    const fullName = `${first} ${last.trim()}`.trim();
    return { firstName: first, lastName: last.trim(), fullName };
  }
  const [first, ...rest] = full.split(" ");
  return { firstName: first, lastName: rest.join(" "), fullName: full };
}

/** Normalize a rate period to Month/Day/Week, or null for N/A/blank. */
function cleanPeriod(val: any): string | null {
  const s = String(val ?? "").trim();
  if (!s || s.toUpperCase() === "N/A") return null;
  const l = s.toLowerCase();
  if (l.startsWith("month")) return "Month";
  if (l.startsWith("day")) return "Day";
  if (l.startsWith("week")) return "Week";
  return s;
}

/** Parse a Yes/No cell to boolean, or null when blank/N/A. */
function yesNo(val: any): boolean | null {
  const s = String(val ?? "").trim().toLowerCase();
  if (!s || s === "n/a") return null;
  return s === "yes" || s === "y" || s === "true" || s === "x";
}

async function processFC28(rows: Record<string, any>[], uploadId: string) {
  let processed = 0, rejected = 0;
  const errors: string[] = [];
  const snapshotDate = new Date();
  
  // Create FC28 snapshot record first so we have the ID for change logs
  const currentSnapshotDate = new Date(snapshotDate.toDateString());
  const fC28Snapshot = await prisma.fC28Snapshot.upsert({
    where: { snapshotDate: currentSnapshotDate },
    create: {
      snapshotDate: currentSnapshotDate,
      uploadId,
      recordCount: 0,
      fileName: uploadId,
    },
    update: {},
  });

  const processedChildIds = new Set<string>();

  for (const row of rows) {
    try {
      const childId = String(row["Child ID"] ?? row["ChildID"] ?? row["child_id"] ?? "").trim();
      const familyId = String(row["Family ID"] ?? row["FamilyID"] ?? row["family_id"] ?? "").trim();
      if (!childId || !familyId) { rejected++; continue; }

      const { firstName, lastName, fullName } = parseName(
        row["Child Name"] ?? row["ChildName"] ?? `${row["First Name"] ?? ""} ${row["Last Name"] ?? ""}`
      );
      const centerName = String(row["Center"] ?? row["Clean Center name"] ?? row["CenterName"] ?? "").trim();
      if (!centerName) { rejected++; continue; }
      const programCode = String(row["Program"] ?? row["ProgramCode"] ?? "").trim();
      // Real export uses "Child Status"; keep "Status" as a fallback for other layouts.
      const status = String(row["Child Status"] ?? row["Status"] ?? "Active").trim();
      // The real FC28 export has no weekly "Rate"; "Estimated Contract Amount" is the
      // expected-revenue figure. Capture whichever is present.
      const rate = parseMoney(row["Rate"] ?? row["Weekly Rate"] ?? row["Estimated Contract Amount"] ?? 0);
      const startDate = parseDate(row["Start Date"] ?? row["Enroll Date"]) ?? new Date();
      const endDate = parseDate(row["End Date"] ?? row["Withdrawal Date"]);
      const entity = String(row["Entity"] ?? "").trim() || null;
      const state = String(row["State.1"] ?? row["State"] ?? "").trim() || null;

      // Upsert center (carry Entity/State when present so dashboards can filter).
      let center = await prisma.center.findFirst({ where: { name: centerName } });
      if (!center) {
        center = await prisma.center.create({
          data: {
            centerId: centerName.replace(/[^a-z0-9]/gi, "_").toUpperCase(),
            name: centerName, isActive: true,
            entity, state,
          },
        });
      } else if ((entity && !center.entity) || (state && !center.state)) {
        center = await prisma.center.update({
          where: { id: center.id },
          data: { entity: center.entity ?? entity, state: center.state ?? state },
        });
      }

      // Upsert family
      let family = await prisma.family.upsert({
        where: { familyId },
        create: { familyId, name: fullName },
        update: {},
      });

      // Upsert child
      let child = await prisma.child.upsert({
        where: { childId },
        create: {
          childId, firstName: firstName || fullName, lastName: lastName || "", fullName,
          familyId: family.id,
          centerId: center.id,
        },
        update: { fullName, centerId: center.id },
      });

      processedChildIds.add(child.id);

      // Get the existing latest enrollment to compare
      const previousEnrollment = await prisma.enrollment.findFirst({
        where: { childId: child.id, isLatest: true },
      });

      // Mark previous snapshots as not latest
      if (previousEnrollment) {
        await prisma.enrollment.update({
          where: { id: previousEnrollment.id },
          data: { isLatest: false },
        });
      }

      const classroom = String(row["Classroom"] ?? "").trim() || null;
      const cleanClassroom = String(row["Clean Classroom"] ?? "").trim() || null;
      // Real export calls the billing frequency "Billing Cycle" (Monthly/Semi-Monthly).
      const billingCycle = String(row["Billing Cycle"] ?? row["Rate Type"] ?? "").trim() || null;
      // "Program" doubles as the schedule descriptor ("Full Time 5 Days") in the real export.
      const schedule = String(row["Schedule"] ?? row["Program"] ?? "").trim() || null;
      const agencyRaw = String(row["Agency"] ?? row["Agency Name"] ?? row["Subsidy"] ?? "").trim();
      const agencyName = agencyRaw && agencyRaw.toUpperCase() !== "N/A" ? agencyRaw : null;

      // Create enrollment snapshot with the full FC28 detail the engine needs.
      await prisma.enrollment.create({
        data: {
          childId: child.id,
          familyId: family.id,
          centerId: center.id,
          programCode: programCode || null,
          classroom,
          cleanClassroom,
          startDate,
          endDate,
          status,
          familyStatus: String(row["Family Status"] ?? "").trim() || null,
          rate: rate || null,
          rateType: billingCycle,
          schedule,
          subsidyInfo: agencyName,
          agencyName,
          familyContribution: parseMoney(row["Family Contribution"]) || null,
          estimatedContractAmount: parseMoney(row["Estimated Contract Amount"]) || null,
          contractPeriod: cleanPeriod(row["Contract Period"]),
          estimatedCopayAmount: parseMoney(row["Estimated Copay Amount"]) || null,
          copayPeriod: cleanPeriod(row["Copay Period"]),
          billingCycle,
          rateCardVersion: String(row["Rate Card Version"] ?? row["Rate Sheet"] ?? "").trim() || null,
          dropOff: String(row["Drop Off"] ?? "").trim() || null,
          pickup: String(row["Pickup"] ?? row["Late Pickup"] ?? "").trim() || null,
          earlyAMCare: yesNo(row["Early AM Care"]),
          latePMCare: yesNo(row["Late PM Care"]),
          dateOfBirth: parseDate(row["Date of Birth"]),
          enrollDate: parseDate(row["Enroll Date"]),
          withdrawalDate: parseDate(row["Withdrawal Date"]),
          withdrawalReason: String(row["Withdrawal Reason"] ?? "").trim() || null,
          primaryGuardian: String(row["Primary Guardian Name"] ?? "").trim() || null,
          snapshotDate,
          isLatest: true,
          rawData: row,
        },
      });

      // --- Change Detection Engine ---
      if (!previousEnrollment) {
        await prisma.fC28ChangeLog.create({
          data: {
            snapshotId: fC28Snapshot.id,
            childId: child.id,
            fieldName: "Child",
            newValue: "New Child",
            changeType: "NEW_CHILD",
            snapshotDate: currentSnapshotDate,
          }
        });
      } else {
        const changes = [];
        
        if (previousEnrollment.rate?.toNumber() !== rate && (previousEnrollment.rate !== null || rate !== 0)) {
           changes.push({ field: "Rate", old: previousEnrollment.rate?.toString() || "0", new: rate.toString() });
        }
        if (previousEnrollment.status !== status) {
           changes.push({ field: "Status", old: previousEnrollment.status, new: status });
        }
        if (previousEnrollment.programCode !== programCode && (previousEnrollment.programCode || programCode)) {
           changes.push({ field: "Program", old: previousEnrollment.programCode || "", new: programCode });
        }
        if (previousEnrollment.schedule !== schedule && (previousEnrollment.schedule || schedule)) {
           changes.push({ field: "Schedule", old: previousEnrollment.schedule || "", new: schedule });
        }
        if (previousEnrollment.classroom !== classroom && (previousEnrollment.classroom || classroom)) {
           changes.push({ field: "Classroom", old: previousEnrollment.classroom || "", new: classroom });
        }
        
        if (previousEnrollment.startDate.getTime() !== startDate.getTime()) {
           changes.push({ field: "Start Date", old: previousEnrollment.startDate.toISOString().split('T')[0], new: startDate.toISOString().split('T')[0] });
        }
        
        const oldEnd = previousEnrollment.endDate ? previousEnrollment.endDate.getTime() : null;
        const newEnd = endDate ? endDate.getTime() : null;
        if (oldEnd !== newEnd) {
           changes.push({ field: "End Date", old: previousEnrollment.endDate?.toISOString().split('T')[0] || "", new: endDate?.toISOString().split('T')[0] || "" });
        }

        if (changes.length > 0) {
          await prisma.fC28ChangeLog.createMany({
            data: changes.map(c => ({
              snapshotId: fC28Snapshot.id,
              childId: child.id,
              fieldName: c.field,
              oldValue: c.old,
              newValue: c.new,
              changeType: "FIELD_CHANGED",
              snapshotDate: currentSnapshotDate,
            }))
          });
        }
      }

      processed++;
    } catch (e: any) {
      rejected++;
      errors.push(e.message);
    }
  }

  // Find removed children (children who were latest but not in this upload)
  if (processed > 0) {
    const missingChildren = await prisma.enrollment.findMany({
      where: {
        isLatest: true,
        childId: { notIn: Array.from(processedChildIds) },
      },
      select: { childId: true }
    });

    if (missingChildren.length > 0) {
      await prisma.fC28ChangeLog.createMany({
        data: missingChildren.map(mc => ({
          snapshotId: fC28Snapshot.id,
          childId: mc.childId,
          fieldName: "Child",
          oldValue: "Active",
          newValue: "Removed",
          changeType: "REMOVED_CHILD",
          snapshotDate: currentSnapshotDate,
        }))
      });
      
      await prisma.enrollment.updateMany({
         where: { isLatest: true, childId: { notIn: Array.from(processedChildIds) } },
         data: { isLatest: false } // Optionally update status as well
      });
    }
  }

  // Update snapshot count
  await prisma.fC28Snapshot.update({
    where: { id: fC28Snapshot.id },
    data: { recordCount: processed },
  });

  return { processed, rejected, errors };
}

/**
 * Classify a FIN14 ledger line by its "Item" text into the Major/Sub Head
 * buckets used in the May report's FINAR_Raw analysis.
 *   Sub Head ∈ Regular | Agency | Discount | Early-Late | One Time | Other | Adjustments
 */
function categorizeItem(item: string, isPayment: boolean): { majorHead: string; subHead: string } {
  const t = (item || "").toLowerCase();
  if (isPayment) return { majorHead: "Payment", subHead: "Payment" };
  if (/adjust|write.?off|reclass|correction/.test(t)) return { majorHead: "Adjustments", subHead: "Adjustments" };
  if (/discount|scholarship|sibling|waiver/.test(t)) return { majorHead: "Billing", subHead: "Discount" };
  if (/agency|copay|co-pay|contribution|subsidy|voucher|circuit|ccap|\bdes\b|\bacs\b|\bdoe\b/.test(t))
    return { majorHead: "Billing", subHead: "Agency" };
  if (/early|late|am care|pm care|before care|after care|extended/.test(t))
    return { majorHead: "Billing", subHead: "Early-Late" };
  if (/registration|enrollment fee|activity|supply|material|one.?time|annual|deposit|late fee|nsf|field trip|summer/.test(t))
    return { majorHead: "Billing", subHead: "One Time" };
  if (/regular tuition|tuition|program fee/.test(t)) return { majorHead: "Billing", subHead: "Regular" };
  return { majorHead: "Billing", subHead: "Other" };
}

/**
 * Extract the center name from the FIN02 header line.
 * "Hudson Yards 417 West 35th Street New York, NY 10001 (646) 863-4369"
 * → "Hudson Yards"
 */
function extractFin02CenterName(header: string): string {
  const match = header.match(/^([A-Za-z\s&'-]+?)(?=\s*\d)/);
  return match ? match[1].trim() : header.split(" ").slice(0, 3).join(" ").trim();
}

/**
 * Normalize a "Last, First" or "First Last" child name to lowercase "first last"
 * for name-based matching between FIN02 and FC28.
 */
function normalizeChildName(name: string): string {
  if (!name) return "";
  const s = name.trim();
  if (s.includes(",")) {
    const [last, ...rest] = s.split(",");
    return `${rest.join(",").trim()} ${last.trim()}`.toLowerCase().replace(/\s+/g, " ").trim();
  }
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Categorize a FIN02 Item description into the same buckets used in FIN14.
 * "NYC - DOE - UPK" → "Agency"
 * "Standard Discount - …" → "Discount"
 * "Full Time 5 Days - Twaddler" → "Regular"
 * "Late PM Care …" / "After School Care …" → "Early-Late"
 */
function categorizeFin02Item(item: string): string {
  const t = (item ?? "").toLowerCase();
  if (/discount|scholarship|sibling|waiver/.test(t)) return "Discount";
  if (/doe|acs|circuit|ccap|agency|copay|subsidy|voucher|\bdes\b/.test(t)) return "Agency";
  if (/late pm|early am|am care|pm care|after school|extended|before care|after care/.test(t)) return "Early-Late";
  if (/registration|enrollment fee|activity|supply|one.?time|annual|deposit|nsf|field trip/.test(t)) return "One Time";
  return "Regular";
}

async function processFIN02(
  rows: Record<string, any>[],
  uploadId: string,
  centerName: string | null
) {
  // Idempotency: re-uploading replaces prior records for this upload.
  await prisma.fin02Rate.deleteMany({ where: { uploadId } });

  let processed = 0, rejected = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const cycle   = String(row["Cycle"]      ?? "").trim();
      const item    = String(row["Item"]        ?? "").trim();
      const child   = String(row["Child"]       ?? "").trim();
      const payer   = String(row["Payer"]       ?? "").trim();
      const amtRaw  = row["Amount"];
      const rateSheet = String(row["Rate Sheet"] ?? "").trim() || null;

      // Skip family-group header rows (only first column non-empty)
      if (!item && !child && !payer) continue;

      // Skip "Total Monthly:" / "Totally Monthly:" summary rows
      if (/total\s+monthly/i.test(payer)) continue;

      // Skip rows with no child name (malformed)
      if (!child) { rejected++; continue; }

      const rateAmount = parseMoney(amtRaw);
      const rateFrequency = cleanPeriod(cycle) ?? "Month";
      const chargeCode = categorizeFin02Item(item);

      // Store child name in normalized "First Last" form for reconciliation matching
      const childNameNormalized = normalizeChildName(child);

      await prisma.fin02Rate.create({
        data: {
          rawChildId: null,
          rawFamilyId: null,
          // Use normalized name as the lookup key; keep original in childName
          childName: childNameNormalized,
          centerName,
          program: null,
          classroom: null,
          chargeCode,                  // "Regular" / "Agency" / "Discount" / "Early-Late"
          chargeDescription: item,
          rateAmount,
          rateFrequency,
          effectiveDate: null,
          endDate: null,
          uploadId,
          rawData: { Cycle: cycle, Item: item, Child: child, Payer: payer, Amount: amtRaw, RateSheet: rateSheet },
        },
      });
      processed++;
    } catch (e: any) {
      rejected++;
      errors.push(e.message);
    }
  }

  return { processed, rejected, errors };
}

async function processFIN14AR(rows: Record<string, any>[], uploadId: string, fileName: string) {
  let processed = 0, rejected = 0;

  // Idempotency guard: a FIN14 file represents one center's full journal. If the
  // same file was imported before, remove the transactions from those prior
  // uploads first so re-importing replaces the data instead of duplicating it.
  const priorUploads = await prisma.fileUpload.findMany({
    where: { fileName, fileType: "FIN14_AR", id: { not: uploadId } },
    select: { id: true },
  });
  if (priorUploads.length) {
    await prisma.transaction.deleteMany({
      where: { uploadId: { in: priorUploads.map((u) => u.id) } },
    });
  }

  for (const row of rows) {
    try {
      const familyId = String(row["Family ID"] ?? row["FamilyID"] ?? row["Account Number"] ?? "").trim();
      const dateVal = row["Transaction Date"] ?? row["Date"] ?? row["Posting Date"];
      const transactionDate = parseDate(dateVal);
      if (!familyId || !transactionDate) { rejected++; continue; }

      const childId = String(row["Child ID"] ?? row["ChildID"] ?? "").trim() || null;
      const centerName = String(row["Center"] ?? row["Location"] ?? "").trim();

      let family = await prisma.family.findUnique({ where: { familyId } });
      if (!family) {
        family = await prisma.family.create({ data: { familyId } });
      }

      let child = childId ? await prisma.child.findUnique({ where: { childId } }) : null;
      let center = centerName ? await prisma.center.findFirst({ where: { name: centerName } }) : null;

      const billingMonth = transactionDate.getMonth() + 1;
      const billingYear = transactionDate.getFullYear();
      const billingPeriod = `${billingYear}-${String(billingMonth).padStart(2, "0")}`;

      // The real FIN14 journal has a SINGLE signed "Amount" column and an "Item"
      // description — not separate charge/credit/payment columns. Positive = a
      // charge (tuition/fee); negative = money off the balance (a payment or credit).
      const item = String(row["Item"] ?? row["Charge Type"] ?? row["Description"] ?? "").trim();
      const signedAmount = parseMoney(row["Amount"] ?? row["Charge"] ?? 0);

      const isPayment = signedAmount < 0 && /payment/i.test(item);
      const { majorHead, subHead } = categorizeItem(item, isPayment);

      let chargeAmount = 0, creditAmount = 0, paymentAmount = 0;
      if (isPayment) {
        paymentAmount = -signedAmount;        // e.g. "CORE Payments (…)"
      } else if (signedAmount >= 0) {
        chargeAmount = signedAmount;
      } else {
        creditAmount = -signedAmount;         // discounts / adjustments reducing the balance
      }

      await prisma.transaction.create({
        data: {
          familyId: family.id,
          childId: child?.id ?? null,
          centerId: center?.id ?? null,
          transactionDate,
          billingPeriod,
          billingMonth,
          billingYear,
          invoiceNumber: String(row["Invoice"] ?? row["Invoice Number"] ?? "").trim() || null,
          chargeType: item || null,
          majorHead,
          subHead,
          chargeAmount,
          creditAmount,
          paymentAmount,
          adjustmentAmount: parseMoney(row["Adjustment"] ?? row["Adjustments"] ?? 0),
          balance: parseMoney(row["Balance"] ?? 0),
          uploadId,
          rawData: row,
        },
      });
      processed++;
    } catch { rejected++; }
  }
  return { processed, rejected };
}
