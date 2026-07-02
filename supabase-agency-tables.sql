-- Run this in the Supabase SQL Editor to create the new Agency tables

CREATE TABLE IF NOT EXISTS "AgencySettingBatch" (
  "id"         TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "fileCount"  INTEGER     NOT NULL DEFAULT 0,
  "rowCount"   INTEGER     NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "AgencySetting" (
  "id"                 TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "batchId"            TEXT        NOT NULL REFERENCES "AgencySettingBatch"("id") ON DELETE CASCADE,
  "center"             TEXT,
  "active"             TEXT,
  "contractPeriod"     TEXT,
  "name"               TEXT,
  "type"               TEXT,
  "useBlackoutDates"   TEXT,
  "discountsPermitted" TEXT,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AgencySetting_batchId_idx" ON "AgencySetting"("batchId");
CREATE INDEX IF NOT EXISTS "AgencySetting_name_idx"    ON "AgencySetting"("name");

CREATE TABLE IF NOT EXISTS "AgencyNameMapping" (
  "id"                TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "fc28AgencyName"    TEXT        NOT NULL UNIQUE,
  "agencySettingName" TEXT,
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "AgencyNameMapping_fc28AgencyName_idx" ON "AgencyNameMapping"("fc28AgencyName");
