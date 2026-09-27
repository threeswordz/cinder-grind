CREATE OR REPLACE FUNCTION validate_document_link_scope()
RETURNS trigger AS $$
DECLARE
  document_company UUID;
  linker_company UUID;
  target_company UUID;
  target_project UUID;
BEGIN
  SELECT "company_id" INTO document_company
  FROM "documents" WHERE "id" = NEW."document_id";

  SELECT "company_id" INTO linker_company
  FROM "users" WHERE "id" = NEW."linked_by_user_id";

  IF document_company IS NULL OR linker_company IS NULL
     OR document_company <> linker_company THEN
    RAISE EXCEPTION 'Document and linker must belong to the same Company';
  END IF;

  IF NEW."entity_type" = 'PROJECT' THEN
    SELECT "company_id","id"
      INTO target_company,target_project
    FROM "projects"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'WBS' THEN
    SELECT project."company_id", wbs."project_id"
      INTO target_company,target_project
    FROM "wbs_elements" wbs
    JOIN "projects" project ON project."id" = wbs."project_id"
    WHERE wbs."id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'ACTIVITY' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "activities"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'DAILY_SITE_REPORT' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "daily_site_reports"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'PURCHASE_REQUEST' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "purchase_requests"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'RFQ' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "rfqs"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUPPLIER_QUOTATION' THEN
    SELECT quotation."company_id", rfq."project_id"
      INTO target_company,target_project
    FROM "supplier_quotations" quotation
    JOIN "rfqs" rfq ON rfq."id" = quotation."rfq_id"
    WHERE quotation."id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'PURCHASE_ORDER' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "purchase_orders"
    WHERE "id" = NEW."entity_id";
  ELSE
    RAISE EXCEPTION 'Unsupported Document Link entity type';
  END IF;

  IF target_company IS NULL OR target_project IS NULL THEN
    RAISE EXCEPTION 'Document Link target does not exist';
  END IF;

  IF target_company <> document_company THEN
    RAISE EXCEPTION 'Document Link target must belong to the same Company';
  END IF;

  IF NEW."entity_type" <> 'PROJECT'
     AND NOT EXISTS (
       SELECT 1
       FROM "document_links" project_link
       WHERE project_link."document_id" = NEW."document_id"
         AND project_link."entity_type" = 'PROJECT'
         AND project_link."entity_id" = target_project
     ) THEN
    RAISE EXCEPTION 'Document target link requires a matching Project link';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
