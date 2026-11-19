// DEC-050 B: exact additive UOM effect-pin model and one canonical ledger relation.
// This classifier is not an open schema waiver. Each future Stage B schema delta
// must be added to its own bounded, independently reviewed contract.
const expectedModel = "model MaterialUomEffectPin {\n  stockTransactionId String @id @map(\"stock_transaction_id\") @db.Uuid\n  companyId String @map(\"company_id\") @db.Uuid\n  materialId String @map(\"material_id\") @db.Uuid\n  sourceUomId String @map(\"source_uom_id\") @db.Uuid\n  sourceQuantity Decimal @map(\"source_quantity\") @db.Decimal(18, 4)\n  stockUomId String @map(\"stock_uom_id\") @db.Uuid\n  stockQuantity Decimal @map(\"stock_quantity\") @db.Decimal(18, 4)\n  effectSign Int @map(\"effect_sign\")\n  businessDate DateTime @map(\"business_date\") @db.Date\n  basisVersion Int @map(\"basis_version\")\n  revisionId String? @map(\"revision_id\") @db.Uuid\n  numerator String @db.VarChar(38)\n  denominator String @db.VarChar(38)\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n\n  stockTransaction StockTransaction @relation(fields: [stockTransactionId], references: [id], onDelete: Restrict)\n  @@index([companyId, materialId, businessDate])\n  @@map(\"material_uom_effect_pins\")\n}";
const expectedReceiptModel = "model MaterialUomReceiptSourcePin {\n  receiptItemId String @id @map(\"receipt_item_id\") @db.Uuid\n  companyId String @map(\"company_id\") @db.Uuid\n  projectId String @map(\"project_id\") @db.Uuid\n  receiptId String @map(\"receipt_id\") @db.Uuid\n  materialId String @map(\"material_id\") @db.Uuid\n  sourceUomId String @map(\"source_uom_id\") @db.Uuid\n  sourceQuantity Decimal @map(\"source_quantity\") @db.Decimal(18, 4)\n  stockUomId String @map(\"stock_uom_id\") @db.Uuid\n  stockQuantity Decimal @map(\"stock_quantity\") @db.Decimal(18, 4)\n  businessDate DateTime @map(\"business_date\") @db.Date\n  basisVersion Int @map(\"basis_version\")\n  revisionId String? @map(\"revision_id\") @db.Uuid\n  numerator String @db.VarChar(38)\n  denominator String @db.VarChar(38)\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n\n  receiptItem GoodsReceiptItem @relation(fields: [receiptItemId], references: [id], onDelete: Restrict)\n  @@index([receiptId])\n  @@map(\"material_uom_receipt_source_pins\")\n}";
const expectedReservationModel = "model MaterialUomReservationPin {\n  reservationId String @id @map(\"reservation_id\") @db.Uuid\n  companyId String @map(\"company_id\") @db.Uuid\n  projectId String @map(\"project_id\") @db.Uuid\n  warehouseId String @map(\"warehouse_id\") @db.Uuid\n  materialId String @map(\"material_id\") @db.Uuid\n  sourceUomId String @map(\"source_uom_id\") @db.Uuid\n  sourceQuantity Decimal @map(\"source_quantity\") @db.Decimal(18, 4)\n  stockUomId String @map(\"stock_uom_id\") @db.Uuid\n  stockQuantity Decimal @map(\"stock_quantity\") @db.Decimal(18, 4)\n  businessDate DateTime @map(\"business_date\") @db.Date\n  basisVersion Int @map(\"basis_version\")\n  revisionId String? @map(\"revision_id\") @db.Uuid\n  numerator String @db.VarChar(38)\n  denominator String @db.VarChar(38)\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n\n  reservation MaterialReservation @relation(fields: [reservationId], references: [id], onDelete: Restrict)\n  @@index([companyId, projectId, warehouseId, materialId, stockUomId])\n  @@map(\"material_uom_reservation_pins\")\n}";
const expectedIssueModel = "model MaterialUomIssueSourcePin {\n  issueItemId String @id @map(\"issue_item_id\") @db.Uuid\n  companyId String @map(\"company_id\") @db.Uuid\n  projectId String @map(\"project_id\") @db.Uuid\n  warehouseId String @map(\"warehouse_id\") @db.Uuid\n  issueId String @map(\"issue_id\") @db.Uuid\n  materialId String @map(\"material_id\") @db.Uuid\n  sourceUomId String @map(\"source_uom_id\") @db.Uuid\n  sourceQuantity Decimal @map(\"source_quantity\") @db.Decimal(18, 4)\n  stockUomId String @map(\"stock_uom_id\") @db.Uuid\n  stockQuantity Decimal @map(\"stock_quantity\") @db.Decimal(18, 4)\n  businessDate DateTime @map(\"business_date\") @db.Date\n  basisVersion Int @map(\"basis_version\")\n  revisionId String? @map(\"revision_id\") @db.Uuid\n  numerator String @db.VarChar(38)\n  denominator String @db.VarChar(38)\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n\n  issueItem MaterialIssueItem @relation(fields: [issueItemId], references: [id], onDelete: Restrict)\n  @@index([issueId])\n  @@map(\"material_uom_issue_source_pins\")\n}";
const expectedTransferModel = "model MaterialUomTransferSourcePin {\n  transferItemId String @id @map(\"transfer_item_id\") @db.Uuid\n  transferId String @map(\"transfer_id\") @db.Uuid\n  companyId String @map(\"company_id\") @db.Uuid\n  sourceProjectId String @map(\"source_project_id\") @db.Uuid\n  destinationProjectId String @map(\"destination_project_id\") @db.Uuid\n  sourceWarehouseId String @map(\"source_warehouse_id\") @db.Uuid\n  destinationWarehouseId String @map(\"destination_warehouse_id\") @db.Uuid\n  materialId String @map(\"material_id\") @db.Uuid\n  sourceUomId String @map(\"source_uom_id\") @db.Uuid\n  sourceQuantity Decimal @map(\"source_quantity\") @db.Decimal(18, 4)\n  stockUomId String @map(\"stock_uom_id\") @db.Uuid\n  stockQuantity Decimal @map(\"stock_quantity\") @db.Decimal(18, 4)\n  businessDate DateTime @map(\"business_date\") @db.Date\n  basisVersion Int @map(\"basis_version\")\n  revisionId String? @map(\"revision_id\") @db.Uuid\n  numerator String @db.VarChar(38)\n  denominator String @db.VarChar(38)\n  createdAt DateTime @default(now()) @map(\"created_at\") @db.Timestamptz(6)\n\n  transferItem StockTransferItem @relation(fields: [transferItemId], references: [id], onDelete: Restrict)\n  @@index([transferId])\n  @@map(\"material_uom_transfer_source_pins\")\n}";
const expectedTransferRelation = 'materialUomTransferSourcePin MaterialUomTransferSourcePin?';
const expectedIssueRelation = 'materialUomIssueSourcePin MaterialUomIssueSourcePin?';
const expectedReservationRelation = 'materialUomReservationPin MaterialUomReservationPin?';
const expectedRelation = 'materialUomEffectPin MaterialUomEffectPin?';
const expectedReceiptRelation = 'materialUomReceiptSourcePin MaterialUomReceiptSourcePin?';
export const materialUomEffectMigration = '20261119140600_material_uom_effect_pins';
export const materialUomEffectTables = ['material_uom_effect_pins','material_uom_receipt_source_pins','material_uom_reservation_pins','material_uom_issue_source_pins','material_uom_transfer_source_pins'];
export function stripMaterialUomEffectSchema(schema) {
  let found = 0, relationCount = 0, receiptFound = 0, receiptRelationCount = 0, reservationFound = 0, reservationRelationCount = 0, issueFound = 0, issueRelationCount = 0, transferFound = 0, transferRelationCount = 0;
  const text = schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm, (block, name) => {
    if (name === 'MaterialUomEffectPin') {
      if (++found !== 1 || block.replace(/\s+/g, ' ') !== expectedModel.replace(/\s+/g, ' '))
        throw Error('Material UOM B schema outside exact reviewed effect-pin contract');
      return '';
    }
    if (name === 'MaterialUomReceiptSourcePin') {
      if (++receiptFound !== 1 || block.replace(/\s+/g,' ') !== expectedReceiptModel.replace(/\s+/g,' '))
        throw Error('Material UOM B receipt schema outside exact contract');
      return '';
    }
    if (name === 'MaterialUomReservationPin') {
      if (++reservationFound !== 1 || block.replace(/\s+/g,' ') !== expectedReservationModel.replace(/\s+/g,' '))
        throw Error('Material UOM B reservation schema outside exact contract');
      return '';
    }
    if(name==='MaterialUomIssueSourcePin') {
      if(++issueFound!==1||block.replace(/\s+/g,' ')!==expectedIssueModel.replace(/\s+/g,' ')) throw Error('Material UOM B issue source schema outside exact contract');
      return '';
    }
    if(name==='MaterialUomTransferSourcePin') {
      if(++transferFound!==1||block.replace(/\s+/g,' ')!==expectedTransferModel.replace(/\s+/g,' ')) throw Error('Material UOM B transfer source schema outside exact contract');
      return '';
    }
    if (name !== 'StockTransaction' && name !== 'GoodsReceiptItem' && name !== 'MaterialReservation' && name!=='MaterialIssueItem' && name!=='StockTransferItem') return block;
    return block.split('\n').filter(line => {
      const normalized=line.trim().replace(/\s+/g,' ');
      if (name==='StockTransaction' && normalized===expectedRelation) { relationCount++; return false; }
      if (name==='GoodsReceiptItem' && normalized===expectedReceiptRelation) { receiptRelationCount++; return false; }
      if (name==='MaterialReservation' && normalized===expectedReservationRelation) { reservationRelationCount++; return false; }
      if(name==='MaterialIssueItem'&&normalized===expectedIssueRelation){issueRelationCount++;return false;}
      if(name==='StockTransferItem'&&normalized===expectedTransferRelation){transferRelationCount++;return false;}
      return true;
    }).join('\n');
  });
  if (found !== relationCount || found > 1 || receiptFound !== receiptRelationCount || receiptFound !== found || reservationFound !== reservationRelationCount || reservationFound !== found || issueFound!==issueRelationCount || issueFound!==found || transferFound!==transferRelationCount || transferFound!==found) throw Error('Partial or duplicated material UOM B source/effect provenance');
  if (!found) return {text: schema, present: false};
  const comment = '// DEC-050 B: immutable entered-versus-stock effect provenance. This does not\n// activate mixed-UOM inventory until all canonical source owners are ready.';
  if (!text.includes(comment)) throw Error('Stage B provenance comment missing');
  return {text: text.replace(comment,''), present: true};
}
export function materialUomEffectMode(mode) {
  const prefix = 'migration-aware-material-uom-effect-';
  const present = typeof mode === 'string' && mode.startsWith(prefix);
  return {present,prior: !present ? mode : mode === prefix+'schema'
    ? 'migration-aware-sql-only'
    : 'migration-aware-'+mode.slice(prefix.length)};
}
