-- CreateTable
CREATE TABLE "subcontract_physical_policies" (
    "project_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "enabled_by_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "synthetic_only" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcontract_physical_policies_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "subcontract_physical_claims" (
    "claim_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "agreement_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcontract_physical_claims_pkey" PRIMARY KEY ("claim_id")
);

-- CreateTable
CREATE TABLE "subcontract_physical_revisions" (
    "id" UUID NOT NULL,
    "claim_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "observations" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcontract_physical_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subcontract_physical_submissions" (
    "claim_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "source_digest" VARCHAR(64) NOT NULL,
    "commercial_source" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcontract_physical_submissions_pkey" PRIMARY KEY ("claim_id")
);

-- CreateTable
CREATE TABLE "subcontract_physical_decisions" (
    "claim_id" UUID NOT NULL,
    "assessment_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "decisions" JSONB NOT NULL,
    "assessed_amount" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcontract_physical_decisions_pkey" PRIMARY KEY ("claim_id")
);

-- CreateTable
CREATE TABLE "subcontract_physical_operations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "request_key" UUID NOT NULL,
    "claim_id" UUID,
    "project_id" UUID NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "body_digest" VARCHAR(64) NOT NULL,
    "outcome" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subcontract_physical_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subcontract_physical_revisions_claim_id_version_key" ON "subcontract_physical_revisions"("claim_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "subcontract_physical_submissions_revision_id_key" ON "subcontract_physical_submissions"("revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "subcontract_physical_decisions_assessment_id_key" ON "subcontract_physical_decisions"("assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "subcontract_physical_operations_company_id_actor_user_id_re_key" ON "subcontract_physical_operations"("company_id", "actor_user_id", "request_key");

-- New opt-in source facts only. No historic claim, role or monetary backfill.
ALTER TABLE subcontract_physical_policies
  ADD CONSTRAINT physical_policy_project_fk FOREIGN KEY(company_id,project_id) REFERENCES projects(company_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_policy_actor_fk FOREIGN KEY(company_id,enabled_by_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_policy_synthetic CHECK(synthetic_only AND length(btrim(reason)) BETWEEN 1 AND 2000);
ALTER TABLE subcontract_physical_claims
  ADD CONSTRAINT physical_claim_source_fk FOREIGN KEY(company_id,project_id,agreement_id,claim_id) REFERENCES subcontract_claims(company_id,project_id,agreement_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_claim_version CHECK(version>0);
ALTER TABLE subcontract_physical_revisions
  ADD CONSTRAINT physical_revision_claim_fk FOREIGN KEY(claim_id) REFERENCES subcontract_physical_claims(claim_id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_revision_actor_fk FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_revision_shape CHECK(version>1 AND length(btrim(reason)) BETWEEN 1 AND 2000 AND jsonb_typeof(observations)='array' AND jsonb_array_length(observations) BETWEEN 1 AND 100);
ALTER TABLE subcontract_physical_submissions
  ADD CONSTRAINT physical_submission_claim_fk FOREIGN KEY(claim_id) REFERENCES subcontract_physical_claims(claim_id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_submission_revision_fk FOREIGN KEY(revision_id) REFERENCES subcontract_physical_revisions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_submission_actor_fk FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_submission_digest CHECK(source_digest ~ '^[a-f0-9]{64}$');
ALTER TABLE subcontract_physical_decisions
  ADD CONSTRAINT physical_decision_submission_fk FOREIGN KEY(claim_id) REFERENCES subcontract_physical_submissions(claim_id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_decision_assessment_fk FOREIGN KEY(assessment_id) REFERENCES subcontract_claim_assessments(id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_decision_actor_fk FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_decision_shape CHECK(assessed_amount>=0 AND length(btrim(reason)) BETWEEN 1 AND 2000 AND jsonb_typeof(decisions)='array');
ALTER TABLE subcontract_physical_operations
  ADD CONSTRAINT physical_operation_actor_fk FOREIGN KEY(company_id,actor_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_operation_project_fk FOREIGN KEY(company_id,project_id) REFERENCES projects(company_id,id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_operation_claim_fk FOREIGN KEY(claim_id) REFERENCES subcontract_physical_claims(claim_id) ON DELETE RESTRICT,
  ADD CONSTRAINT physical_operation_shape CHECK(action IN('ENABLE','CAPTURE') AND body_digest ~ '^[a-f0-9]{64}$');

INSERT INTO permissions(id,permission_code,module_code,description) VALUES
 ('f0480000-0000-4000-8000-000000000001','subcontracts.physical.view','SUBCONTRACTS','View scoped physical observations and held work; no implicit commercial decision authority.'),
 ('f0480000-0000-4000-8000-000000000002','subcontracts.physical.edit','SUBCONTRACTS','Capture reasoned physical source revisions for an explicitly controlled new claim.'),
 ('f0480000-0000-4000-8000-000000000003','subcontracts.physical.decide','SUBCONTRACTS','Independently decide accepted and held work with explicit accepted monetary allocations.'),
 ('f0480000-0000-4000-8000-000000000004','subcontracts.physical.configure','SUBCONTRACTS','Explicitly enable new physical claim provenance in a non-Production synthetic Project.');

CREATE FUNCTION erp_physical_actor(p_user uuid,p_company uuid,p_permission text) RETURNS boolean
LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users u JOIN companies c ON c.id=u.company_id
   JOIN employees e ON e.id=u.employee_id AND e.company_id=u.company_id
   JOIN user_roles ur ON ur.user_id=u.id AND ur.company_id=u.company_id
   JOIN roles r ON r.id=ur.role_id AND r.company_id=u.company_id
   JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
   WHERE u.id=p_user AND u.company_id=p_company AND u.is_active AND e.is_active AND c.is_active AND r.is_active
     AND p.permission_code=p_permission)
$$;

CREATE FUNCTION erp_physical_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PHYSICAL_HISTORY_IMMUTABLE'; END $$;
CREATE TRIGGER physical_policy_immutable BEFORE UPDATE OR DELETE ON subcontract_physical_policies FOR EACH ROW EXECUTE FUNCTION erp_physical_immutable();
CREATE TRIGGER physical_revision_immutable BEFORE UPDATE OR DELETE ON subcontract_physical_revisions FOR EACH ROW EXECUTE FUNCTION erp_physical_immutable();
CREATE TRIGGER physical_submission_immutable BEFORE UPDATE OR DELETE ON subcontract_physical_submissions FOR EACH ROW EXECUTE FUNCTION erp_physical_immutable();
CREATE TRIGGER physical_decision_immutable BEFORE UPDATE OR DELETE ON subcontract_physical_decisions FOR EACH ROW EXECUTE FUNCTION erp_physical_immutable();
CREATE TRIGGER physical_operation_immutable BEFORE UPDATE OR DELETE ON subcontract_physical_operations FOR EACH ROW EXECUTE FUNCTION erp_physical_immutable();

CREATE FUNCTION erp_physical_policy_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('physical-project:'||NEW.project_id::text,0));
 IF NOT erp_physical_actor(NEW.enabled_by_user_id,NEW.company_id,'subcontracts.physical.configure') OR
    NOT EXISTS(SELECT 1 FROM projects WHERE id=NEW.project_id AND company_id=NEW.company_id AND is_active) THEN
   RAISE EXCEPTION 'PHYSICAL_POLICY_DENIED';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_policy_insert BEFORE INSERT ON subcontract_physical_policies FOR EACH ROW EXECUTE FUNCTION erp_physical_policy_insert();

CREATE FUNCTION erp_physical_new_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('physical-project:'||NEW.project_id::text,0));
 IF EXISTS(SELECT 1 FROM subcontract_physical_policies WHERE project_id=NEW.project_id AND company_id=NEW.company_id) THEN
   INSERT INTO subcontract_physical_claims(claim_id,company_id,project_id,agreement_id,created_at)
     VALUES(NEW.id,NEW.company_id,NEW.project_id,NEW.agreement_id,NEW.created_at);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_new_claim AFTER INSERT ON subcontract_claims FOR EACH ROW EXECUTE FUNCTION erp_physical_new_claim();

CREATE FUNCTION erp_physical_claim_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c subcontract_claims%ROWTYPE;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'PHYSICAL_HISTORY_IMMUTABLE'; END IF;
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=NEW.claim_id FOR UPDATE;
 IF TG_OP='INSERT' THEN
   IF NEW.version<>1 OR NEW.created_at<>c.created_at OR NOT EXISTS(
      SELECT 1 FROM subcontract_physical_policies p WHERE p.project_id=c.project_id AND p.company_id=c.company_id AND p.created_at<=c.created_at) THEN
     RAISE EXCEPTION 'PHYSICAL_NEW_CLAIM_PROVENANCE_REQUIRED';
   END IF;
 ELSE
   IF (to_jsonb(NEW)-'version') IS DISTINCT FROM (to_jsonb(OLD)-'version') OR NEW.version<>OLD.version+1 OR c.state<>'DRAFT' OR
     EXISTS(SELECT 1 FROM subcontract_physical_submissions WHERE claim_id=NEW.claim_id) THEN RAISE EXCEPTION 'PHYSICAL_SOURCE_FROZEN'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_claim_guard BEFORE INSERT OR UPDATE OR DELETE ON subcontract_physical_claims FOR EACH ROW EXECUTE FUNCTION erp_physical_claim_guard();

CREATE FUNCTION erp_physical_commercial_source(p_claim uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('claimId',c.id,'companyId',c.company_id,'projectId',c.project_id,'agreementId',c.agreement_id,
  'periodStart',c.period_start::text,'periodEnd',c.period_end::text,'currencyCode',c.currency_code,
  'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'amount',l.amount::text,'workOrderId',l.work_order_id) ORDER BY l.id)
    FROM subcontract_claim_lines l WHERE l.claim_id=c.id),'[]'::jsonb))
 FROM subcontract_claims c WHERE c.id=p_claim
$$;

CREATE FUNCTION erp_physical_revision_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c subcontract_claims%ROWTYPE; v integer; o jsonb; ids uuid[]:=ARRAY[]::uuid[]; oid uuid;
BEGIN
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=NEW.claim_id FOR UPDATE;
 SELECT version INTO STRICT v FROM subcontract_physical_claims WHERE claim_id=c.id;
 IF c.state<>'DRAFT' OR NEW.version<>v OR NOT erp_physical_actor(NEW.actor_user_id,c.company_id,'subcontracts.physical.edit') OR
    NOT erp_physical_actor(NEW.actor_user_id,c.company_id,'subcontracts.claim.edit') THEN RAISE EXCEPTION 'PHYSICAL_CAPTURE_DENIED'; END IF;
 FOR o IN SELECT * FROM jsonb_array_elements(NEW.observations) LOOP
   oid:=(o->>'id')::uuid;
   IF oid IS NULL OR oid=ANY(ids) OR NOT EXISTS(SELECT 1 FROM subcontract_claim_lines WHERE id=(o->>'claimLineId')::uuid AND claim_id=c.id) OR
      NOT (coalesce(o->>'basis','')=ANY(ARRAY['MEASURED','MILESTONE','LUMP_SUM'])) OR
      length(btrim(coalesce(o->>'item',''))) NOT BETWEEN 1 AND 2000 OR length(btrim(coalesce(o->>'location',''))) NOT BETWEEN 1 AND 2000 OR
      length(btrim(coalesce(o->>'reason',''))) NOT BETWEEN 1 AND 2000 OR
      jsonb_typeof(o->'progressPercent') IS DISTINCT FROM 'string' OR (o->>'progressPercent')!~'^(0|[1-9][0-9]{0,2})(\.[0-9]{1,4})?$' OR
      (o->>'progressPercent')::numeric>100 OR jsonb_typeof(o->'documentIds') IS DISTINCT FROM 'array' OR jsonb_array_length(o->'documentIds')>20 THEN
     RAISE EXCEPTION 'PHYSICAL_OBSERVATION_INVALID';
   END IF;
   IF EXISTS(SELECT 1 FROM subcontract_physical_revisions r CROSS JOIN LATERAL jsonb_array_elements(r.observations) x
      WHERE r.claim_id<>c.id AND x->>'id'=oid::text) THEN RAISE EXCEPTION 'PHYSICAL_OBSERVATION_ID_REUSED'; END IF;
   ids:=array_append(ids,oid);
   IF o->>'basis'='MEASURED' THEN
     IF jsonb_typeof(o->'quantity') IS DISTINCT FROM 'string' OR (o->>'quantity')!~'^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$' OR (o->>'quantity')::numeric<=0 OR
        NOT EXISTS(SELECT 1 FROM units_of_measure WHERE id=(o->>'uomId')::uuid AND company_id=c.company_id AND is_active) THEN
       RAISE EXCEPTION 'PHYSICAL_MEASUREMENT_INVALID';
     END IF;
   ELSE
     IF o->'quantity' IS DISTINCT FROM 'null'::jsonb OR o->'uomId' IS DISTINCT FROM 'null'::jsonb OR
        length(btrim(coalesce(o->>'basisDescription',''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'PHYSICAL_BASIS_REQUIRED'; END IF;
   END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_revision_insert BEFORE INSERT ON subcontract_physical_revisions FOR EACH ROW EXECUTE FUNCTION erp_physical_revision_insert();

CREATE FUNCTION erp_physical_evidence(p_claim uuid,p_revision uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE evidence_ids uuid[]; result jsonb; c subcontract_claims%ROWTYPE;
BEGIN
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=p_claim;
 SELECT array_agg(DISTINCT value::uuid) INTO evidence_ids FROM subcontract_physical_revisions r
   CROSS JOIN LATERAL jsonb_array_elements(r.observations) o
   CROSS JOIN LATERAL jsonb_array_elements_text(o->'documentIds') value WHERE r.id=p_revision AND r.claim_id=p_claim;
 IF coalesce(array_length(evidence_ids,1),0)=0 OR EXISTS(
   SELECT 1 FROM unnest(evidence_ids) id LEFT JOIN documents d ON d.id=id
   LEFT JOIN document_types t ON t.id=d.document_type_id
   WHERE d.id IS NULL OR d.company_id<>c.company_id OR NOT d.is_active OR d.checksum IS NULL OR d.checksum!~'^[a-f0-9]{64}$' OR t.document_type_code LIKE 'HR\_%' OR
     EXISTS(SELECT 1 FROM hr_document_attachments WHERE document_id=d.id) OR
     NOT EXISTS(SELECT 1 FROM document_links WHERE document_id=d.id AND entity_type='SUBCONTRACT_CLAIM' AND entity_id=c.id) OR
     NOT EXISTS(SELECT 1 FROM document_links WHERE document_id=d.id AND entity_type='PROJECT' AND entity_id=c.project_id)) THEN
   RAISE EXCEPTION 'PHYSICAL_EVIDENCE_REQUIRED';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id,'checksum',checksum,'size',file_size_bytes,'fileName',file_name,'mimeType',mime_type) ORDER BY id)
   INTO result FROM documents WHERE id=ANY(evidence_ids);
 RETURN result;
END $$;

CREATE FUNCTION erp_physical_submission_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c subcontract_claims%ROWTYPE; r subcontract_physical_revisions%ROWTYPE; v integer;
BEGIN
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=NEW.claim_id FOR UPDATE;
 SELECT * INTO STRICT r FROM subcontract_physical_revisions WHERE id=NEW.revision_id AND claim_id=c.id;
 SELECT version INTO STRICT v FROM subcontract_physical_claims WHERE claim_id=c.id;
 IF c.state<>'DRAFT' OR r.version<>v OR NOT erp_physical_actor(NEW.actor_user_id,c.company_id,'subcontracts.physical.edit') OR
    NOT erp_physical_actor(NEW.actor_user_id,c.company_id,'subcontracts.claim.submit') THEN RAISE EXCEPTION 'PHYSICAL_SUBMIT_DENIED'; END IF;
 IF EXISTS(SELECT 1 FROM subcontract_claim_lines l WHERE l.claim_id=c.id AND NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(r.observations) o WHERE o->>'claimLineId'=l.id::text)) THEN RAISE EXCEPTION 'PHYSICAL_ALL_LINES_REQUIRED'; END IF;
 PERFORM erp_physical_assert_rework(c.id,r.observations);
 NEW.commercial_source:=erp_physical_commercial_source(c.id);
 NEW.evidence:=erp_physical_evidence(c.id,r.id);
 NEW.source_digest:=encode(sha256(convert_to(jsonb_build_object('revisionId',r.id,'observations',r.observations,
    'commercialSource',NEW.commercial_source,'evidence',NEW.evidence,'actorUserId',NEW.actor_user_id)::text,'UTF8')),'hex');
 RETURN NEW;
END $$;
CREATE TRIGGER physical_submission_insert BEFORE INSERT ON subcontract_physical_submissions FOR EACH ROW EXECUTE FUNCTION erp_physical_submission_insert();

CREATE FUNCTION erp_physical_assert_source(p_claim uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s subcontract_physical_submissions%ROWTYPE; r subcontract_physical_revisions%ROWTYPE; v integer;
BEGIN
 SELECT * INTO STRICT s FROM subcontract_physical_submissions WHERE claim_id=p_claim;
 SELECT * INTO STRICT r FROM subcontract_physical_revisions WHERE id=s.revision_id AND claim_id=p_claim;
 SELECT version INTO STRICT v FROM subcontract_physical_claims WHERE claim_id=p_claim;
 IF r.version<>v OR s.commercial_source IS DISTINCT FROM erp_physical_commercial_source(p_claim) OR
    s.evidence IS DISTINCT FROM erp_physical_evidence(p_claim,r.id) THEN RAISE EXCEPTION 'PHYSICAL_SOURCE_CHANGED'; END IF;
 PERFORM erp_physical_assert_rework(p_claim,r.observations);
END $$;

-- An enabled claim fails closed until its physical source and canonical
-- assessment are committed atomically; legacy claims are unaffected.
CREATE FUNCTION erp_physical_claim_commit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c subcontract_claims%ROWTYPE;
BEGIN
 SELECT * INTO c FROM subcontract_claims WHERE id=NEW.id;
 IF NOT EXISTS(SELECT 1 FROM subcontract_physical_claims WHERE claim_id=c.id) THEN RETURN NULL; END IF;
 IF c.state IN('SUBMITTED','ASSESSED') THEN PERFORM erp_physical_assert_source(c.id); END IF;
 IF c.state='ASSESSED' AND NOT EXISTS(
   SELECT 1 FROM subcontract_physical_decisions d JOIN subcontract_claim_assessments a ON a.id=d.assessment_id
   WHERE d.claim_id=c.id AND a.claim_id=c.id AND a.state='ASSESSED' AND a.assessed_amount=d.assessed_amount AND a.assessed_by_user_id=d.actor_user_id) THEN
   RAISE EXCEPTION 'PHYSICAL_DECISION_REQUIRED';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER physical_claim_commit AFTER INSERT OR UPDATE ON subcontract_claims DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_physical_claim_commit();

CREATE FUNCTION erp_physical_assert_rework(p_claim uuid,p_observations jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c subcontract_claims%ROWTYPE; o jsonb; original jsonb; original_decision jsonb; source_claim uuid; source_state text;
  reserved numeric; requested numeric; source_held numeric;
BEGIN
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=p_claim;
 PERFORM id FROM subcontract_agreements WHERE id=c.agreement_id FOR UPDATE;
 FOR o IN SELECT * FROM jsonb_array_elements(p_observations) WHERE value->>'heldSourceId' IS NOT NULL LOOP
   SELECT x,d,s.claim_id,sc.state INTO original,original_decision,source_claim,source_state
   FROM subcontract_physical_submissions s JOIN subcontract_physical_revisions r ON r.id=s.revision_id
   JOIN subcontract_physical_decisions pd ON pd.claim_id=s.claim_id JOIN subcontract_claims sc ON sc.id=s.claim_id
   CROSS JOIN LATERAL jsonb_array_elements(r.observations) x
   CROSS JOIN LATERAL jsonb_array_elements(pd.decisions) d
   WHERE x->>'id'=o->>'heldSourceId' AND d->>'observationId'=x->>'id' AND sc.agreement_id=c.agreement_id AND sc.id<>c.id;
   IF original IS NULL OR (source_state<>'ASSESSED' AND NOT EXISTS(
      WITH RECURSIVE ancestors(id) AS (
        SELECT replacement_for_claim_id FROM subcontract_claims WHERE id=c.id
        UNION SELECT sc.replacement_for_claim_id FROM subcontract_claims sc JOIN ancestors a ON sc.id=a.id WHERE sc.replacement_for_claim_id IS NOT NULL)
      SELECT 1 FROM ancestors WHERE id=source_claim)) OR
      (o->>'basis',o->>'item',o->>'location',o->>'basisDescription',o->>'uomId') IS DISTINCT FROM
      (original->>'basis',original->>'item',original->>'location',original->>'basisDescription',original->>'uomId') THEN
     RAISE EXCEPTION 'PHYSICAL_HELD_SOURCE_INVALID';
   END IF;
   IF o->>'basis'='MEASURED' THEN
     source_held:=(original_decision->>'heldQuantity')::numeric;
     SELECT coalesce(sum((x->>'quantity')::numeric),0) INTO reserved
       FROM subcontract_physical_submissions s JOIN subcontract_physical_revisions r ON r.id=s.revision_id
       JOIN subcontract_claims sc ON sc.id=s.claim_id CROSS JOIN LATERAL jsonb_array_elements(r.observations) x
       WHERE sc.agreement_id=c.agreement_id AND sc.id<>c.id AND sc.state IN('SUBMITTED','ASSESSED') AND x->>'heldSourceId'=o->>'heldSourceId';
     SELECT coalesce(sum((x->>'quantity')::numeric),0) INTO requested FROM jsonb_array_elements(p_observations) x WHERE x->>'heldSourceId'=o->>'heldSourceId';
     IF source_held IS NULL OR source_held<=0 OR reserved+requested>source_held THEN RAISE EXCEPTION 'PHYSICAL_HELD_QUANTITY_ALREADY_ASSIGNED'; END IF;
   ELSE
     SELECT count(*) INTO reserved
       FROM subcontract_physical_submissions s JOIN subcontract_physical_revisions r ON r.id=s.revision_id
       JOIN subcontract_claims sc ON sc.id=s.claim_id CROSS JOIN LATERAL jsonb_array_elements(r.observations) x
       WHERE sc.agreement_id=c.agreement_id AND sc.id<>c.id AND sc.state IN('SUBMITTED','ASSESSED') AND x->>'heldSourceId'=o->>'heldSourceId';
     SELECT count(*) INTO requested FROM jsonb_array_elements(p_observations) x WHERE x->>'heldSourceId'=o->>'heldSourceId';
     IF (original_decision->>'accepted')::boolean OR reserved+requested>1 THEN RAISE EXCEPTION 'PHYSICAL_HELD_BASIS_ALREADY_ASSIGNED'; END IF;
   END IF;
 END LOOP;
END $$;

CREATE FUNCTION erp_physical_decision_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c subcontract_claims%ROWTYPE; s subcontract_physical_submissions%ROWTYPE; r subcontract_physical_revisions%ROWTYPE;
  a subcontract_claim_assessments%ROWTYPE; d jsonb; o jsonb; seen uuid[]:=ARRAY[]::uuid[]; accepted numeric; held numeric; amount numeric; total numeric:=0;
BEGIN
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=NEW.claim_id FOR UPDATE;
 SELECT * INTO STRICT s FROM subcontract_physical_submissions WHERE claim_id=c.id;
 SELECT * INTO STRICT r FROM subcontract_physical_revisions WHERE id=s.revision_id;
 SELECT * INTO STRICT a FROM subcontract_claim_assessments WHERE id=NEW.assessment_id AND claim_id=c.id;
 PERFORM erp_physical_assert_source(c.id);
 PERFORM erp_physical_assert_rework(c.id,r.observations);
 IF c.state<>'SUBMITTED' OR NEW.actor_user_id IN(c.created_by_user_id,c.submitted_by_user_id,s.actor_user_id,r.actor_user_id) OR
    a.assessed_by_user_id<>NEW.actor_user_id OR a.assessed_amount<>NEW.assessed_amount OR a.state<>'ASSESSED' OR
    NOT erp_physical_actor(NEW.actor_user_id,c.company_id,'subcontracts.physical.decide') OR
    NOT erp_physical_actor(NEW.actor_user_id,c.company_id,'subcontracts.assessment.assess') OR
    jsonb_array_length(NEW.decisions)<>jsonb_array_length(r.observations) THEN RAISE EXCEPTION 'PHYSICAL_INDEPENDENT_DECISION_REQUIRED'; END IF;
 FOR d IN SELECT * FROM jsonb_array_elements(NEW.decisions) LOOP
   SELECT value INTO o FROM jsonb_array_elements(r.observations) WHERE value->>'id'=d->>'observationId';
   IF o IS NULL OR (d->>'observationId')::uuid=ANY(seen) OR d->>'claimLineId' IS DISTINCT FROM o->>'claimLineId' OR
      jsonb_typeof(d->'acceptedAmount') IS DISTINCT FROM 'string' OR (d->>'acceptedAmount')!~'^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$' OR
      length(btrim(coalesce(d->>'reason',''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'PHYSICAL_DECISION_INVALID'; END IF;
   seen:=array_append(seen,(d->>'observationId')::uuid); amount:=(d->>'acceptedAmount')::numeric;
   IF o->>'basis'='MEASURED' THEN
     IF jsonb_typeof(d->'acceptedQuantity') IS DISTINCT FROM 'string' OR (d->>'acceptedQuantity')!~'^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$' THEN
       RAISE EXCEPTION 'PHYSICAL_ACCEPTED_QUANTITY_INVALID';
     END IF;
     accepted:=(d->>'acceptedQuantity')::numeric; held:=(o->>'quantity')::numeric-accepted;
     IF accepted<0 OR held<0 OR jsonb_typeof(d->'heldQuantity') IS DISTINCT FROM 'string' OR (d->>'heldQuantity')::numeric<>held OR
        jsonb_typeof(d->'accepted') IS DISTINCT FROM 'boolean' OR (d->>'accepted')::boolean IS DISTINCT FROM (accepted>0) THEN
       RAISE EXCEPTION 'PHYSICAL_ACCEPTED_QUANTITY_INVALID';
     END IF;
   ELSE
     IF jsonb_typeof(d->'accepted') IS DISTINCT FROM 'boolean' OR d->'acceptedQuantity' IS DISTINCT FROM 'null'::jsonb OR d->'heldQuantity' IS DISTINCT FROM 'null'::jsonb THEN
       RAISE EXCEPTION 'PHYSICAL_ACCEPTED_BASIS_INVALID';
     END IF;
     accepted:=CASE WHEN (d->>'accepted')::boolean THEN 1 ELSE 0 END; held:=1-accepted;
   END IF;
   IF (accepted=0 AND amount<>0) OR (held>0 AND coalesce(d->>'heldDisposition','') NOT IN('REWORK','REJECTED')) OR
      (held=0 AND d->'heldDisposition' IS DISTINCT FROM 'null'::jsonb) THEN RAISE EXCEPTION 'PHYSICAL_HELD_ALLOCATION_INVALID'; END IF;
   total:=total+amount;
 END LOOP;
 IF total<>NEW.assessed_amount OR EXISTS(
   SELECT 1 FROM jsonb_array_elements(NEW.decisions) d GROUP BY d->>'claimLineId'
   HAVING sum((d->>'acceptedAmount')::numeric)>(SELECT amount FROM subcontract_claim_lines WHERE id=(d->>'claimLineId')::uuid AND claim_id=c.id)) THEN
   RAISE EXCEPTION 'PHYSICAL_ACCEPTED_AMOUNT_INVALID';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_decision_insert BEFORE INSERT ON subcontract_physical_decisions FOR EACH ROW EXECUTE FUNCTION erp_physical_decision_insert();

CREATE FUNCTION erp_physical_assessment_commit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a subcontract_claim_assessments%ROWTYPE;
BEGIN
 SELECT * INTO a FROM subcontract_claim_assessments WHERE id=NEW.id;
 IF a.state='ASSESSED' AND EXISTS(SELECT 1 FROM subcontract_physical_claims WHERE claim_id=a.claim_id) THEN
   PERFORM erp_physical_assert_source(a.claim_id);
   IF NOT EXISTS(SELECT 1 FROM subcontract_physical_decisions WHERE claim_id=a.claim_id AND assessment_id=a.id
     AND actor_user_id=a.assessed_by_user_id AND assessed_amount=a.assessed_amount) THEN RAISE EXCEPTION 'PHYSICAL_DECISION_REQUIRED'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER physical_assessment_commit AFTER INSERT OR UPDATE ON subcontract_claim_assessments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_physical_assessment_commit();

CREATE FUNCTION erp_physical_certification_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.state IN('DRAFT','SUBMITTED','APPROVED') AND EXISTS(SELECT 1 FROM subcontract_physical_claims WHERE claim_id=NEW.claim_id) THEN
   PERFORM erp_physical_assert_source(NEW.claim_id);
   IF NOT EXISTS(SELECT 1 FROM subcontract_physical_decisions d WHERE d.claim_id=NEW.claim_id AND d.assessment_id=NEW.assessment_id
      AND d.assessed_amount>=NEW.certified_gross AND EXISTS(SELECT 1 FROM jsonb_array_elements(d.decisions) x WHERE x->>'accepted'='true')) THEN
     RAISE EXCEPTION 'PHYSICAL_CERTIFICATION_NOT_ELIGIBLE';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_certification_guard BEFORE INSERT OR UPDATE ON subcontract_certifications FOR EACH ROW EXECUTE FUNCTION erp_physical_certification_guard();

CREATE FUNCTION erp_physical_rework_correction_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.state IN('SUBMITTED','ASSESSED') AND NEW.state IN('REPLACED','REJECTED','WITHDRAWN') AND EXISTS(
   SELECT 1 FROM subcontract_physical_submissions original JOIN subcontract_physical_revisions original_r ON original_r.id=original.revision_id
   CROSS JOIN LATERAL jsonb_array_elements(original_r.observations) original_o
   JOIN subcontract_physical_revisions child_r ON child_r.claim_id<>OLD.id
   JOIN subcontract_physical_submissions child_s ON child_s.revision_id=child_r.id
   JOIN subcontract_claims child_c ON child_c.id=child_r.claim_id AND child_c.state IN('SUBMITTED','ASSESSED')
   CROSS JOIN LATERAL jsonb_array_elements(child_r.observations) child_o
   WHERE original.claim_id=OLD.id AND child_o->>'heldSourceId'=original_o->>'id') THEN
   RAISE EXCEPTION 'PHYSICAL_ACTIVE_REWORK_SOURCE_REQUIRES_CORRECTION';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_rework_correction_guard BEFORE UPDATE ON subcontract_claims FOR EACH ROW EXECUTE FUNCTION erp_physical_rework_correction_guard();

CREATE FUNCTION erp_physical_evidence_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc uuid;
BEGIN
 doc:=CASE WHEN TG_OP='DELETE' THEN OLD.document_id ELSE NEW.document_id END;
 IF EXISTS(SELECT 1 FROM subcontract_physical_submissions s CROSS JOIN LATERAL jsonb_array_elements(s.evidence) e WHERE e->>'id'=doc::text) OR
   (TG_OP<>'DELETE' AND NEW.entity_type='SUBCONTRACT_CLAIM' AND EXISTS(SELECT 1 FROM subcontract_physical_submissions WHERE claim_id=NEW.entity_id)) OR
   (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM subcontract_physical_submissions s CROSS JOIN LATERAL jsonb_array_elements(s.evidence) e WHERE e->>'id'=OLD.document_id::text)) THEN
   RAISE EXCEPTION 'PHYSICAL_EVIDENCE_FROZEN';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER physical_evidence_link_guard BEFORE INSERT OR UPDATE OR DELETE ON document_links FOR EACH ROW EXECUTE FUNCTION erp_physical_evidence_link_guard();

CREATE FUNCTION erp_physical_document_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM subcontract_physical_submissions s CROSS JOIN LATERAL jsonb_array_elements(s.evidence) e WHERE e->>'id'=OLD.id::text) THEN
   IF TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'PHYSICAL_EVIDENCE_FROZEN'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER physical_document_guard BEFORE UPDATE OR DELETE ON documents FOR EACH ROW EXECUTE FUNCTION erp_physical_document_guard();

