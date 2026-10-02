-- V0.6-B Codex hardening: safely adopt any pre-existing CLIENT_INVOICE
-- sequence created before the sequence code became reserved.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "number_sequences"
    WHERE "sequence_code" = 'CLIENT_INVOICE'
      AND (
        "entity_type" IS DISTINCT FROM 'CLIENT_INVOICE'
        OR "format_template" IS DISTINCT FROM 'CIYYMM-###'
        OR upper("reset_rule") IS DISTINCT FROM 'MONTHLY'
      )
      AND (
        "next_value" IS DISTINCT FROM 1
        OR "last_period_key" IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_SEQUENCE_CONFLICT_USED';
  END IF;
END;
$$;

UPDATE "number_sequences"
SET
  "entity_type" = 'CLIENT_INVOICE',
  "format_template" = 'CIYYMM-###',
  "reset_rule" = 'MONTHLY',
  "next_value" = 1
WHERE "sequence_code" = 'CLIENT_INVOICE'
  AND "next_value" = 1
  AND "last_period_key" IS NULL
  AND (
    "entity_type" IS DISTINCT FROM 'CLIENT_INVOICE'
    OR "format_template" IS DISTINCT FROM 'CIYYMM-###'
    OR upper("reset_rule") IS DISTINCT FROM 'MONTHLY'
  );

ALTER TABLE "number_sequences"
  ADD CONSTRAINT "number_sequences_client_invoice_policy_check"
  CHECK (
    "sequence_code" <> 'CLIENT_INVOICE'
    OR (
      "entity_type" = 'CLIENT_INVOICE'
      AND "format_template" = 'CIYYMM-###'
      AND upper("reset_rule") = 'MONTHLY'
    )
  );
