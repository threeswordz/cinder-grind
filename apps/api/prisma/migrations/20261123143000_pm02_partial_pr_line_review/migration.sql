-- PM02: forward-only, nullable to preserve every historic fully approved Purchase Request.
-- No mutation of prior approvals, historical demand, documents or stock/Finance state.
ALTER TABLE "purchase_request_lines"
 ADD COLUMN "review_decision" VARCHAR(20),
 ADD COLUMN "review_reason" TEXT,
 ADD COLUMN "reviewed_by_user_id" UUID,
 ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
 ADD COLUMN "correction_source_line_id" UUID;
ALTER TABLE "purchase_request_lines"
 ADD CONSTRAINT "purchase_request_lines_review_decision_check"
 CHECK ((
  (review_decision IS NULL AND review_reason IS NULL AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
  OR
  (review_decision = 'APPROVED' AND review_reason IS NULL AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
  OR
  (review_decision = 'RETURNED' AND NULLIF(BTRIM(review_reason), '') IS NOT NULL AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
 ) IS TRUE);
CREATE UNIQUE INDEX "purchase_request_lines_correction_source_line_id_key"
 ON "purchase_request_lines" ("correction_source_line_id");
