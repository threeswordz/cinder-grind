-- DEC-050 A: exact prepared definitions only. No historical normalization or grants.
INSERT INTO permissions(id,permission_code,module_code,description) VALUES
 ('f0500000-0000-4000-8000-000000000001','master.material.conversion.manage','MASTER_DATA','Prepare explicit immutable material-specific conversion definitions; no inventory activation.');

ALTER TABLE material_uom_bases
 ADD CONSTRAINT material_uom_basis_material_fk FOREIGN KEY(material_id) REFERENCES materials(id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_basis_company_fk FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_basis_unit_fk FOREIGN KEY(stock_uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_basis_actor_fk FOREIGN KEY(company_id,created_by_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_basis_session_fk FOREIGN KEY(session_id) REFERENCES user_sessions(id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_basis_operation_fk FOREIGN KEY(operation_id) REFERENCES material_uom_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 ADD CONSTRAINT material_uom_basis_precision CHECK(stock_precision BETWEEN 0 AND 4 AND version BETWEEN 1 AND 2147483646);
ALTER TABLE material_uom_revisions
 ADD CONSTRAINT material_uom_revision_scope_fk FOREIGN KEY(company_id,material_id) REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_revision_unit_fk FOREIGN KEY(source_uom_id) REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_revision_actor_fk FOREIGN KEY(company_id,created_by_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_revision_session_fk FOREIGN KEY(session_id) REFERENCES user_sessions(id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_revision_operation_fk FOREIGN KEY(operation_id) REFERENCES material_uom_operations(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 ADD CONSTRAINT material_uom_revision_shape CHECK(source_precision BETWEEN 0 AND 6 AND revision_no BETWEEN 2 AND 2147483646
  AND numerator ~ '^[1-9][0-9]{0,37}$' AND denominator ~ '^[1-9][0-9]{0,37}$'
  AND effective_from BETWEEN DATE '0001-01-01' AND DATE '9999-12-31');
ALTER TABLE material_uom_operations
 ADD CONSTRAINT material_uom_operation_scope_fk FOREIGN KEY(company_id,material_id) REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
 ADD CONSTRAINT material_uom_operation_actor_fk FOREIGN KEY(company_id,actor_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_operation_session_fk FOREIGN KEY(session_id) REFERENCES user_sessions(id) ON DELETE RESTRICT,
 ADD CONSTRAINT material_uom_operation_action CHECK(action IN ('PREPARE','REVISE'));

CREATE FUNCTION erp_material_uom_assert_actor(c uuid,u uuid,s uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM user_sessions us JOIN users x ON x.id=us.user_id JOIN companies co ON co.id=x.company_id
   JOIN employees e ON e.id=x.employee_id AND e.company_id=x.company_id AND e.is_active
   WHERE us.id=s AND x.id=u AND x.company_id=c AND x.is_active AND co.is_active
     AND us.revoked_at IS NULL AND us.expires_at>clock_timestamp())
 OR (SELECT count(DISTINCT p.permission_code) FROM user_roles ur JOIN roles r ON r.id=ur.role_id
   JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
   WHERE ur.user_id=u AND ur.company_id=c AND r.company_id=c AND r.is_active AND r.role_code<>'SYS_ADMIN'
    AND p.permission_code IN ('master.material.view','master.material.manage','master.material.conversion.manage'))<>3
 THEN RAISE EXCEPTION 'MATERIAL_UOM_AUTHORITY_DENIED'; END IF;
END $$;

CREATE FUNCTION erp_material_uom_gcd(a numeric,b numeric) RETURNS numeric LANGUAGE plpgsql IMMUTABLE STRICT AS $$
DECLARE next_value numeric;
BEGIN
 WHILE b<>0 LOOP next_value=mod(a,b);a=b;b=next_value;END LOOP;
 RETURN a;
END $$;

CREATE FUNCTION erp_material_uom_basis_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE unit_row units_of_measure%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'MATERIAL_UOM_HISTORY_IMMUTABLE'; END IF;
 IF TG_OP='UPDATE' THEN
  IF pg_trigger_depth()<>2 OR NEW.version<>OLD.version+1 OR (to_jsonb(NEW)-'version') IS DISTINCT FROM (to_jsonb(OLD)-'version')
  THEN RAISE EXCEPTION 'MATERIAL_UOM_HISTORY_IMMUTABLE'; END IF;
  RETURN NEW;
 END IF;
 PERFORM erp_material_uom_assert_actor(NEW.company_id,NEW.created_by_user_id,NEW.session_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||NEW.company_id::text||':'||NEW.material_id::text,0));
 PERFORM 1 FROM materials WHERE id=NEW.material_id AND company_id=NEW.company_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_UOM_REFERENCE_INVALID'; END IF;
 SELECT * INTO unit_row FROM units_of_measure WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id AND is_active FOR UPDATE;
 IF NOT FOUND OR NEW.version<>1 OR NEW.stock_precision NOT BETWEEN 0 AND 4 OR NEW.stock_precision<>unit_row.decimal_places
  OR NEW.stock_uom_code<>unit_row.uom_code OR NEW.stock_uom_name<>unit_row.uom_name
  OR NEW.created_at<>transaction_timestamp() OR length(btrim(NEW.reason)) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'MATERIAL_UOM_REFERENCE_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_basis_guard BEFORE INSERT OR UPDATE OR DELETE ON material_uom_bases FOR EACH ROW EXECUTE FUNCTION erp_material_uom_basis_guard();

CREATE FUNCTION erp_material_uom_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE basis material_uom_bases%ROWTYPE; source_unit units_of_measure%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_HISTORY_IMMUTABLE'; END IF;
 PERFORM erp_material_uom_assert_actor(NEW.company_id,NEW.created_by_user_id,NEW.session_id);
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||NEW.company_id::text||':'||NEW.material_id::text,0));
 SELECT * INTO basis FROM material_uom_bases WHERE material_id=NEW.material_id AND company_id=NEW.company_id FOR UPDATE;
 IF NOT FOUND OR NEW.revision_no<>basis.version+1 THEN RAISE EXCEPTION 'MATERIAL_UOM_REVISION_CONFLICT'; END IF;
 PERFORM 1 FROM materials WHERE id=NEW.material_id AND company_id=NEW.company_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_UOM_REFERENCE_INVALID'; END IF;
 PERFORM 1 FROM units_of_measure WHERE id IN (NEW.source_uom_id,basis.stock_uom_id) ORDER BY id FOR UPDATE;
 SELECT * INTO source_unit FROM units_of_measure WHERE id=NEW.source_uom_id AND company_id=NEW.company_id AND is_active;
 IF NOT FOUND OR NEW.source_uom_id=basis.stock_uom_id OR NEW.source_precision<>source_unit.decimal_places
  OR NEW.source_uom_code<>source_unit.uom_code OR NEW.source_uom_name<>source_unit.uom_name
  OR NOT EXISTS(SELECT 1 FROM units_of_measure WHERE id=basis.stock_uom_id AND company_id=NEW.company_id AND is_active AND decimal_places=basis.stock_precision)
  OR NEW.numerator !~ '^[1-9][0-9]{0,37}$' OR NEW.denominator !~ '^[1-9][0-9]{0,37}$'
  OR NEW.created_at<>transaction_timestamp() OR length(btrim(NEW.reason)) NOT BETWEEN 1 AND 2000
 THEN RAISE EXCEPTION 'MATERIAL_UOM_REFERENCE_INVALID'; END IF;
 IF erp_material_uom_gcd(NEW.numerator::numeric,NEW.denominator::numeric)<>1 THEN RAISE EXCEPTION 'MATERIAL_UOM_REFERENCE_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON material_uom_revisions FOR EACH ROW EXECUTE FUNCTION erp_material_uom_revision_guard();
CREATE FUNCTION erp_material_uom_advance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN UPDATE material_uom_bases SET version=NEW.revision_no WHERE material_id=NEW.material_id;RETURN NEW;END $$;
CREATE TRIGGER material_uom_revision_advance AFTER INSERT ON material_uom_revisions FOR EACH ROW EXECUTE FUNCTION erp_material_uom_advance();

CREATE FUNCTION erp_material_uom_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_HISTORY_IMMUTABLE'; END IF;
 PERFORM erp_material_uom_assert_actor(NEW.company_id,NEW.actor_user_id,NEW.session_id);
 IF NEW.created_at<>transaction_timestamp() THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_operation_guard BEFORE INSERT OR UPDATE OR DELETE ON material_uom_operations FOR EACH ROW EXECUTE FUNCTION erp_material_uom_operation_guard();

-- The exact immutable receipt is required in the same transaction as its source.
CREATE FUNCTION erp_material_uom_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE operation_id uuid; o material_uom_operations%ROWTYPE;b material_uom_bases%ROWTYPE;r material_uom_revisions%ROWTYPE;
 expected_input jsonb;expected_outcome jsonb;expected_action text;expected_user uuid;expected_session uuid;expected_company uuid;expected_material uuid;
BEGIN
 IF TG_TABLE_NAME='material_uom_operations' THEN operation_id=NEW.id;ELSE operation_id=NEW.operation_id;END IF;
 SELECT * INTO o FROM material_uom_operations WHERE id=operation_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_REQUIRED'; END IF;
 SELECT * INTO b FROM material_uom_bases WHERE material_uom_bases.operation_id=o.id;
 IF FOUND THEN
  expected_action='PREPARE';expected_user=b.created_by_user_id;expected_session=b.session_id;expected_company=b.company_id;expected_material=b.material_id;
  expected_input=jsonb_build_object('requestKey',o.request_key,'stockUomId',b.stock_uom_id,'reason',b.reason);
  expected_outcome=jsonb_build_object('materialId',b.material_id,'version',1,'revisionId',NULL);
  IF EXISTS(SELECT 1 FROM material_uom_revisions WHERE material_uom_revisions.operation_id=o.id) THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_REQUIRED';END IF;
 ELSE
  SELECT * INTO r FROM material_uom_revisions WHERE material_uom_revisions.operation_id=o.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_REQUIRED'; END IF;
  expected_action='REVISE';expected_user=r.created_by_user_id;expected_session=r.session_id;expected_company=r.company_id;expected_material=r.material_id;
  expected_input=jsonb_build_object('requestKey',o.request_key,'expectedVersion',r.revision_no-1,'sourceUomId',r.source_uom_id,'effectiveFrom',to_char(r.effective_from,'YYYY-MM-DD'),'numerator',r.numerator,'denominator',r.denominator,'reason',r.reason);
  expected_outcome=jsonb_build_object('materialId',r.material_id,'version',r.revision_no,'revisionId',r.id);
 END IF;
 IF o.action<>expected_action OR o.company_id<>expected_company OR o.material_id<>expected_material OR o.actor_user_id<>expected_user OR o.session_id<>expected_session
  OR o.input IS DISTINCT FROM expected_input OR o.outcome IS DISTINCT FROM expected_outcome
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_REQUIRED'; END IF;
 PERFORM erp_material_uom_assert_actor(o.company_id,o.actor_user_id,o.session_id);
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_basis_receipt AFTER INSERT ON material_uom_bases DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_uom_receipt_guard();
CREATE CONSTRAINT TRIGGER material_uom_revision_receipt AFTER INSERT ON material_uom_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_uom_receipt_guard();
CREATE CONSTRAINT TRIGGER material_uom_operation_receipt AFTER INSERT ON material_uom_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_uom_receipt_guard();

CREATE FUNCTION erp_material_uom_unit_pin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.company_id<>OLD.company_id OR NEW.decimal_places<>OLD.decimal_places)
 AND (EXISTS(SELECT 1 FROM material_uom_bases WHERE stock_uom_id=OLD.id) OR EXISTS(SELECT 1 FROM material_uom_revisions WHERE source_uom_id=OLD.id))
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PRECISION_PINNED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_unit_pin BEFORE UPDATE OF company_id,decimal_places ON units_of_measure FOR EACH ROW EXECUTE FUNCTION erp_material_uom_unit_pin();

CREATE FUNCTION erp_material_uom_material_pin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.company_id<>OLD.company_id AND EXISTS(SELECT 1 FROM material_uom_bases WHERE material_id=OLD.id)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_HISTORY_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_material_pin BEFORE UPDATE OF company_id ON materials FOR EACH ROW EXECUTE FUNCTION erp_material_uom_material_pin();
