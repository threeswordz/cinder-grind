-- DEC-054: capability catalog only. Ben's eligible Company-scoped Cost
-- approver role must be explicitly configured; no user/role/SYS_ADMIN grants.
-- No changes to historical Budget Revisions or approval workflows.
INSERT INTO permissions(id, permission_code, module_code, description)
VALUES ('b0540000-0000-4000-8000-000000000001',
        'budget.cost.self_approve', 'BUDGET',
        'Explicit Company-role Cost BOQ maker/approver exception (DEC-054)')
ON CONFLICT (permission_code) DO NOTHING;
-- Explicit scoped grants only; no SYS_ADMIN or historic-role default grants.
INSERT INTO permissions(id, permission_code, module_code, description)
VALUES ('b0540000-0000-4000-8000-000000000002',
        'budget.cost.full_view', 'BUDGET',
        'Full Cost BOQ read for configured Company approver roles (DEC-054)')
ON CONFLICT (permission_code) DO NOTHING;
