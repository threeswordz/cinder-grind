// FM02: exact, additive Project work-plan and quantity-source schema custody.
// Never broaden a historical predecessor classifier to admit unrelated fields.
const expectedModels={
  "ProjectProgressPlan": "model ProjectProgressPlan { id String @id @default(uuid()) @db.Uuid companyId String @map(\"company_id\") @db.Uuid projectId String @map(\"project_id\") @db.Uuid versionNo Int @map(\"version_no\") reason String @db.Text preparedByUserId String @map(\"prepared_by_user_id\") @db.Uuid preparedAt DateTime @default(now()) @map(\"prepared_at\") @db.Timestamptz(6) confirmedByUserId String? @map(\"confirmed_by_user_id\") @db.Uuid confirmedAt DateTime? @map(\"confirmed_at\") @db.Timestamptz(6) company Company @relation(fields: [companyId], references: [id], onDelete: Restrict) project Project @relation(fields: [projectId], references: [id], onDelete: Restrict) preparedBy User @relation(\"ProjectProgressPlanPreparer\", fields: [preparedByUserId], references: [id], onDelete: Restrict) confirmedBy User? @relation(\"ProjectProgressPlanConfirmer\", fields: [confirmedByUserId], references: [id], onDelete: Restrict) lines ProjectProgressPlanLine[] @@unique([projectId, versionNo]) @@index([companyId, projectId, versionNo]) @@map(\"project_progress_plans\") }",
  "ProjectProgressPlanLine": "model ProjectProgressPlanLine { id String @id @default(uuid()) @db.Uuid planId String @map(\"plan_id\") @db.Uuid activityId String @map(\"activity_id\") @db.Uuid weightPercent Decimal @map(\"weight_percent\") @db.Decimal(5, 2) sourceKind String @map(\"source_kind\") @db.VarChar(12) approvedBudgetRevisionLineId String? @map(\"approved_budget_revision_line_id\") @db.Uuid plannedQuantity Decimal? @map(\"planned_quantity\") @db.Decimal(18, 4) uomId String? @map(\"uom_id\") @db.Uuid plan ProjectProgressPlan @relation(fields: [planId], references: [id], onDelete: Restrict) activity Activity @relation(fields: [activityId], references: [id], onDelete: Restrict) approvedBudgetRevisionLine BudgetRevisionLine? @relation(fields: [approvedBudgetRevisionLineId], references: [id], onDelete: Restrict) @@unique([planId, activityId]) @@unique([planId, approvedBudgetRevisionLineId]) @@index([activityId]) @@map(\"project_progress_plan_lines\") }"
};
const expectedFields={
  "Company": [
    "projectProgressPlans ProjectProgressPlan[]"
  ],
  "Project": [
    "projectProgressPlans ProjectProgressPlan[]"
  ],
  "User": [
    "preparedProgressPlans ProjectProgressPlan[] @relation(\"ProjectProgressPlanPreparer\")",
    "confirmedProgressPlans ProjectProgressPlan[] @relation(\"ProjectProgressPlanConfirmer\")"
  ],
  "Activity": [
    "projectProgressPlanLines ProjectProgressPlanLine[]"
  ],
  "UnitOfMeasure": [
    "fm02QuantityProgress ActivityProgress[] @relation(\"Fm02QuantityUom\")"
  ],
  "ActivityProgress": [
    "completedQuantity Decimal? @map(\"completed_quantity\") @db.Decimal(18, 4)",
    "sourceBudgetRevisionLineId String? @map(\"source_budget_revision_line_id\") @db.Uuid",
    "sourceUomId String? @map(\"source_uom_id\") @db.Uuid",
    "sourceBudgetRevisionLine BudgetRevisionLine? @relation(\"Fm02QuantityBudgetSource\", fields: [sourceBudgetRevisionLineId], references: [id], onDelete: Restrict)",
    "sourceUom UnitOfMeasure? @relation(\"Fm02QuantityUom\", fields: [sourceUomId], references: [id], onDelete: Restrict)"
  ],
  "BudgetRevisionLine": [
    "projectProgressPlanLines ProjectProgressPlanLine[]",
    "fm02QuantityProgress ActivityProgress[] @relation(\"Fm02QuantityBudgetSource\")"
  ]
};
const fm02Comment="/**\n * FM02: immutable, versioned work-plan weighting. Every version is create-only;\n * confirm is a separate authorized Ben role capability. The latest confirmed\n * version is current. No Cost/Client BOQ or schedule baseline is overwritten.\n */";

export function stripFm02Schema(schema) {
  const models=new Set(),fields=new Set();
  let text=schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm,(block,name)=>{
    if(Object.hasOwn(expectedModels,name)){
      if(models.has(name)||block.replace(/\s+/g,' ').trim()!==expectedModels[name])
        throw Error('FM02 immutable plan model differs from exact approved contract: '+name);
      models.add(name);
      return '';
    }
    const allowed=expectedFields[name];
    if(!allowed)return block;
    return block.split('\n').filter(line=>{
      const normalized=line.trim().replace(/\s+/g,' ');
      if(!allowed.includes(normalized))return true;
      const key=name+':'+normalized;
      if(fields.has(key))throw Error('Duplicate FM02 source relation: '+key);
      fields.add(key);
      return false;
    }).join('\n');
  });
  if(models.size===0&&fields.size===0){
    if(text.includes(fm02Comment))throw Error('Orphan FM02 schema comment');
    return {text,present:false};
  }
  const expectedCount=Object.values(expectedFields).reduce((n,fields)=>n+fields.length,0);
  if(models.size!==2||fields.size!==expectedCount||!text.includes(fm02Comment))
    throw Error('Partial FM02 immutable plan or source relation contract');
  text=text.replace(fm02Comment,'');
  return {text,present:true};
}
export function fm02Mode(mode){
  const prefix='migration-aware-fm02-';
  const present=typeof mode==='string'&&mode.startsWith(prefix);
  return {present,prior:!present?mode:mode===prefix+'schema'
    ?'migration-aware-sql-only':'migration-aware-'+mode.slice(prefix.length)};
}
