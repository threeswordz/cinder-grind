-- V0.3-B review hardening:
-- 1) allow a user who already approved a multi-approval step to record a
--    distinct cancellation action while the approval instance is still SUBMITTED;
-- 2) snapshot the Material code shown in retained Purchase Request history.

DROP INDEX IF EXISTS "approval_actions_instance_step_user_key";

CREATE UNIQUE INDEX IF NOT EXISTS "approval_actions_instance_step_user_action_key"
  ON "approval_actions"(
    "approval_instance_id",
    "approval_step_id",
    "action_by_user_id",
    "action"
  );

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
