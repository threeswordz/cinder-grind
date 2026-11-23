-- PM02 follow-on, forward-only: real PG17.11 proof caught the original
-- immutable Draft-only line trigger rejecting atomic approval metadata.
-- Retain the original function and every original Company/Project/material/UOM
-- scope assertion. Add only a tightly scoped transaction-local approval
-- exception, never an exception for quantities, descriptions, identities,
-- source lineage, cancel, DELETE or post-approval SQL updates.
-- The source-copy trigger also must admit *approved with returned lines*
-- for the original maker, while preserving ordinary rejected-copy behavior.

CREATE OR REPLACE FUNCTION validate_purchase_request_scope()
RETURNS trigger AS $$
DECLARE
  project_company UUID;
  creator_company UUID;
  submitter_company UUID;
  canceller_company UUID;
  approval_company UUID;
  approval_entity_type VARCHAR(100);
  approval_entity_id UUID;
BEGIN
  SELECT "company_id" INTO project_company FROM "projects" WHERE "id" = NEW."project_id";
  SELECT "company_id" INTO creator_company FROM "users" WHERE "id" = NEW."created_by_user_id";

  IF project_company IS NULL OR project_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Purchase Request Company must match Project Company';
  END IF;

  IF NEW."source_request_id" IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM "purchase_requests" source_pr
      LEFT JOIN "approval_instances" source_approval
        ON source_approval."id" = source_pr."approval_instance_id"
      WHERE source_pr."id" = NEW."source_request_id"
        AND source_pr."company_id" = NEW."company_id"
        AND source_pr."project_id" = NEW."project_id"
        AND (
          (source_approval."approval_state" = 'REJECTED' AND (
            source_pr."created_by_user_id" = NEW."created_by_user_id"
            OR NOT EXISTS (
              SELECT 1 FROM "purchase_request_lines" correction_line
              WHERE correction_line."purchase_request_id" = source_pr."id"
                AND correction_line."correction_source_line_id" IS NOT NULL
            )
          ))
          OR
          (source_approval."approval_state" = 'APPROVED'
            AND source_pr."created_by_user_id" = NEW."created_by_user_id"
            AND EXISTS (
              SELECT 1 FROM "purchase_request_lines" returned_line
              WHERE returned_line."purchase_request_id" = source_pr."id"
                AND returned_line."review_decision" = 'RETURNED'
            )
          )
        )
    ) THEN
      RAISE EXCEPTION 'Purchase Request copy source must be rejected, or approved with returned lines, in the same Company and Project';
    END IF;
  END IF;
  IF creator_company IS NULL OR creator_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Purchase Request creator must belong to the same Company';
  END IF;

  IF NEW."submitted_by_user_id" IS NOT NULL THEN
    SELECT "company_id" INTO submitter_company FROM "users" WHERE "id" = NEW."submitted_by_user_id";
    IF submitter_company IS NULL OR submitter_company <> NEW."company_id" THEN
      RAISE EXCEPTION 'Purchase Request submitter must belong to the same Company';
    END IF;
  END IF;

  IF NEW."cancelled_by_user_id" IS NOT NULL THEN
    SELECT "company_id" INTO canceller_company FROM "users" WHERE "id" = NEW."cancelled_by_user_id";
    IF canceller_company IS NULL OR canceller_company <> NEW."company_id" THEN
      RAISE EXCEPTION 'Purchase Request canceller must belong to the same Company';
    END IF;
  END IF;

  IF NEW."approval_instance_id" IS NOT NULL THEN
    SELECT "company_id","entity_type","entity_id"
      INTO approval_company,approval_entity_type,approval_entity_id
    FROM "approval_instances"
    WHERE "id" = NEW."approval_instance_id";

    IF approval_company IS NULL
       OR approval_company <> NEW."company_id"
       OR approval_entity_type <> 'PURCHASE_REQUEST'
       OR approval_entity_id <> NEW."id" THEN
      RAISE EXCEPTION 'Purchase Request approval instance is inconsistent';
    END IF;
  END IF;

  IF (NEW."cancelled_at" IS NULL) <> (NEW."cancelled_by_user_id" IS NULL) THEN
    RAISE EXCEPTION 'Purchase Request cancellation actor and timestamp must be recorded together';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_purchase_request_line_scope()
RETURNS trigger AS $$
DECLARE
  pr_company UUID;
  pr_project UUID;
  pr_approval UUID;
  pr_submitted TIMESTAMPTZ;
  pr_cancelled TIMESTAMPTZ;
  material_company UUID;
  material_active BOOLEAN;
  uom_company UUID;
  uom_active BOOLEAN;
  wbs_project UUID;
  wbs_active BOOLEAN;
  cost_company UUID;
  cost_active BOOLEAN;
  activity_company UUID;
  activity_project UUID;
  activity_active BOOLEAN;
