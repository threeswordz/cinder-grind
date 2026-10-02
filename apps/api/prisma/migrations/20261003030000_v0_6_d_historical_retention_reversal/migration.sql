-- V0.6-D Codex P1 fix: preserve historical retention reversal after a later
-- Company base-currency change.
-- Forward-only: do not edit the already-executed Stage-D retention migration.

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

  IF source_retained IS NULL
    OR source_retained <= 0
  THEN
    RAISE EXCEPTION 'RETENTION_LEDGER_AMOUNT_MISMATCH';
  END IF;

  IF NEW."entry_type" = 'WITHHOLDING' THEN
    IF source_currency IS DISTINCT FROM base_currency
      OR NEW."currency_code" IS DISTINCT FROM base_currency
      OR NEW."amount" IS DISTINCT FROM source_retained
    THEN
      RAISE EXCEPTION 'RETENTION_LEDGER_BASE_CURRENCY_REQUIRED';
    END IF;

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
      OR original_amount IS DISTINCT FROM source_retained
      OR original_currency IS DISTINCT FROM source_currency
      OR NEW."amount" IS DISTINCT FROM original_amount
      OR NEW."currency_code" IS DISTINCT FROM original_currency
    THEN
      RAISE EXCEPTION 'RETENTION_REVERSAL_SOURCE_INVALID';
    END IF;
  ELSE
    RAISE EXCEPTION 'RETENTION_LEDGER_ENTRY_TYPE_INVALID';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION erp_materialize_certification_retention()
RETURNS trigger AS $$
DECLARE
  base_currency TEXT;
  withholding_id UUID;
  withholding_amount DECIMAL(18,2);
  withholding_currency TEXT;
BEGIN
  SELECT "base_currency_code"
    INTO base_currency
  FROM "companies"
  WHERE "id" = NEW."company_id";

  IF OLD."state" IS DISTINCT FROM 'APPROVED'
    AND NEW."state" = 'APPROVED'
  THEN
    IF NEW."currency_code" IS DISTINCT FROM base_currency
      OR NEW."retained_amount" IS NULL
      OR NEW."retained_amount" <= 0
    THEN
      RETURN NEW;
    END IF;

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

    RETURN NEW;
  END IF;

  IF OLD."state" IS DISTINCT FROM 'REVERSED'
    AND NEW."state" = 'REVERSED'
  THEN
    IF NEW."retained_amount" IS NULL
      OR NEW."retained_amount" <= 0
    THEN
      RETURN NEW;
    END IF;

    SELECT "id","amount","currency_code"
      INTO withholding_id,withholding_amount,withholding_currency
    FROM "retention_ledger_entries"
    WHERE "certification_id" = NEW."id"
      AND "entry_type" = 'WITHHOLDING';

    IF withholding_id IS NULL THEN
      IF NEW."currency_code" IS DISTINCT FROM base_currency THEN
        RETURN NEW;
      END IF;
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
      withholding_amount,
      withholding_currency,
      withholding_id,
      NEW."reversed_by_user_id",
      NEW."reversed_at"
    )
    ON CONFLICT ("certification_id","entry_type") DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
