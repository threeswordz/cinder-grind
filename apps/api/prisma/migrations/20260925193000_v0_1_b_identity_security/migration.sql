-- V0.1-B identity, RBAC, approval and audit foundation.

CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_code" VARCHAR(50) NOT NULL,
    "employee_name" VARCHAR(200) NOT NULL,
    "job_title" VARCHAR(150),
    "email" VARCHAR(320),
    "phone" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "employee_id" UUID,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "role_code" VARCHAR(80) NOT NULL,
    "role_name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "permission_code" VARCHAR(150) NOT NULL,
    "module_code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_roles" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "csrf_token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_workflows" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "workflow_code" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "workflow_name" VARCHAR(150) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_steps" (
    "id" UUID NOT NULL,
    "approval_workflow_id" UUID NOT NULL,
    "step_no" INTEGER NOT NULL,
    "step_name" VARCHAR(150) NOT NULL,
    "required_approvals" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_step_roles" (
    "id" UUID NOT NULL,
    "approval_step_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "approval_step_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_instances" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "approval_workflow_id" UUID NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "current_step_no" INTEGER NOT NULL,
    "approval_state" VARCHAR(30) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "approval_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_actions" (
    "id" UUID NOT NULL,
    "approval_instance_id" UUID NOT NULL,
    "approval_step_id" UUID NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "action_by_user_id" UUID NOT NULL,
    "action_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "old_values" JSONB,
    "new_values" JSONB,
    "correlation_id" VARCHAR(128),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employees_company_id_employee_code_key"
    ON "employees"("company_id", "employee_code");
CREATE INDEX "employees_company_id_is_active_idx"
    ON "employees"("company_id", "is_active");

CREATE UNIQUE INDEX "users_employee_id_key"
    ON "users"("employee_id");
CREATE UNIQUE INDEX "users_company_id_email_key"
    ON "users"("company_id", "email");
CREATE INDEX "users_company_id_is_active_idx"
    ON "users"("company_id", "is_active");

CREATE UNIQUE INDEX "roles_company_id_role_code_key"
    ON "roles"("company_id", "role_code");
CREATE INDEX "roles_company_id_is_active_idx"
    ON "roles"("company_id", "is_active");

CREATE UNIQUE INDEX "permissions_permission_code_key"
    ON "permissions"("permission_code");
CREATE INDEX "permissions_module_code_idx"
    ON "permissions"("module_code");

CREATE UNIQUE INDEX "user_roles_company_id_user_id_role_id_key"
    ON "user_roles"("company_id", "user_id", "role_id");
CREATE INDEX "user_roles_user_id_idx"
    ON "user_roles"("user_id");
CREATE INDEX "user_roles_role_id_idx"
    ON "user_roles"("role_id");

CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key"
    ON "role_permissions"("role_id", "permission_id");
CREATE INDEX "role_permissions_permission_id_idx"
    ON "role_permissions"("permission_id");

CREATE UNIQUE INDEX "user_sessions_token_hash_key"
    ON "user_sessions"("token_hash");
CREATE INDEX "user_sessions_user_id_expires_at_idx"
    ON "user_sessions"("user_id", "expires_at");
CREATE INDEX "user_sessions_revoked_at_idx"
    ON "user_sessions"("revoked_at");

CREATE UNIQUE INDEX "approval_workflows_company_id_workflow_code_key"
    ON "approval_workflows"("company_id", "workflow_code");
CREATE INDEX "approval_workflows_company_id_entity_type_is_active_idx"
    ON "approval_workflows"("company_id", "entity_type", "is_active");

CREATE UNIQUE INDEX "approval_steps_approval_workflow_id_step_no_key"
    ON "approval_steps"("approval_workflow_id", "step_no");

CREATE UNIQUE INDEX "approval_step_roles_approval_step_id_role_id_key"
    ON "approval_step_roles"("approval_step_id", "role_id");
CREATE INDEX "approval_step_roles_role_id_idx"
    ON "approval_step_roles"("role_id");

CREATE INDEX "approval_instances_company_id_entity_type_entity_id_idx"
    ON "approval_instances"("company_id", "entity_type", "entity_id");
CREATE INDEX "approval_instances_approval_workflow_id_approval_state_idx"
    ON "approval_instances"("approval_workflow_id", "approval_state");

CREATE INDEX "approval_actions_approval_instance_id_action_at_idx"
    ON "approval_actions"("approval_instance_id", "action_at");
CREATE INDEX "approval_actions_action_by_user_id_idx"
    ON "approval_actions"("action_by_user_id");

CREATE INDEX "audit_logs_company_id_entity_type_entity_id_idx"
    ON "audit_logs"("company_id", "entity_type", "entity_id");
CREATE INDEX "audit_logs_actor_user_id_occurred_at_idx"
    ON "audit_logs"("actor_user_id", "occurred_at");
CREATE INDEX "audit_logs_correlation_id_idx"
    ON "audit_logs"("correlation_id");

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users"
    ADD CONSTRAINT "users_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "users"
    ADD CONSTRAINT "users_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "roles"
    ADD CONSTRAINT "roles_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_roles"
    ADD CONSTRAINT "user_roles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_sessions"
    ADD CONSTRAINT "user_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_workflows"
    ADD CONSTRAINT "approval_workflows_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_steps"
    ADD CONSTRAINT "approval_steps_approval_workflow_id_fkey"
    FOREIGN KEY ("approval_workflow_id") REFERENCES "approval_workflows"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_step_roles"
    ADD CONSTRAINT "approval_step_roles_approval_step_id_fkey"
    FOREIGN KEY ("approval_step_id") REFERENCES "approval_steps"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_step_roles"
    ADD CONSTRAINT "approval_step_roles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_instances"
    ADD CONSTRAINT "approval_instances_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_instances"
    ADD CONSTRAINT "approval_instances_approval_workflow_id_fkey"
    FOREIGN KEY ("approval_workflow_id") REFERENCES "approval_workflows"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_actions"
    ADD CONSTRAINT "approval_actions_approval_instance_id_fkey"
    FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_actions"
    ADD CONSTRAINT "approval_actions_approval_step_id_fkey"
    FOREIGN KEY ("approval_step_id") REFERENCES "approval_steps"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_actions"
    ADD CONSTRAINT "approval_actions_action_by_user_id_fkey"
    FOREIGN KEY ("action_by_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
    ADD CONSTRAINT "audit_logs_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
