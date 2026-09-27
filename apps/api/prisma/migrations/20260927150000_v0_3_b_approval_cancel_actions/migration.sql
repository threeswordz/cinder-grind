-- Permit an approval participant to record a later cancellation without
-- overwriting or colliding with their earlier APPROVE action on a
-- still-SUBMITTED multi-approval step. Application logic still prevents a
-- second approve/reject action by the same user on the same step.

DROP INDEX "approval_actions_instance_step_user_key";

CREATE UNIQUE INDEX "approval_actions_instance_step_user_action_key"
  ON "approval_actions"(
    "approval_instance_id",
    "approval_step_id",
    "action_by_user_id",
    "action"
  );
