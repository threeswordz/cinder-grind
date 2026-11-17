-- Serialize opt-in against the Project FK used by new Claims. Do not add a
-- Project-wide advisory lock to ordinary/legacy Claim inserts: their existing
-- deferred Agreement lineage boundary must still permit pre-commit contenders.
CREATE OR REPLACE FUNCTION erp_physical_policy_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM projects WHERE id=NEW.project_id AND company_id=NEW.company_id AND is_active FOR UPDATE;
 IF NOT FOUND OR NOT erp_physical_actor(NEW.enabled_by_user_id,NEW.company_id,'subcontracts.physical.configure') THEN
   RAISE EXCEPTION 'PHYSICAL_POLICY_DENIED';
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION erp_physical_new_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM subcontract_physical_policies WHERE project_id=NEW.project_id AND company_id=NEW.company_id) THEN
   INSERT INTO subcontract_physical_claims(claim_id,company_id,project_id,agreement_id,created_at)
     VALUES(NEW.id,NEW.company_id,NEW.project_id,NEW.agreement_id,NEW.created_at);
 END IF;
 RETURN NEW;
END $$;
