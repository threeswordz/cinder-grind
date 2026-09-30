-- V0.5-C forward-only exact-period lineage pair hardening.
-- Validate both directions of the active/terminal Claim invariant and serialize
-- direct/future persistence at the Agreement boundary before the deferred
-- exact-period checks read committed peer history.
-- Previously executed Stage-C migrations remain byte-for-byte unchanged.

CREATE OR REPLACE FUNCTION check_v05c_claim_replacement_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  predecessor_state VARCHAR(30);
  predecessor_period_start DATE;
  predecessor_period_end DATE;
  successor_id UUID;
  successor_state VARCHAR(30);
BEGIN
  -- The service layer already serializes Claim commercial work on Agreement.
  -- Mirror that boundary for direct/future persistence without taking the
  -- Agreement row lock late in the transaction. Hash collisions only
  -- over-serialize unrelated Agreements; they cannot weaken consistency.
  PERFORM pg_advisory_xact_lock(
    hashtext('v05c-claim-company:' || NEW."company_id"::text),
    hashtext('v05c-claim-agreement:' || NEW."agreement_id"::text)
  );

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

    IF NEW."period_start" IS DISTINCT FROM predecessor_period_start
      OR NEW."period_end" IS DISTINCT FROM predecessor_period_end
    THEN
      RAISE EXCEPTION 'Linked replacement must retain predecessor period';
    END IF;

    IF NEW."state" = 'DRAFT'
      AND predecessor_state NOT IN ('WITHDRAWN','REJECTED')
    THEN
      RAISE EXCEPTION 'Draft replacement requires withdrawn or rejected predecessor';
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
    ELSIF NEW."state" NOT IN ('WITHDRAWN','REJECTED') THEN
      RAISE EXCEPTION 'Draft replacement requires terminal predecessor';
    END IF;
  END IF;

  RETURN NEW;
END $$;
