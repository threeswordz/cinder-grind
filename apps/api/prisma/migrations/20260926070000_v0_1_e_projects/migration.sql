-- V0.1-E Projects foundation.
-- Project Type and Actual dates remain V0.2 scope and are intentionally absent.

CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_code" VARCHAR(50) NOT NULL,
    "project_name" VARCHAR(200) NOT NULL,
    "customer_id" UUID NOT NULL,
    "status_definition_id" UUID,
    "contract_value" DECIMAL(18,2) NOT NULL,
    "location" VARCHAR(500),
    "description" TEXT,
    "planned_start_date" DATE NOT NULL,
    "planned_completion_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_contract_value_check" CHECK ("contract_value" >= 0),
    CONSTRAINT "projects_planned_dates_check"
      CHECK ("planned_completion_date" >= "planned_start_date")
);

CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "project_role" VARCHAR(150) NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_members_dates_check"
      CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date")
);

CREATE TABLE "project_contacts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "contact_name" VARCHAR(200) NOT NULL,
    "organization_name" VARCHAR(200),
    "role_or_title" VARCHAR(150),
    "email" VARCHAR(320),
    "phone" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "project_contacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "projects_company_id_project_code_key"
    ON "projects"("company_id", "project_code");
CREATE INDEX "projects_company_id_is_active_idx"
    ON "projects"("company_id", "is_active");
CREATE INDEX "projects_customer_id_idx"
    ON "projects"("customer_id");
CREATE INDEX "projects_status_definition_id_idx"
    ON "projects"("status_definition_id");

CREATE UNIQUE INDEX "project_members_project_employee_role_key"
    ON "project_members"("project_id", "employee_id", "project_role");
CREATE INDEX "project_members_project_id_is_active_idx"
    ON "project_members"("project_id", "is_active");
CREATE INDEX "project_members_employee_id_is_active_idx"
    ON "project_members"("employee_id", "is_active");

CREATE INDEX "project_contacts_project_id_is_active_idx"
    ON "project_contacts"("project_id", "is_active");

ALTER TABLE "projects"
    ADD CONSTRAINT "projects_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
    ADD CONSTRAINT "projects_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects"
    ADD CONSTRAINT "projects_status_definition_id_fkey"
    FOREIGN KEY ("status_definition_id") REFERENCES "status_definitions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_members"
    ADD CONSTRAINT "project_members_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_members"
    ADD CONSTRAINT "project_members_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "project_contacts"
    ADD CONSTRAINT "project_contacts_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
