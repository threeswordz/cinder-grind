-- Capability catalog only: no role/user grants, workflow configuration or business-data edits.
INSERT INTO permissions(id, permission_code, module_code, description) VALUES
('b0130000-0000-4000-8000-000000000001', 'budget.quantity.view', 'BUDGET', 'Read cost BOQ quantities without monetary fields'),
('b0130000-0000-4000-8000-000000000002', 'budget.customer.view', 'BUDGET', 'Read Customer BOQ commercial versions'),
('b0130000-0000-4000-8000-000000000003', 'budget.customer.manage', 'BUDGET', 'Prepare Customer BOQ versions and edits'),
('b0130000-0000-4000-8000-000000000004', 'budget.customer.submit', 'BUDGET', 'Submit Customer BOQ for configured approval'),
('b0130000-0000-4000-8000-000000000005', 'budget.customer.approve', 'BUDGET', 'Decide Customer BOQ through configured maker-checker')
ON CONFLICT (permission_code) DO NOTHING;
