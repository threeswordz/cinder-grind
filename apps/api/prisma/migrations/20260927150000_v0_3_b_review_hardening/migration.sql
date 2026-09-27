-- V0.3-B review hardening:
-- snapshot the Material code shown in retained Purchase Request history.
-- Approval cancellation uniqueness is handled by the preceding
-- 20260927150000_v0_3_b_approval_cancel_actions migration.

ALTER TABLE "purchase_request_lines"
  ADD COLUMN IF NOT EXISTS "material_code_snapshot" VARCHAR(80);

UPDATE "purchase_request_lines" prl
SET "material_code_snapshot" = m."material_code"
FROM "materials" m
WHERE prl."line_type" = 'MATERIAL'
  AND prl."material_id" = m."id"
  AND prl."material_code_snapshot" IS NULL;

ALTER TABLE "purchase_request_lines"
  DROP CONSTRAINT IF EXISTS "purchase_request_lines_material_snapshot_check";

ALTER TABLE "purchase_request_lines"
  ADD CONSTRAINT "purchase_request_lines_material_snapshot_check"
  CHECK (
    ("line_type" = 'MATERIAL' AND "material_code_snapshot" IS NOT NULL)
    OR ("line_type" = 'SERVICE' AND "material_code_snapshot" IS NULL)
  );
