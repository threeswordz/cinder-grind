-- JAI-ASSET-01: versioned acquisition facts for the existing Equipment ID.
-- Forward-only; no backfill, no posting, no depreciation and no role grant.
CREATE TABLE equipment_asset_register_versions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE RESTRICT,
 equipment_code_snapshot VARCHAR(80) NOT NULL CHECK (equipment_code_snapshot ~ '^CG[0-9]{5}$'),
 version INTEGER NOT NULL CHECK (version > 0),
 previous_version_id UUID REFERENCES equipment_asset_register_versions(id) ON DELETE RESTRICT,
 purchase_date DATE,
 acquisition_value_thb DECIMAL(18,2) CHECK (acquisition_value_thb >= 0),
 evidence_reference VARCHAR(500) NOT NULL CHECK (length(btrim(evidence_reference)) > 0),
 recorded_base_location VARCHAR(300),
 reason VARCHAR(1000) NOT NULL CHECK (length(btrim(reason)) > 0),
 recorded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE (equipment_id,version),
 UNIQUE (previous_version_id),
 CHECK ((version = 1 AND previous_version_id IS NULL) OR (version > 1 AND previous_version_id IS NOT NULL))
);
CREATE INDEX equipment_asset_register_company_equipment_version
 ON equipment_asset_register_versions(company_id,equipment_id,version DESC);
CREATE FUNCTION guard_equipment_asset_register_version() RETURNS trigger AS $$
DECLARE e RECORD; prior RECORD; actor_company UUID;
BEGIN
 IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Asset register versions are immutable'; END IF;
 SELECT company_id,equipment_code INTO e FROM equipment WHERE id=NEW.equipment_id FOR UPDATE;
 SELECT company_id INTO actor_company FROM users WHERE id=NEW.recorded_by_user_id AND is_active;
 IF e.company_id IS NULL OR e.company_id<>NEW.company_id OR e.equipment_code<>NEW.equipment_code_snapshot
  OR actor_company IS NULL OR actor_company<>NEW.company_id THEN
  RAISE EXCEPTION 'Asset register Company, identity or actor mismatch';
 END IF;
 SELECT id,version INTO prior FROM equipment_asset_register_versions
  WHERE equipment_id=NEW.equipment_id ORDER BY version DESC LIMIT 1;
 IF NEW.version<>COALESCE(prior.version,0)+1 OR NEW.previous_version_id IS DISTINCT FROM prior.id THEN
  RAISE EXCEPTION 'Asset register predecessor mismatch';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER equipment_asset_register_version_guard BEFORE INSERT OR UPDATE OR DELETE
 ON equipment_asset_register_versions FOR EACH ROW EXECUTE FUNCTION guard_equipment_asset_register_version();

-- Preserve canonical CG identity once used in either acquisition or custody history.
CREATE FUNCTION protect_equipment_registered_identity() RETURNS trigger AS $$
BEGIN
 IF NEW.equipment_code IS DISTINCT FROM OLD.equipment_code AND
 (EXISTS (SELECT 1 FROM equipment_asset_register_versions v WHERE v.equipment_id=OLD.id)
  OR EXISTS (SELECT 1 FROM equipment_custody_loans l WHERE l.equipment_id=OLD.id)) THEN
  RAISE EXCEPTION 'Registered or loaned Equipment identity is immutable';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER equipment_registered_identity_guard BEFORE UPDATE OF equipment_code ON equipment
 FOR EACH ROW EXECUTE FUNCTION protect_equipment_registered_identity();
