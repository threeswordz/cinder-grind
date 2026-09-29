-- V0.5-B: durable idempotency evidence for submit/decision/cancellation actions.
CREATE TABLE "subcontract_action_replays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "action_key" VARCHAR(120) NOT NULL,
  "action_type" VARCHAR(60) NOT NULL,
  "entity_type" VARCHAR(60) NOT NULL,
  "entity_id" UUID NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subcontract_action_replays_actor_key" UNIQUE ("company_id","user_id","action_key"),
  CONSTRAINT "subcontract_action_replays_key_check" CHECK (length(btrim("action_key")) > 0),
  CONSTRAINT "subcontract_action_replays_action_check" CHECK (length(btrim("action_type")) > 0),
  CONSTRAINT "subcontract_action_replays_entity_check" CHECK (length(btrim("entity_type")) > 0),
  CONSTRAINT "subcontract_action_replays_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "subcontract_action_replays_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_action_replays_user_fkey" FOREIGN KEY ("company_id","user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT
);

CREATE INDEX "subcontract_action_replays_entity_idx"
  ON "subcontract_action_replays"("company_id","entity_type","entity_id");

CREATE FUNCTION protect_v05b_action_replay() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Subcontract action retry evidence cannot be deleted';
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Subcontract action retry evidence is immutable';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER subcontract_action_replays_guard
BEFORE UPDATE OR DELETE ON "subcontract_action_replays"
FOR EACH ROW EXECUTE FUNCTION protect_v05b_action_replay();
