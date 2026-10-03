-- V0.7-C Forecast permissions.
-- Forward-only: the approved DEC-024 catalogue listed these permissions,
-- but they were not yet persisted in the system permission catalogue.

INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'cost.forecast.view','COST_CONTROL','View authorized Cost Forecast source records within effective Project scope'),
  (gen_random_uuid(),'cost.forecast.manage','COST_CONTROL','Create and maintain Cost Forecast drafts and submit them for configured approval within authorized Projects'),
  (gen_random_uuid(),'cost.forecast.approve','COST_CONTROL','Approve or reject Cost Forecasts when also authorized by the Approval Matrix')
ON CONFLICT ("permission_code") DO NOTHING;
