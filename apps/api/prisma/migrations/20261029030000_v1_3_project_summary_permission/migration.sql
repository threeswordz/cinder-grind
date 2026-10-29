-- Explicit Project aggregate authority only. No role/user grants or business writes.
INSERT INTO permissions(id, permission_code, module_code, description) VALUES
('b0130000-0000-4000-8000-000000000006', 'budget.project_summary.view', 'BUDGET', 'Read Project contract billed and received totals without BOQ detail')
ON CONFLICT (permission_code) DO NOTHING;
