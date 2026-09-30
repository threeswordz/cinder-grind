-- V0.5-D Certification and retention-withholding foundation.
-- Existing Agreements are compatibility-backfilled to 0.00% / NULL cap so
-- Stage D introduces no retroactive withholding effect.

ALTER TABLE "subcontract_agreements"
  ADD COLUMN "retention_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "retention_cap" DECIMAL(18,2);

ALTER TABLE "subcontract_agreements"
  ADD CONSTRAINT "subcontract_agreements_retention_rate_check"
    CHECK ("retention_rate" >= 0 AND "retention_rate" <= 100),
  ADD CONSTRAINT "subcontract_agreements_retention_cap_check"
    CHECK ("retention_cap" IS NULL OR "retention_cap" >= 0);

ALTER TABLE "subcontract_agreement_versions"
  ADD COLUMN "retention_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN "retention_cap" DECIMAL(18,2);

ALTER TABLE "subcontract_agreement_versions"
  ADD CONSTRAINT "subcontract_agreement_versions_retention_rate_check"
    CHECK ("retention_rate" >= 0 AND "retention_rate" <= 100),
  ADD CONSTRAINT "subcontract_agreement_versions_retention_cap_check"
    CHECK ("retention_cap" IS NULL OR "retention_cap" >= 0);

ALTER TABLE "subcontract_claim_assessments"
  ADD CONSTRAINT "claim_assessments_certification_scope_key"
    UNIQUE ("company_id","project_id","agreement_id","claim_id","id");

CREATE TABLE "subcontract_certifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "agreement_id" UUID NOT NULL,
  "claim_id" UUID NOT NULL,
  "assessment_id" UUID NOT NULL,
  "certification_number" VARCHAR(30) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "certified_gross" DECIMAL(18,2) NOT NULL,
  "state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "approval_instance_id" UUID,
  "assessed_amount_snapshot" DECIMAL(18,2),
  "retention_rate_snapshot" DECIMAL(5,2),
  "retention_cap_snapshot" DECIMAL(18,2),
  "retained_before_snapshot" DECIMAL(18,2),
  "retained_amount" DECIMAL(18,2),
  "net_certified_amount" DECIMAL(18,2),
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "rejected_by_user_id" UUID,
  "reversed_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "decided_at" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "rejected_at" TIMESTAMPTZ(6),
  "rejection_reason" TEXT,
  "reversed_at" TIMESTAMPTZ(6),
  "reversal_reason" TEXT,
  CONSTRAINT "subcontract_certifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subcontract_certifications_state_check"
    CHECK ("state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','REVERSED')),
  CONSTRAINT "subcontract_certifications_gross_check"
    CHECK ("certified_gross" >= 0),
  CONSTRAINT "subcontract_certifications_rate_snapshot_check"
    CHECK ("retention_rate_snapshot" IS NULL OR ("retention_rate_snapshot" >= 0 AND "retention_rate_snapshot" <= 100)),
  CONSTRAINT "subcontract_certifications_cap_snapshot_check"
    CHECK ("retention_cap_snapshot" IS NULL OR "retention_cap_snapshot" >= 0),
  CONSTRAINT "subcontract_certifications_amount_snapshots_check"
    CHECK (
      ("assessed_amount_snapshot" IS NULL OR "assessed_amount_snapshot" >= 0)
      AND ("retained_before_snapshot" IS NULL OR "retained_before_snapshot" >= 0)
      AND ("retained_amount" IS NULL OR "retained_amount" >= 0)
      AND ("net_certified_amount" IS NULL OR "net_certified_amount" >= 0)
    ),
  CONSTRAINT "subcontract_certifications_retained_gross_check"
    CHECK ("retained_amount" IS NULL OR "retained_amount" <= "certified_gross"),
  CONSTRAINT "subcontract_certifications_net_check"
    CHECK (
      ("retained_amount" IS NULL AND "net_certified_amount" IS NULL)
      OR ("retained_amount" IS NOT NULL AND "net_certified_amount" = "certified_gross" - "retained_amount")
    ),
  CONSTRAINT "subcontract_certifications_approved_snapshot_check"
    CHECK (
      "state" NOT IN ('APPROVED','REVERSED')
      OR (
        "assessed_amount_snapshot" IS NOT NULL
        AND "retention_rate_snapshot" IS NOT NULL
        AND "retained_before_snapshot" IS NOT NULL
        AND "retained_amount" IS NOT NULL
        AND "net_certified_amount" IS NOT NULL
        AND "approved_by_user_id" IS NOT NULL
        AND "approved_at" IS NOT NULL
      )
    ),
  CONSTRAINT "subcontract_certifications_reversal_check"
    CHECK (
      ("state" = 'REVERSED' AND "reversed_by_user_id" IS NOT NULL AND "reversed_at" IS NOT NULL AND "reversal_reason" IS NOT NULL)
      OR ("state" <> 'REVERSED' AND "reversed_by_user_id" IS NULL AND "reversed_at" IS NULL AND "reversal_reason" IS NULL)
    )
);

CREATE UNIQUE INDEX "subcontract_certifications_company_number_key"
  ON "subcontract_certifications" ("company_id","certification_number");
CREATE UNIQUE INDEX "subcontract_certifications_approval_instance_key"
  ON "subcontract_certifications" ("approval_instance_id")
  WHERE "approval_instance_id" IS NOT NULL;
CREATE UNIQUE INDEX "subcontract_certifications_scope_key"
  ON "subcontract_certifications" ("company_id","project_id","agreement_id","claim_id","id");
CREATE UNIQUE INDEX "subcontract_certifications_active_claim_key"
  ON "subcontract_certifications" ("company_id","project_id","agreement_id","claim_id")
  WHERE "state" IN ('DRAFT','SUBMITTED','APPROVED');
CREATE INDEX "subcontract_certifications_agreement_state_idx"
  ON "subcontract_certifications" ("company_id","project_id","agreement_id","state");
CREATE INDEX "subcontract_certifications_claim_state_idx"
  ON "subcontract_certifications" ("claim_id","state");

ALTER TABLE "subcontract_certifications"
  ADD CONSTRAINT "subcontract_certifications_agreement_fkey"
  FOREIGN KEY ("company_id","project_id","agreement_id")
  REFERENCES "subcontract_agreements" ("company_id","project_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_certifications_claim_fkey"
  FOREIGN KEY ("company_id","project_id","agreement_id","claim_id")
  REFERENCES "subcontract_claims" ("company_id","project_id","agreement_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_certifications_assessment_fkey"
  FOREIGN KEY ("company_id","project_id","agreement_id","claim_id","assessment_id")
  REFERENCES "subcontract_claim_assessments" ("company_id","project_id","agreement_id","claim_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_certifications_approval_instance_id_fkey"
  FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances" ("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_certifications_creator_fkey"
  FOREIGN KEY ("company_id","created_by_user_id") REFERENCES "users" ("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_certifications_submitter_fkey"
  FOREIGN KEY ("company_id","submitted_by_user_id") REFERENCES "users" ("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_certifications_approver_fkey"
  FOREIGN KEY ("company_id","approved_by_user_id") REFERENCES "users" ("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_certifications_rejector_fkey"
  FOREIGN KEY ("company_id","rejected_by_user_id") REFERENCES "users" ("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_certifications_reverser_fkey"
  FOREIGN KEY ("company_id","reversed_by_user_id") REFERENCES "users" ("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
