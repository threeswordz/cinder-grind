-- V0.6-C forward-only Codex P1 fix:
-- once an approved Payment is cancelled, the retained approval actor/time
-- remains immutable just like the cancellation evidence itself.
-- Do not edit prior executed migrations.

CREATE OR REPLACE FUNCTION erp_cancelled_payment_approval_history_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD."state" = 'CANCELLED' AND (
       NEW."approved_by_user_id" IS DISTINCT FROM OLD."approved_by_user_id"
    OR NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
    OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
  ) THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_HISTORY_IMMUTABLE';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_cancelled_approval_history_guard"
BEFORE UPDATE ON "payments"
FOR EACH ROW EXECUTE FUNCTION erp_cancelled_payment_approval_history_guard();
