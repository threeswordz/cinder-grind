-- Forward-only Stage-C history hardening. Rejected Claims may transition
-- directly to REPLACED without withdrawal evidence, but a WITHDRAWN Claim
-- must always retain the authorized withdrawal actor, timestamp and reason.
-- The previously executed Stage-C migrations remain unchanged.
ALTER TABLE "subcontract_claims"
  ADD CONSTRAINT "subcontract_claims_withdrawn_requires_evidence_check"
  CHECK (
    "state" <> 'WITHDRAWN'
    OR (
      "withdrawn_at" IS NOT NULL
      AND "withdrawn_by_user_id" IS NOT NULL
      AND "withdrawal_reason" IS NOT NULL
      AND length(btrim("withdrawal_reason")) > 0
    )
  );
