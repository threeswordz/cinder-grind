-- V0.6-D payable retention ledger foundation.
-- Forward-only: do not modify executed V0.5/V0.6 migrations.

CREATE TABLE "retention_ledger_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "agreement_id" UUID NOT NULL,
  "certification_id" UUID NOT NULL,
  "entry_type" VARCHAR(30) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "reverses_entry_id" UUID,
  "recorded_by_user_id" UUID NOT NULL,
  "recorded_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "retention_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "retention_ledger_entries_type_check"
    CHECK ("entry_type" IN ('WITHHOLDING','REVERSAL')),
  CONSTRAINT "retention_ledger_entries_amount_check"
    CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "retention_ledger_entries_cert_type_key"
  ON "retention_ledger_entries"("certification_id","entry_type");
CREATE UNIQUE INDEX "retention_ledger_entries_reverses_entry_key"
  ON "retention_ledger_entries"("reverses_entry_id")
  WHERE "reverses_entry_id" IS NOT NULL;
CREATE INDEX "retention_ledger_entries_company_project_recorded_idx"
  ON "retention_ledger_entries"("company_id","project_id","recorded_at");
CREATE INDEX "retention_ledger_entries_agreement_recorded_idx"
  ON "retention_ledger_entries"("agreement_id","recorded_at");

ALTER TABLE "retention_ledger_entries"
  ADD CONSTRAINT "retention_ledger_entries_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "retention_ledger_entries_project_fkey"
  FOREIGN KEY ("company_id","project_id")
  REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "retention_ledger_entries_agreement_fkey"
  FOREIGN KEY ("company_id","project_id","agreement_id")
  REFERENCES "subcontract_agreements"("company_id","project_id","id")
  ON DELETE RESTRICT,
  ADD CONSTRAINT "retention_ledger_entries_certification_fkey"
  FOREIGN KEY ("certification_id")
  REFERENCES "subcontract_certifications"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "retention_ledger_entries_recorder_fkey"
  FOREIGN KEY ("company_id","recorded_by_user_id")
  REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "retention_ledger_entries_reverses_fkey"
  FOREIGN KEY ("reverses_entry_id")
  REFERENCES "retention_ledger_entries"("id") ON DELETE RESTRICT;

INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES (
  gen_random_uuid(),
  'finance.retention.view',
  'FINANCE',
  'View authorized payable retention withholding and balance evidence'
)
ON CONFLICT ("permission_code") DO NOTHING;

CREATE OR REPLACE FUNCTION erp_retention_ledger_source_guard()
RETURNS trigger AS $$
DECLARE
  source_company UUID;
  source_project UUID;
  source_agreement UUID;
  source_currency TEXT;
  source_state TEXT;
  source_retained DECIMAL(18,2);
  source_approved_by UUID;
  source_approved_at TIMESTAMPTZ;
  source_reversed_by UUID;
  source_reversed_at TIMESTAMPTZ;
  base_currency TEXT;
  original_entry_type TEXT;
  original_certification UUID;
  original_amount DECIMAL(18,2);
  original_currency TEXT;
