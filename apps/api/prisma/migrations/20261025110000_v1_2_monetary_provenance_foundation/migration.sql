-- DEC-033 / D12-03–04: existing values have no verified denomination.
-- No backfill/default infers THB from today's Company, date or fixture name.
ALTER TABLE projects ADD COLUMN contract_currency_code VARCHAR(3);
ALTER TABLE boqs ADD COLUMN currency_code VARCHAR(3);
ALTER TABLE supplier_quotations ADD COLUMN currency_code VARCHAR(3);
ALTER TABLE quotation_awards ADD COLUMN currency_code VARCHAR(3);

CREATE FUNCTION erp_retain_v12_root_currency() RETURNS trigger AS $$
BEGIN
  IF to_jsonb(NEW)->TG_ARGV[0] IS DISTINCT FROM to_jsonb(OLD)->TG_ARGV[0] THEN
    RAISE EXCEPTION 'Retained monetary root currency is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER projects_contract_currency_immutable BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION erp_retain_v12_root_currency('contract_currency_code');
CREATE TRIGGER boqs_currency_immutable BEFORE UPDATE ON boqs
FOR EACH ROW EXECUTE FUNCTION erp_retain_v12_root_currency('currency_code');
CREATE TRIGGER supplier_quotations_currency_immutable BEFORE UPDATE ON supplier_quotations
FOR EACH ROW EXECUTE FUNCTION erp_retain_v12_root_currency('currency_code');
CREATE TRIGGER quotation_awards_currency_immutable BEFORE UPDATE ON quotation_awards
FOR EACH ROW EXECUTE FUNCTION erp_retain_v12_root_currency('currency_code');
