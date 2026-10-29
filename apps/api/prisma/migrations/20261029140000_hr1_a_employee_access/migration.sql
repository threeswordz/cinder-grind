-- CreateTable
CREATE TABLE "hr_company_access" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason_code" VARCHAR(40) NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "hr_company_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employments" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_employments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_employment_revisions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employment_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "pay_basis" VARCHAR(10) NOT NULL,
    "employment_form" VARCHAR(20) NOT NULL,
    "site_kind" VARCHAR(10) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "project_id" UUID,
    "ciphertext" TEXT NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_employment_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_private_revisions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "version" INTEGER NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_private_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_people" (
    "id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_person_links" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "verified_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_person_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_replays" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "operation" VARCHAR(30) NOT NULL,
    "key_id" VARCHAR(32) NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "receipt" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_replays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hr_company_access_user_id_is_active_idx" ON "hr_company_access"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "hr_company_access_company_id_user_id_category_key" ON "hr_company_access"("company_id", "user_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employments_company_id_employee_id_key" ON "hr_employments"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employments_company_id_id_key" ON "hr_employments"("company_id", "id");

-- CreateIndex
CREATE INDEX "hr_employment_revisions_company_id_project_id_idx" ON "hr_employment_revisions"("company_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employment_revisions_employment_id_version_key" ON "hr_employment_revisions"("employment_id", "version");

-- CreateIndex
CREATE INDEX "hr_private_revisions_company_id_employee_id_idx" ON "hr_private_revisions"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_private_revisions_employee_id_category_version_key" ON "hr_private_revisions"("employee_id", "category", "version");

-- CreateIndex
CREATE INDEX "hr_person_links_person_id_idx" ON "hr_person_links"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_person_links_company_id_employee_id_key" ON "hr_person_links"("company_id", "employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_replays_company_id_actor_user_id_request_id_key" ON "hr_replays"("company_id", "actor_user_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_company_id_id_key" ON "employees"("company_id", "id");

-- AddForeignKey
ALTER TABLE "hr_company_access" ADD CONSTRAINT "hr_company_access_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_company_access" ADD CONSTRAINT "hr_company_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_company_access" ADD CONSTRAINT "hr_company_access_company_id_updated_by_user_id_fkey" FOREIGN KEY ("company_id", "updated_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employments" ADD CONSTRAINT "hr_employments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employments" ADD CONSTRAINT "hr_employments_company_id_employee_id_fkey" FOREIGN KEY ("company_id", "employee_id") REFERENCES "employees"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employment_revisions" ADD CONSTRAINT "hr_employment_revisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employment_revisions" ADD CONSTRAINT "hr_employment_revisions_company_id_employment_id_fkey" FOREIGN KEY ("company_id", "employment_id") REFERENCES "hr_employments"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employment_revisions" ADD CONSTRAINT "hr_employment_revisions_company_id_project_id_fkey" FOREIGN KEY ("company_id", "project_id") REFERENCES "projects"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employment_revisions" ADD CONSTRAINT "hr_employment_revisions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_private_revisions" ADD CONSTRAINT "hr_private_revisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_private_revisions" ADD CONSTRAINT "hr_private_revisions_company_id_employee_id_fkey" FOREIGN KEY ("company_id", "employee_id") REFERENCES "employees"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_private_revisions" ADD CONSTRAINT "hr_private_revisions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_people" ADD CONSTRAINT "hr_people_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_person_links" ADD CONSTRAINT "hr_person_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_person_links" ADD CONSTRAINT "hr_person_links_company_id_employee_id_fkey" FOREIGN KEY ("company_id", "employee_id") REFERENCES "employees"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_person_links" ADD CONSTRAINT "hr_person_links_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "hr_people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_person_links" ADD CONSTRAINT "hr_person_links_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_replays" ADD CONSTRAINT "hr_replays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_replays" ADD CONSTRAINT "hr_replays_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- DEC-039 capability definitions only; no role/user grants or retained data.
INSERT INTO permissions(id,permission_code,module_code,description)
SELECT ('b0140000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, code, 'HR', description
FROM (VALUES
 (1,'hr.employment.view','Read explicitly authorized HR employment data'),
 (2,'hr.employment.manage','Record reasoned employment revisions'),
 (3,'hr.identity.view','Explicitly reveal authorized private identity data'),
 (4,'hr.identity.manage','Record private identity revisions and verified person links'),
 (5,'hr.bank.view','Explicitly reveal authorized bank fields'),
 (6,'hr.bank.manage','Record protected bank revisions'),
 (7,'hr.documents.view','Read authorized HR private documents through HR routes'),
 (8,'hr.documents.manage','Manage authorized canonical HR private documents'),
 (9,'hr.operational.view','Read salary-free employees within existing Project scope'),
 (10,'hr.access.manage','Administer target-owned HR Company/category scope without self-grant')
) AS capability(n,code,description) ON CONFLICT(permission_code) DO NOTHING;

ALTER TABLE hr_company_access ADD CONSTRAINT hr_access_values CHECK (
 category IN ('employment','identity','bank','documents') AND version > 0 AND user_id <> updated_by_user_id AND
 reason_code IN ('OWNER_APPROVED_SCOPE','SCOPE_CORRECTION','ACCESS_REVOKED'));
ALTER TABLE hr_employments ADD CONSTRAINT hr_employment_version CHECK(current_version >= 0);
ALTER TABLE hr_employment_revisions ADD CONSTRAINT hr_employment_revision_values CHECK (
 version > 0 AND pay_basis IN ('MONTHLY','DAILY') AND employment_form IN ('PROBATION','PERMANENT','FIXED_TERM','TEMPORARY')
 AND site_kind IN ('OFFICE','SITE') AND (end_date IS NULL OR end_date >= start_date));
ALTER TABLE hr_private_revisions ADD CONSTRAINT hr_private_revision_values CHECK(category IN ('identity','bank') AND version > 0);

CREATE FUNCTION hr_history_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'HR_HISTORY_IMMUTABLE' USING ERRCODE='23514';
END $$;
CREATE TRIGGER hr_employment_revision_immutable BEFORE UPDATE OR DELETE ON hr_employment_revisions FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();
CREATE TRIGGER hr_private_revision_immutable BEFORE UPDATE OR DELETE ON hr_private_revisions FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();
CREATE TRIGGER hr_person_link_immutable BEFORE UPDATE OR DELETE ON hr_person_links FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();
CREATE TRIGGER hr_person_immutable BEFORE UPDATE OR DELETE ON hr_people FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();
CREATE TRIGGER hr_replay_immutable BEFORE UPDATE OR DELETE ON hr_replays FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();

CREATE FUNCTION hr_employee_reference_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected integer;
BEGIN
 PERFORM 1 FROM employees WHERE id=NEW.employee_id AND company_id=NEW.company_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'HR_EMPLOYEE_SCOPE_INVALID' USING ERRCODE='23503'; END IF;
 IF TG_TABLE_NAME='hr_private_revisions' THEN
  SELECT COALESCE(MAX(version),0)+1 INTO expected FROM hr_private_revisions
   WHERE employee_id=NEW.employee_id AND category=NEW.category;
  IF NEW.version <> expected THEN RAISE EXCEPTION 'HR_VERSION_CONFLICT' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_employment_employee_guard BEFORE INSERT ON hr_employments FOR EACH ROW EXECUTE FUNCTION hr_employee_reference_guard();
CREATE TRIGGER hr_private_employee_guard BEFORE INSERT ON hr_private_revisions FOR EACH ROW EXECUTE FUNCTION hr_employee_reference_guard();
CREATE TRIGGER hr_person_employee_guard BEFORE INSERT ON hr_person_links FOR EACH ROW EXECUTE FUNCTION hr_employee_reference_guard();

CREATE FUNCTION hr_protect_employee_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.employee_code IS DISTINCT FROM OLD.employee_code)
 AND (EXISTS(SELECT 1 FROM hr_employments WHERE employee_id=OLD.id)
   OR EXISTS(SELECT 1 FROM hr_private_revisions WHERE employee_id=OLD.id)
   OR EXISTS(SELECT 1 FROM hr_person_links WHERE employee_id=OLD.id)) THEN
  RAISE EXCEPTION 'HR_EMPLOYEE_HISTORY_PROTECTED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_employee_identity_guard BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION hr_protect_employee_identity();

CREATE FUNCTION hr_employment_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_version integer;
BEGIN
 SELECT current_version INTO parent_version FROM hr_employments
  WHERE id=NEW.employment_id AND company_id=NEW.company_id FOR UPDATE;
 IF NOT FOUND OR NEW.version <> parent_version+1 THEN
  RAISE EXCEPTION 'HR_VERSION_CONFLICT' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_employment_revision_guard BEFORE INSERT ON hr_employment_revisions FOR EACH ROW EXECUTE FUNCTION hr_employment_revision_guard();

CREATE FUNCTION hr_employment_pointer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
  OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.current_version <> OLD.current_version+1
  OR NOT EXISTS(SELECT 1 FROM hr_employment_revisions WHERE employment_id=OLD.id AND version=NEW.current_version) THEN
  RAISE EXCEPTION 'HR_VERSION_CONFLICT' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_employment_pointer_guard BEFORE UPDATE OR DELETE ON hr_employments FOR EACH ROW EXECUTE FUNCTION hr_employment_pointer_guard();

CREATE FUNCTION hr_employment_complete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_no integer; last_no integer;
BEGIN
 SELECT current_version INTO current_no FROM hr_employments WHERE id=NEW.id;
 SELECT COALESCE(MAX(version),0) INTO last_no FROM hr_employment_revisions WHERE employment_id=NEW.id;
 IF current_no < 1 OR current_no <> last_no THEN RAISE EXCEPTION 'HR_VERSION_CONFLICT' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER hr_employment_complete_guard AFTER INSERT OR UPDATE ON hr_employments
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hr_employment_complete_guard();

CREATE FUNCTION hr_access_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.user_id IS DISTINCT FROM OLD.user_id
  OR NEW.category IS DISTINCT FROM OLD.category OR NEW.version <> OLD.version+1 THEN
  RAISE EXCEPTION 'HR_VERSION_CONFLICT' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_access_guard BEFORE UPDATE OR DELETE ON hr_company_access FOR EACH ROW EXECUTE FUNCTION hr_access_guard();
