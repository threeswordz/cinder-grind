// DEC-050 C bounded, exact forward-only source/approval pin schema.
// This is a strict classifier. It cannot admit unlisted source fields or
// rewrite original B/DEC-043/044 business models as an informal exception.
const expectedModels={
  "MaterialUomPlanLinePin": "model MaterialUomPlanLinePin { planLineId String @id @map(\"plan_line_id\") @db.Uuid companyId String @map(\"company_id\") @db.Uuid materialId String @map(\"material_id\") @db.Uuid sourceUomId String @map(\"source_uom_id\") @db.Uuid sourceQuantity Decimal @map(\"source_quantity\") @db.Decimal(18,4) stockUomId String @map(\"stock_uom_id\") @db.Uuid stockUomCode String @map(\"stock_uom_code\") @db.VarChar(30) stockQuantity Decimal @map(\"stock_quantity\") @db.Decimal(18,4) businessDate DateTime @map(\"business_date\") @db.Date basisVersion Int @map(\"basis_version\") revisionId String? @map(\"revision_id\") @db.Uuid numerator String @db.VarChar(38) denominator String @db.VarChar(38) createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6) planLine MaterialUsagePlanLine @relation(fields: [planLineId],references:[id],onDelete:Restrict) @@index([companyId,materialId,businessDate]) @@map(\"material_uom_plan_line_pins\") }",
  "MaterialUomRequestLinePin": "model MaterialUomRequestLinePin { requestLineId String @map(\"request_line_id\") @db.Uuid requestVersion Int @map(\"request_version\") companyId String @map(\"company_id\") @db.Uuid materialId String @map(\"material_id\") @db.Uuid sourceUomId String @map(\"source_uom_id\") @db.Uuid sourceQuantity Decimal @map(\"source_quantity\") @db.Decimal(18,4) stockUomId String @map(\"stock_uom_id\") @db.Uuid stockUomCode String @map(\"stock_uom_code\") @db.VarChar(30) stockQuantity Decimal @map(\"stock_quantity\") @db.Decimal(18,4) businessDate DateTime @map(\"business_date\") @db.Date basisVersion Int @map(\"basis_version\") revisionId String? @map(\"revision_id\") @db.Uuid numerator String @db.VarChar(38) denominator String @db.VarChar(38) createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6) requestLine MaterialRequestLine @relation(fields:[requestLineId],references:[id],onDelete:Restrict) @@id([requestLineId,requestVersion]) @@index([companyId,materialId,requestLineId,requestVersion]) @@map(\"material_uom_request_line_pins\") }",
  "MaterialUomPlanAllocationPin": "model MaterialUomPlanAllocationPin { allocationId String @id @map(\"allocation_id\") @db.Uuid companyId String @map(\"company_id\") @db.Uuid materialId String @map(\"material_id\") @db.Uuid sourceUomId String @map(\"source_uom_id\") @db.Uuid sourceQuantity Decimal @map(\"source_quantity\") @db.Decimal(18,4) stockUomId String @map(\"stock_uom_id\") @db.Uuid stockQuantity Decimal @map(\"stock_quantity\") @db.Decimal(18,4) planStockQuantity Decimal @map(\"plan_stock_quantity\") @db.Decimal(18,4) stockOverageQuantity Decimal @map(\"stock_overage_quantity\") @db.Decimal(18,4) businessDate DateTime @map(\"business_date\") @db.Date basisVersion Int @map(\"basis_version\") revisionId String? @map(\"revision_id\") @db.Uuid numerator String @db.VarChar(38) denominator String @db.VarChar(38) createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6) allocation MaterialPlanIssueAllocation @relation(fields:[allocationId],references:[id],onDelete:Restrict) @@index([companyId,materialId,businessDate]) @@map(\"material_uom_plan_allocation_pins\") }"
};
const relations={
  MaterialUsagePlanLine:'materialUomPlanLinePin MaterialUomPlanLinePin?',
  MaterialRequestLine:'materialUomRequestLinePins MaterialUomRequestLinePin[]',
  MaterialPlanIssueAllocation:'materialUomPlanAllocationPin MaterialUomPlanAllocationPin?'
};
const commentLines=[
  '// Stage C frozen source quantity, without retrospective normalization.',
  '// Every request CAPTURE/REVISE keeps its original immutable entered/stock basis.',
  '// A link/receipt changes the header version but not the latest source pin.',
  '// Immutable stock-basis authorization proof; legacy overageQuantity field is',
  '// always zero on converted allocations, with exact overage here instead.'
];
export const stageCMigrations=[
 '20261120221000_material_uom_plan_frozen_usage',
 '20261120224000_material_uom_request_source',
 '20261120230000_material_uom_plan_issue_authority',
 '20261121013000_material_uom_reserved_plan_issue'
];
export const stageCTables=[
 'material_uom_plan_line_pins','material_uom_request_line_pins',
 'material_uom_plan_allocation_pins'
];
export function materialUomStageCMode(mode){
 const prefix='migration-aware-material-uom-stage-c-';
 const present=typeof mode==='string'&&mode.startsWith(prefix);
 return {present,prior:!present?mode:mode===prefix+'schema'
  ?'migration-aware-sql-only':'migration-aware-'+mode.slice(prefix.length)};
}
export function stripMaterialUomStageCSchema(schema){
 const seen=new Set(),relationsSeen=new Set();
 let text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
  if(Object.hasOwn(expectedModels,name)){
   if(seen.has(name)||block.replace(/\s+/g,' ')!==expectedModels[name])
    throw Error('Stage C immutable source pin model differs from exact contract: '+name);
   seen.add(name);return '';
  }
  const relation=relations[name];
  if(!relation)return block;
  return block.split('\n').filter(line=>{
   const normalized=line.trim().replace(/\s+/g,' ');
   if(normalized!==relation)return true;
   if(relationsSeen.has(name))throw Error('Duplicate Stage C relation: '+name);
   relationsSeen.add(name);return false;
  }).join('\n');
 });
 if(seen.size!==relationsSeen.size||(![0,3].includes(seen.size))||!([0,3].includes(relationsSeen.size)))
  throw Error('Stage C incomplete exact source pin model/relation set');
 if(seen.size){
   for(const line of commentLines){
     if(!text.includes(line))throw Error('Stage C source comment/contract unexpectedly changed');
     text=text.replace(line,'');
   }
 }
 return {text,present:seen.size===3};
}
