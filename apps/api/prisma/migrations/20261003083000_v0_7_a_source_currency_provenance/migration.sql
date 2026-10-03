-- Retain currency provenance instead of relabelling historical monetary values.
-- Legacy rows remain NULL: today's Company currency cannot prove their currency.
ALTER TABLE "budget_revisions" ADD COLUMN "currency_code" VARCHAR(3);
ALTER TABLE "purchase_orders" ADD COLUMN "currency_code" VARCHAR(3);

CREATE FUNCTION retain_cost_source_currency()
RETURNS trigger AS $$
DECLARE
  source_currency VARCHAR(3);
  prior_found BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."currency_code" IS DISTINCT FROM OLD."currency_code" THEN
      RAISE EXCEPTION 'Retained source currency is immutable';
    END IF;
    RETURN NEW;
  END IF;

  -- Serialize currency capture against Company settings changes.
  SELECT "base_currency_code" INTO source_currency
  FROM "companies" WHERE "id" = NEW."company_id" FOR SHARE;

  -- A revision must retain the denomination of its existing source chain,
  -- including unknown legacy provenance, rather than invent a conversion.
  IF TG_TABLE_NAME = 'purchase_orders' THEN
    IF NEW."previous_revision_id" IS NOT NULL THEN
      SELECT "currency_code" INTO source_currency
      FROM "purchase_orders" WHERE "id" = NEW."previous_revision_id";
    END IF;
  ELSE
    SELECT "currency_code", TRUE INTO source_currency, prior_found
    FROM "budget_revisions"
    WHERE "company_id" = NEW."company_id"
      AND "project_id" = NEW."project_id"
    ORDER BY "revision_no" DESC LIMIT 1;
    IF NOT COALESCE(prior_found, FALSE) THEN
      SELECT "base_currency_code" INTO source_currency
      FROM "companies" WHERE "id" = NEW."company_id";
    END IF;
  END IF;

  IF NEW."currency_code" IS NOT NULL
     AND NEW."currency_code" IS DISTINCT FROM source_currency THEN
    RAISE EXCEPTION 'Source currency must match verified source provenance';
  END IF;
  NEW."currency_code" := source_currency;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_revisions_currency_provenance
BEFORE INSERT OR UPDATE ON "budget_revisions"
FOR EACH ROW EXECUTE FUNCTION retain_cost_source_currency();

CREATE TRIGGER purchase_orders_currency_provenance
BEFORE INSERT OR UPDATE ON "purchase_orders"
FOR EACH ROW EXECUTE FUNCTION retain_cost_source_currency();
