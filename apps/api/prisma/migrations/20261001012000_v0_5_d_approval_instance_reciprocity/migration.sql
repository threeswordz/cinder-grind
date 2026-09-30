-- V0.5-D forward-only reciprocal ApprovalInstance integrity hardening.
-- Existing Stage-D migrations remain unchanged.

CREATE OR REPLACE FUNCTION check_v05d_certification_approval_instance_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  certification_state VARCHAR(30);
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."entity_type" = 'SUBCONTRACT_CERTIFICATION'
    AND (
      NEW."entity_type" IS DISTINCT FROM OLD."entity_type"
      OR NEW."entity_id" IS DISTINCT FROM OLD."entity_id"
      OR NEW."company_id" IS DISTINCT FROM OLD."company_id"
    )
  THEN
    RAISE EXCEPTION 'Certification approval instance identity is immutable';
  END IF;

  IF NEW."entity_type" <> 'SUBCONTRACT_CERTIFICATION' THEN
    RETURN NEW;
  END IF;

  SELECT certification."state"
    INTO certification_state
    FROM "subcontract_certifications" certification
    WHERE certification."approval_instance_id" = NEW."id"
      AND certification."id" = NEW."entity_id"
      AND certification."company_id" = NEW."company_id";

  IF certification_state IS NULL THEN
    RAISE EXCEPTION 'Certification approval instance requires reciprocal Certification link';
  END IF;

  IF NEW."approval_state" = 'SUBMITTED'
    AND certification_state <> 'SUBMITTED'
  THEN
    RAISE EXCEPTION 'Submitted approval instance requires submitted Certification';
  ELSIF NEW."approval_state" = 'REJECTED'
    AND certification_state <> 'REJECTED'
  THEN
    RAISE EXCEPTION 'Rejected approval instance requires rejected Certification';
  ELSIF NEW."approval_state" = 'APPROVED'
    AND certification_state NOT IN ('APPROVED','REVERSED')
  THEN
    RAISE EXCEPTION 'Approved approval instance requires approved or reversed Certification';
  ELSIF NEW."approval_state" = 'CANCELLED'
  THEN
    RAISE EXCEPTION 'Certification approval instances cannot be cancelled independently';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS v05d_certification_approval_instance_consistency
  ON "approval_instances";

CREATE CONSTRAINT TRIGGER v05d_certification_approval_instance_consistency
AFTER INSERT OR UPDATE ON "approval_instances"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_v05d_certification_approval_instance_consistency();
