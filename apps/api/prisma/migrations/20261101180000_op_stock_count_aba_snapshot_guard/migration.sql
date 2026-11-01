-- OP-STOCK-COUNT-01 follow-up: protect against net-zero inventory movement
-- and reservation-history (ABA) changes between physical count and decision.
-- Forward-only change: existing stock transactions/reservations remain untouched.
-- Any pre-existing experimental count row receives a deliberately nonmatching
-- zero fingerprint and must be recounted, not silently rebaselined.

ALTER TABLE "stock_counts"
  ADD COLUMN "expected_ledger_event_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "expected_reservation_fingerprint" VARCHAR(64) NOT NULL
    DEFAULT '0000000000000000000000000000000000000000000000000000000000000000';

ALTER TABLE "stock_counts"
  ADD CONSTRAINT "stock_counts_snapshot_revision_check" CHECK (
    "expected_ledger_event_count" >= 0
    AND "expected_reservation_fingerprint" ~ '^[0-9a-f]{64}$'
  );

-- The original immutable history guard predates these two fields.
-- Add a separate guard rather than rewriting or weakening that function.
CREATE OR REPLACE FUNCTION protect_stock_count_snapshot_revision()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.expected_ledger_event_count IS DISTINCT FROM OLD.expected_ledger_event_count
    OR NEW.expected_reservation_fingerprint IS DISTINCT FROM OLD.expected_reservation_fingerprint
  THEN
    RAISE EXCEPTION 'STOCK_COUNT_SNAPSHOT_REVISION_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER stock_count_snapshot_revision_guard
BEFORE UPDATE ON stock_counts
FOR EACH ROW EXECUTE FUNCTION protect_stock_count_snapshot_revision();
