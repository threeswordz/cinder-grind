-- V0.5-B: tighten retained agreement and decision evidence without rewriting applied migrations.

ALTER TABLE "subcontract_agreements"
  DROP CONSTRAINT "subcontract_agreements_cancel_evidence_check",
  ADD CONSTRAINT "subcontract_agreements_cancel_evidence_check" CHECK (
    (
      "approval_state" <> 'CANCELLED'
      AND "cancelled_at" IS NULL
      AND "cancelled_by_user_id" IS NULL
      AND "cancellation_reason" IS NULL
    )
    OR (
      "approval_state" = 'CANCELLED'
      AND "cancelled_at" IS NOT NULL
      AND "cancelled_by_user_id" IS NOT NULL
      AND "cancellation_reason" IS NOT NULL
      AND length(btrim("cancellation_reason")) > 0
    )
  ),
  ADD CONSTRAINT "subcontract_agreements_first_approval_evidence_check" CHECK (
    (
      "approval_state" IN ('DRAFT','SUBMITTED','REJECTED')
      AND "first_approved_at" IS NULL
    )
    OR (
      "approval_state" IN ('APPROVED','CANCELLED')
      AND "first_approved_at" IS NOT NULL
    )
  );

ALTER TABLE "subcontract_agreement_versions"
  ADD CONSTRAINT "agreement_versions_decision_evidence_check" CHECK (
    (
      "approval_state" IN ('DRAFT','SUBMITTED')
      AND "decided_at" IS NULL
    )
    OR (
      "approval_state" IN ('APPROVED','REJECTED')
      AND "decided_at" IS NOT NULL
    )
  );

ALTER TABLE "subcontract_work_orders"
  ADD CONSTRAINT "work_orders_decision_evidence_check" CHECK (
    (
      "approval_state" IN ('DRAFT','SUBMITTED')
      AND "decided_at" IS NULL
    )
    OR (
      "approval_state" IN ('APPROVED','REJECTED')
      AND "decided_at" IS NOT NULL
    )
  );