BEGIN
  SELECT
    sc."company_id",
    sc."project_id",
    sc."agreement_id",
    sc."currency_code",
    sc."state",
    sc."retained_amount",
    sc."approved_by_user_id",
    sc."approved_at",
    sc."reversed_by_user_id",
    sc."reversed_at",
    c."base_currency_code"
  INTO
    source_company,
    source_project,
    source_agreement,
    source_currency,
    source_state,
    source_retained,
    source_approved_by,
    source_approved_at,
    source_reversed_by,
    source_reversed_at,
    base_currency
  FROM "subcontract_certifications" sc
  JOIN "companies" c ON c."id" = sc."company_id"
  WHERE sc."id" = NEW."certification_id";

  IF source_company IS NULL
    OR NEW."company_id" IS DISTINCT FROM source_company
    OR NEW."project_id" IS DISTINCT FROM source_project
    OR NEW."agreement_id" IS DISTINCT FROM source_agreement
  THEN
    RAISE EXCEPTION 'RETENTION_LEDGER_SCOPE_MISMATCH';
  END IF;

  IF source_currency IS DISTINCT FROM base_currency
    OR NEW."currency_code" IS DISTINCT FROM base_currency
  THEN
    RAISE EXCEPTION 'RETENTION_LEDGER_BASE_CURRENCY_REQUIRED';
  END IF;

  IF source_retained IS NULL
    OR source_retained <= 0
    OR NEW."amount" IS DISTINCT FROM source_retained
  THEN
    RAISE EXCEPTION 'RETENTION_LEDGER_AMOUNT_MISMATCH';
  END IF;

  IF NEW."entry_type" = 'WITHHOLDING' THEN
    IF source_state NOT IN ('APPROVED','REVERSED')
      OR NEW."reverses_entry_id" IS NOT NULL
      OR source_approved_by IS NULL
      OR source_approved_at IS NULL
      OR NEW."recorded_by_user_id" IS DISTINCT FROM source_approved_by
      OR NEW."recorded_at" IS DISTINCT FROM source_approved_at
    THEN
      RAISE EXCEPTION 'RETENTION_WITHHOLDING_EVIDENCE_INVALID';
    END IF;
  ELSIF NEW."entry_type" = 'REVERSAL' THEN
    IF source_state IS DISTINCT FROM 'REVERSED'
      OR NEW."reverses_entry_id" IS NULL
      OR source_reversed_by IS NULL
      OR source_reversed_at IS NULL
      OR NEW."recorded_by_user_id" IS DISTINCT FROM source_reversed_by
      OR NEW."recorded_at" IS DISTINCT FROM source_reversed_at
    THEN
      RAISE EXCEPTION 'RETENTION_REVERSAL_EVIDENCE_INVALID';
    END IF;

    SELECT
      "entry_type","certification_id","amount","currency_code"
    INTO
      original_entry_type,original_certification,original_amount,original_currency
    FROM "retention_ledger_entries"
    WHERE "id" = NEW."reverses_entry_id";

    IF original_entry_type IS DISTINCT FROM 'WITHHOLDING'
      OR original_certification IS DISTINCT FROM NEW."certification_id"
      OR original_amount IS DISTINCT FROM NEW."amount"
      OR original_currency IS DISTINCT FROM NEW."currency_code"
    THEN
      RAISE EXCEPTION 'RETENTION_REVERSAL_SOURCE_INVALID';
    END IF;
  ELSE
    RAISE EXCEPTION 'RETENTION_LEDGER_ENTRY_TYPE_INVALID';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "retention_ledger_source_guard"
BEFORE INSERT ON "retention_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION erp_retention_ledger_source_guard();

CREATE OR REPLACE FUNCTION erp_retention_ledger_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RETENTION_LEDGER_IMMUTABLE';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "retention_ledger_immutable"
BEFORE UPDATE OR DELETE ON "retention_ledger_entries"
FOR EACH ROW EXECUTE FUNCTION erp_retention_ledger_immutable();

-- Backfill canonical withholding evidence for eligible historical Certifications.
INSERT INTO "retention_ledger_entries" (
  "company_id",
  "project_id",
  "agreement_id",
  "certification_id",
  "entry_type",
  "amount",
  "currency_code",
  "recorded_by_user_id",
  "recorded_at"
)
SELECT
  sc."company_id",
  sc."project_id",
  sc."agreement_id",
  sc."id",
  'WITHHOLDING',
  sc."retained_amount",
  sc."currency_code",
  sc."approved_by_user_id",
  sc."approved_at"
FROM "subcontract_certifications" sc
JOIN "companies" c ON c."id" = sc."company_id"
WHERE sc."state" IN ('APPROVED','REVERSED')
  AND sc."retained_amount" > 0
  AND sc."currency_code" = c."base_currency_code"
  AND sc."approved_by_user_id" IS NOT NULL
  AND sc."approved_at" IS NOT NULL