BEGIN
  SELECT "company_id","project_id","approval_instance_id","submitted_at","cancelled_at"
    INTO pr_company,pr_project,pr_approval,pr_submitted,pr_cancelled
  FROM "purchase_requests"
  WHERE "id" = NEW."purchase_request_id";

  IF pr_company IS NULL THEN
    RAISE EXCEPTION 'Purchase Request not found for line';
  END IF;
  IF pr_approval IS NOT NULL OR pr_submitted IS NOT NULL OR pr_cancelled IS NOT NULL THEN
    -- Preserve all prior Draft-only business-data protections. The sole
    -- exception is a transaction-scoped, audited PM02 review-decision update,
    -- following a configured final approval in the *same* DB transaction.
    IF TG_OP = 'UPDATE'
       AND pr_cancelled IS NULL
       AND pr_approval IS NOT NULL
       AND pr_submitted IS NOT NULL
       AND current_setting('erp.pm02_review_instance', true) = pr_approval::text
       AND current_setting('erp.pm02_review_actor', true) = NEW."reviewed_by_user_id"::text
       AND OLD."review_decision" IS NULL
       AND OLD."review_reason" IS NULL
       AND OLD."reviewed_by_user_id" IS NULL
       AND OLD."reviewed_at" IS NULL
       AND NEW."review_decision" IN ('APPROVED', 'RETURNED')
       AND NEW."reviewed_by_user_id" IS NOT NULL
       AND NEW."reviewed_at" IS NOT NULL
       AND (to_jsonb(NEW) - ARRAY['review_decision','review_reason',
             'reviewed_by_user_id','reviewed_at','updated_at'])
           IS NOT DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['review_decision','review_reason',
             'reviewed_by_user_id','reviewed_at','updated_at'])
       AND EXISTS (
         SELECT 1 FROM "approval_instances" approval
         JOIN "approval_actions" action
           ON action."approval_instance_id" = approval."id"
         WHERE approval."id" = pr_approval
           AND approval."entity_type" = 'PURCHASE_REQUEST'
           AND approval."entity_id" = NEW."purchase_request_id"
           AND approval."approval_state" = 'APPROVED'
           AND action."action" = 'APPROVE'
           AND action."action_by_user_id" = NEW."reviewed_by_user_id"
       )
    THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only Draft Purchase Request lines are editable';
  END IF;

  SELECT "company_id","is_active" INTO uom_company,uom_active
  FROM "units_of_measure" WHERE "id" = NEW."uom_id";
  IF uom_company IS NULL OR uom_company <> pr_company OR NOT uom_active THEN
    RAISE EXCEPTION 'Purchase Request line UOM must be active and belong to the same Company';
  END IF;

  IF NEW."line_type" = 'MATERIAL' THEN
    SELECT "company_id","is_active" INTO material_company,material_active
    FROM "materials" WHERE "id" = NEW."material_id";
    IF material_company IS NULL OR material_company <> pr_company OR NOT material_active THEN
      RAISE EXCEPTION 'Purchase Request Material must be active and belong to the same Company';
    END IF;
  ELSIF NEW."material_id" IS NOT NULL THEN
    RAISE EXCEPTION 'Service Purchase Request line cannot reference a Material';
  END IF;

  IF NEW."wbs_id" IS NOT NULL THEN
    SELECT "project_id","is_active" INTO wbs_project,wbs_active
    FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
    IF wbs_project IS NULL OR wbs_project <> pr_project OR NOT wbs_active THEN
      RAISE EXCEPTION 'Purchase Request WBS must be active and belong to the same Project';
    END IF;
  END IF;

  IF NEW."cost_code_id" IS NOT NULL THEN
    SELECT "company_id","is_active" INTO cost_company,cost_active
    FROM "cost_codes" WHERE "id" = NEW."cost_code_id";
    IF cost_company IS NULL OR cost_company <> pr_company OR NOT cost_active THEN
      RAISE EXCEPTION 'Purchase Request Cost Code must be active and belong to the same Company';
    END IF;
  END IF;

  IF NEW."activity_id" IS NOT NULL THEN
    SELECT "company_id","project_id","is_active" INTO activity_company,activity_project,activity_active
    FROM "activities" WHERE "id" = NEW."activity_id";
    IF activity_company IS NULL
       OR activity_company <> pr_company
       OR activity_project <> pr_project
       OR NOT activity_active THEN
      RAISE EXCEPTION 'Purchase Request Activity must be active and belong to the same Project';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
