-- V0.5-D forward-only bridge from Certification reversal to Claim correction.
-- Preserve Stage-C history while allowing exactly the approved Stage-D path:
-- an ASSESSED Claim with retained REVERSED Certification evidence can host one
-- linked Draft replacement and atomically become REPLACED at successor submit.

DROP INDEX "subcontract_claims_active_period_key";
CREATE UNIQUE INDEX "subcontract_claims_active_period_key"
  ON "subcontract_claims"("agreement_id","period_start","period_end")
  WHERE "state" IN ('DRAFT','SUBMITTED','ASSESSED')
    AND NOT ("state" = 'DRAFT' AND "replacement_for_claim_id" IS NOT NULL);

CREATE OR REPLACE FUNCTION protect_v05c_claim()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  reversed_certification_exists BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."state" <> 'DRAFT' THEN
      RAISE EXCEPTION 'Submitted Claim history cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id" OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."claim_number" <> OLD."claim_number" OR NEW."currency_code" <> OLD."currency_code"
    OR NEW."replacement_for_claim_id" IS DISTINCT FROM OLD."replacement_for_claim_id"
    OR NEW."created_by_user_id" <> OLD."created_by_user_id" OR NEW."created_at" <> OLD."created_at"
  THEN RAISE EXCEPTION 'Claim identity and source lineage are immutable'; END IF;

  IF OLD."state" <> 'DRAFT' AND (
    NEW."period_start" <> OLD."period_start" OR NEW."period_end" <> OLD."period_end"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  ) THEN RAISE EXCEPTION 'Submitted Claim source fields are immutable'; END IF;

  IF OLD."state" IN ('REPLACED') AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Replaced Claim is immutable'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM "subcontract_certifications"
    WHERE "claim_id" = OLD."id" AND "state" = 'REVERSED'
  ) INTO reversed_certification_exists;

  IF NEW."state" <> OLD."state" AND NOT (
    (OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED')
    OR (OLD."state" = 'SUBMITTED' AND NEW."state" IN ('WITHDRAWN','ASSESSED'))
    OR (OLD."state" = 'ASSESSED' AND NEW."state" = 'REJECTED')
    OR (
      OLD."state" = 'ASSESSED' AND NEW."state" = 'REPLACED'
      AND reversed_certification_exists
    )
    OR (OLD."state" IN ('WITHDRAWN','REJECTED') AND NEW."state" = 'REPLACED')
  ) THEN RAISE EXCEPTION 'Invalid Claim lifecycle transition'; END IF;

  IF OLD."withdrawn_at" IS NOT NULL AND (
    NEW."withdrawn_at" IS DISTINCT FROM OLD."withdrawn_at"
    OR NEW."withdrawn_by_user_id" IS DISTINCT FROM OLD."withdrawn_by_user_id"
    OR NEW."withdrawal_reason" IS DISTINCT FROM OLD."withdrawal_reason"
  ) THEN RAISE EXCEPTION 'Claim withdrawal evidence is immutable'; END IF;

  IF OLD."replaced_at" IS NOT NULL AND NEW."replaced_at" IS DISTINCT FROM OLD."replaced_at"
  THEN RAISE EXCEPTION 'Claim replacement evidence is immutable'; END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION check_v05c_claim_assessment_commit_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  assessment_state VARCHAR(30);
  reversed_certification_exists BOOLEAN;
BEGIN
  SELECT "state" INTO assessment_state
    FROM "subcontract_claim_assessments"
    WHERE "claim_id" = NEW."id";

  SELECT EXISTS (
    SELECT 1 FROM "subcontract_certifications"
    WHERE "claim_id" = NEW."id" AND "state" = 'REVERSED'
  ) INTO reversed_certification_exists;

  IF NEW."state" = 'ASSESSED' AND assessment_state IS DISTINCT FROM 'ASSESSED' THEN
    RAISE EXCEPTION 'ASSESSED Claim requires matching Assessment evidence';
  ELSIF NEW."state" = 'REJECTED' AND assessment_state IS DISTINCT FROM 'REJECTED' THEN
    RAISE EXCEPTION 'REJECTED Claim requires rejected Assessment evidence';
  ELSIF NEW."state" IN ('DRAFT','SUBMITTED','WITHDRAWN') AND assessment_state IS NOT NULL THEN
    RAISE EXCEPTION 'Claim state cannot retain Assessment evidence';
  ELSIF NEW."state" = 'REPLACED' THEN
    IF assessment_state = 'REJECTED' THEN
      IF NEW."withdrawn_at" IS NOT NULL
        OR NEW."withdrawn_by_user_id" IS NOT NULL
        OR NEW."withdrawal_reason" IS NOT NULL
      THEN
        RAISE EXCEPTION 'Rejected Claim replacement cannot carry withdrawal evidence';
      END IF;
    ELSIF assessment_state IS NULL THEN
      IF NEW."withdrawn_at" IS NULL
        OR NEW."withdrawn_by_user_id" IS NULL
        OR NEW."withdrawal_reason" IS NULL
        OR length(btrim(NEW."withdrawal_reason")) = 0
      THEN
        RAISE EXCEPTION 'REPLACED Claim requires approved correction evidence';
      END IF;
    ELSIF assessment_state = 'ASSESSED' THEN
      IF NOT reversed_certification_exists
        OR NEW."withdrawn_at" IS NOT NULL
        OR NEW."withdrawn_by_user_id" IS NOT NULL
        OR NEW."withdrawal_reason" IS NOT NULL
      THEN
        RAISE EXCEPTION 'Replaced assessed Claim requires reversed Certification evidence';
      END IF;
    ELSE
      RAISE EXCEPTION 'Replaced Claim has invalid Assessment evidence';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION check_v05c_assessment_claim_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_state VARCHAR(30);
  parent_withdrawn_at TIMESTAMPTZ;
  retained_claim_total NUMERIC(18,2);
  reversed_certification_exists BOOLEAN;
BEGIN
  SELECT "state", "withdrawn_at"
    INTO parent_state, parent_withdrawn_at
    FROM "subcontract_claims"
    WHERE "id" = NEW."claim_id";

  SELECT COALESCE(SUM("amount"), 0)
    INTO retained_claim_total
    FROM "subcontract_claim_lines"
    WHERE "company_id" = NEW."company_id"
      AND "project_id" = NEW."project_id"
      AND "agreement_id" = NEW."agreement_id"
      AND "claim_id" = NEW."claim_id";

  SELECT EXISTS (
    SELECT 1 FROM "subcontract_certifications"
    WHERE "claim_id" = NEW."claim_id" AND "state" = 'REVERSED'
  ) INTO reversed_certification_exists;

  IF NEW."assessed_amount" > retained_claim_total THEN
    RAISE EXCEPTION 'Assessment amount cannot exceed retained Claim total';
  END IF;

  IF NOT (
    (NEW."state" = 'ASSESSED' AND parent_state = 'ASSESSED')
    OR (
      NEW."state" = 'ASSESSED'
      AND parent_state = 'REPLACED'
      AND reversed_certification_exists
    )
    OR (NEW."state" = 'REJECTED' AND parent_state = 'REJECTED')
    OR (
      NEW."state" = 'REJECTED'
      AND parent_state = 'REPLACED'
      AND parent_withdrawn_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Assessment state requires matching committed Claim state';
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION check_v05c_claim_replacement_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  predecessor_state VARCHAR(30);
  predecessor_period_start DATE;
  predecessor_period_end DATE;
  successor_id UUID;
  successor_state VARCHAR(30);
  predecessor_reversed_certification BOOLEAN;
  new_reversed_certification BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('v05c-claim-company:' || NEW."company_id"::text),
    hashtext('v05c-claim-agreement:' || NEW."agreement_id"::text)
  );

  SELECT EXISTS (
    SELECT 1 FROM "subcontract_certifications"
    WHERE "claim_id" = NEW."id" AND "state" = 'REVERSED'
  ) INTO new_reversed_certification;

  IF NEW."state" IN ('DRAFT','SUBMITTED','ASSESSED')
    AND NEW."replacement_for_claim_id" IS NULL
    AND EXISTS (
      SELECT 1
        FROM "subcontract_claims" AS terminal_claim
        WHERE terminal_claim."company_id" = NEW."company_id"
          AND terminal_claim."project_id" = NEW."project_id"
          AND terminal_claim."agreement_id" = NEW."agreement_id"
          AND terminal_claim."period_start" = NEW."period_start"
          AND terminal_claim."period_end" = NEW."period_end"
          AND terminal_claim."id" <> NEW."id"
          AND terminal_claim."state" IN ('WITHDRAWN','REJECTED','REPLACED')
    )
  THEN
    RAISE EXCEPTION 'Active Claim for retained terminal period requires linked replacement';
  END IF;

  IF NEW."state" IN ('WITHDRAWN','REJECTED','REPLACED')
    AND EXISTS (
      SELECT 1
        FROM "subcontract_claims" AS active_claim
        WHERE active_claim."company_id" = NEW."company_id"
          AND active_claim."project_id" = NEW."project_id"
          AND active_claim."agreement_id" = NEW."agreement_id"
          AND active_claim."period_start" = NEW."period_start"
          AND active_claim."period_end" = NEW."period_end"
          AND active_claim."id" <> NEW."id"
          AND active_claim."state" IN ('DRAFT','SUBMITTED','ASSESSED')
          AND active_claim."replacement_for_claim_id" IS DISTINCT FROM NEW."id"
    )
  THEN
    RAISE EXCEPTION 'Terminal Claim period cannot coexist with unrelated active Claim';
  END IF;

  IF NEW."replacement_for_claim_id" IS NOT NULL THEN
    SELECT "state", "period_start", "period_end"
      INTO predecessor_state, predecessor_period_start, predecessor_period_end
      FROM "subcontract_claims"
      WHERE "id" = NEW."replacement_for_claim_id";

    SELECT EXISTS (
      SELECT 1 FROM "subcontract_certifications"
      WHERE "claim_id" = NEW."replacement_for_claim_id"
        AND "state" = 'REVERSED'
    ) INTO predecessor_reversed_certification;

    IF NEW."period_start" IS DISTINCT FROM predecessor_period_start
      OR NEW."period_end" IS DISTINCT FROM predecessor_period_end
    THEN
      RAISE EXCEPTION 'Linked replacement must retain predecessor period';
    END IF;

    IF NEW."state" = 'DRAFT'
      AND predecessor_state NOT IN ('WITHDRAWN','REJECTED')
      AND NOT (
        predecessor_state = 'ASSESSED'
        AND predecessor_reversed_certification
      )
    THEN
      RAISE EXCEPTION 'Draft replacement requires approved correction predecessor';
    ELSIF NEW."state" <> 'DRAFT' AND predecessor_state IS DISTINCT FROM 'REPLACED' THEN
      RAISE EXCEPTION 'Submitted replacement requires predecessor to be REPLACED';
    END IF;
  END IF;

  SELECT "id", "state" INTO successor_id, successor_state
    FROM "subcontract_claims"
    WHERE "replacement_for_claim_id" = NEW."id";

  IF NEW."state" = 'REPLACED' THEN
    IF successor_id IS NULL OR successor_state = 'DRAFT' THEN
      RAISE EXCEPTION 'REPLACED Claim requires a submitted linked replacement';
    END IF;
  ELSIF successor_id IS NOT NULL THEN
    IF successor_state <> 'DRAFT' THEN
      RAISE EXCEPTION 'Non-REPLACED Claim cannot have a submitted linked replacement';
    ELSIF NEW."state" NOT IN ('WITHDRAWN','REJECTED')
      AND NOT (NEW."state" = 'ASSESSED' AND new_reversed_certification)
    THEN
      RAISE EXCEPTION 'Draft replacement requires approved correction predecessor';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION protect_v05c_claim_assessment()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Claim Assessment history cannot be deleted';
  END IF;

  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id" OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."claim_id" <> OLD."claim_id" OR NEW."assessed_amount" <> OLD."assessed_amount"
    OR NEW."reason" <> OLD."reason" OR NEW."assessed_by_user_id" <> OLD."assessed_by_user_id"
    OR NEW."assessed_at" <> OLD."assessed_at" OR NEW."created_at" <> OLD."created_at"
  THEN RAISE EXCEPTION 'Claim Assessment source decision is immutable'; END IF;

  IF OLD."state" = 'REJECTED' AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Rejected Claim Assessment is immutable'; END IF;

  IF OLD."state" = 'ASSESSED' AND NEW."state" = 'REJECTED'
    AND EXISTS (
      SELECT 1 FROM "subcontract_certifications"
      WHERE "claim_id" = OLD."claim_id"
        AND "state" IN ('DRAFT','SUBMITTED','APPROVED','REVERSED')
    )
  THEN
    RAISE EXCEPTION 'Certification correction history blocks Assessment rejection';
  END IF;

  IF NEW."state" <> OLD."state"
    AND NOT (OLD."state" = 'ASSESSED' AND NEW."state" = 'REJECTED')
  THEN RAISE EXCEPTION 'Invalid Claim Assessment transition'; END IF;

  RETURN NEW;
END $$;