ON CONFLICT ("certification_id","entry_type") DO NOTHING;

-- Backfill compensating evidence for already-reversed eligible Certifications.
INSERT INTO "retention_ledger_entries" (
  "company_id",
  "project_id",
  "agreement_id",
  "certification_id",
  "entry_type",
  "amount",
  "currency_code",
  "reverses_entry_id",
  "recorded_by_user_id",
  "recorded_at"
)
SELECT
  sc."company_id",
  sc."project_id",
  sc."agreement_id",
  sc."id",
  'REVERSAL',
  sc."retained_amount",
  sc."currency_code",
  withholding."id",
  sc."reversed_by_user_id",
  sc."reversed_at"
FROM "subcontract_certifications" sc
JOIN "companies" c ON c."id" = sc."company_id"
JOIN "retention_ledger_entries" withholding
  ON withholding."certification_id" = sc."id"
 AND withholding."entry_type" = 'WITHHOLDING'
WHERE sc."state" = 'REVERSED'
  AND sc."retained_amount" > 0
  AND sc."currency_code" = c."base_currency_code"
  AND sc."reversed_by_user_id" IS NOT NULL
  AND sc."reversed_at" IS NOT NULL
ON CONFLICT ("certification_id","entry_type") DO NOTHING;

CREATE OR REPLACE FUNCTION erp_materialize_certification_retention()
RETURNS trigger AS $$
DECLARE
  base_currency TEXT;
  withholding_id UUID;
BEGIN
  SELECT "base_currency_code"
    INTO base_currency
  FROM "companies"
  WHERE "id" = NEW."company_id";

  IF NEW."currency_code" IS DISTINCT FROM base_currency
    OR NEW."retained_amount" IS NULL
    OR NEW."retained_amount" <= 0
  THEN
    RETURN NEW;
  END IF;

  IF OLD."state" IS DISTINCT FROM 'APPROVED'
    AND NEW."state" = 'APPROVED'
  THEN
    INSERT INTO "retention_ledger_entries" (
      "company_id",
      "project_id",
      "agreement_id",
      "certification_id",
      "entry_type",
      "amount",
      "currency_code",
      "recorded_by_user_id",
      "recorded_at"
    )
    VALUES (
      NEW."company_id",
      NEW."project_id",
      NEW."agreement_id",
      NEW."id",
      'WITHHOLDING',
      NEW."retained_amount",
      NEW."currency_code",
      NEW."approved_by_user_id",
      NEW."approved_at"
    )
    ON CONFLICT ("certification_id","entry_type") DO NOTHING;
  END IF;

  IF OLD."state" IS DISTINCT FROM 'REVERSED'
    AND NEW."state" = 'REVERSED'
  THEN
    SELECT "id"
      INTO withholding_id
    FROM "retention_ledger_entries"
    WHERE "certification_id" = NEW."id"
      AND "entry_type" = 'WITHHOLDING';

    IF withholding_id IS NULL THEN
      RAISE EXCEPTION 'RETENTION_WITHHOLDING_EVIDENCE_MISSING';
    END IF;

    INSERT INTO "retention_ledger_entries" (
      "company_id",
      "project_id",
      "agreement_id",
      "certification_id",
      "entry_type",
      "amount",
      "currency_code",
      "reverses_entry_id",
      "recorded_by_user_id",
      "recorded_at"
    )
    VALUES (
      NEW."company_id",
      NEW."project_id",
      NEW."agreement_id",
      NEW."id",
      'REVERSAL',
      NEW."retained_amount",
      NEW."currency_code",
      withholding_id,
      NEW."reversed_by_user_id",
      NEW."reversed_at"
    )
    ON CONFLICT ("certification_id","entry_type") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "certification_retention_materializer"
AFTER UPDATE OF "state","retained_amount","approved_by_user_id","approved_at",
  "reversed_by_user_id","reversed_at"
ON "subcontract_certifications"
FOR EACH ROW EXECUTE FUNCTION erp_materialize_certification_retention();
