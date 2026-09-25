-- Strengthen generic approval workflow integrity.

ALTER TABLE "approval_steps"
  ADD CONSTRAINT "approval_steps_required_approvals_check"
  CHECK ("required_approvals" >= 1);

CREATE UNIQUE INDEX "approval_actions_instance_step_user_key"
  ON "approval_actions"(
    "approval_instance_id",
    "approval_step_id",
    "action_by_user_id"
  );
