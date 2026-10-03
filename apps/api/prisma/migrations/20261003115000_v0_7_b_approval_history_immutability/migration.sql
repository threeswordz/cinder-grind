-- V0.7-B Codex round-two approval-history hardening.
-- Forward-only: prior executed migrations remain immutable.
-- Completed DIRECT_COST_POSTING approval instances and their retained actions
-- are immutable because they are presented as durable approval evidence.

CREATE OR REPLACE FUNCTION erp_direct_cost_approval_instance_history_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD."entity_type" = 'DIRECT_COST_POSTING'
     AND OLD."approval_state" IN ('APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_HISTORY_IMMUTABLE';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "direct_cost_approval_instance_history_guard"
BEFORE UPDATE OR DELETE ON "approval_instances"
FOR EACH ROW EXECUTE FUNCTION erp_direct_cost_approval_instance_history_guard();

CREATE OR REPLACE FUNCTION erp_direct_cost_approval_action_history_guard()
RETURNS trigger AS $$
DECLARE
  old_entity_type TEXT;
  old_approval_state TEXT;
  new_entity_type TEXT;
  new_approval_state TEXT;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT ai."entity_type", ai."approval_state"
      INTO old_entity_type, old_approval_state
    FROM "approval_instances" ai
    WHERE ai."id" = OLD."approval_instance_id";

    IF old_entity_type = 'DIRECT_COST_POSTING'
       AND old_approval_state IN ('APPROVED','REJECTED') THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_HISTORY_IMMUTABLE';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT','UPDATE') THEN
    SELECT ai."entity_type", ai."approval_state"
      INTO new_entity_type, new_approval_state
    FROM "approval_instances" ai
    WHERE ai."id" = NEW."approval_instance_id";

    IF new_entity_type = 'DIRECT_COST_POSTING'
       AND new_approval_state IN ('APPROVED','REJECTED') THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_HISTORY_IMMUTABLE';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "direct_cost_approval_action_history_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "approval_actions"
FOR EACH ROW EXECUTE FUNCTION erp_direct_cost_approval_action_history_guard();
