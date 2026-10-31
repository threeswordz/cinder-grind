// #289 / OP-STOCK-COUNT-01: exact additive Project-site physical count
// persistence and one nullable source link into the canonical Stock Transaction
// ledger. This contract is independent of earlier THB/BOQ/HR gates.
const exactModel = `model StockCount {
  id                       String    @id @default(uuid()) @db.Uuid
  companyId                String    @map("company_id") @db.Uuid
  projectId                String    @map("project_id") @db.Uuid
  warehouseId              String    @map("warehouse_id") @db.Uuid
  materialId               String    @map("material_id") @db.Uuid
  uomId                    String    @map("uom_id") @db.Uuid
  countedAt                DateTime  @map("counted_at") @db.Timestamptz(6)
  expectedOnHand           Decimal   @map("expected_on_hand") @db.Decimal(18, 4)
  expectedReserved         Decimal   @map("expected_reserved") @db.Decimal(18, 4)
  actualQuantity           Decimal   @map("actual_quantity") @db.Decimal(18, 4)
  varianceQuantity         Decimal   @map("variance_quantity") @db.Decimal(18, 4)
  evidenceReference        String?   @map("evidence_reference") @db.Text
  status                   String    @default("DRAFT") @db.VarChar(20)
  version                  Int       @default(1)
  createdByUserId          String    @map("created_by_user_id") @db.Uuid
  submittedByUserId        String?   @map("submitted_by_user_id") @db.Uuid
  decidedByUserId          String?   @map("decided_by_user_id") @db.Uuid
  decisionComment          String?   @map("decision_comment") @db.Text
  postKey                  String?   @unique @map("post_key") @db.VarChar(120)
  createdAt                DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt                DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  submittedAt              DateTime? @map("submitted_at") @db.Timestamptz(6)
  decidedAt                DateTime? @map("decided_at") @db.Timestamptz(6)

  company                  Company       @relation(fields: [companyId], references: [id], onDelete: Restrict)
  project                  Project       @relation(fields: [projectId], references: [id], onDelete: Restrict)
  warehouse                Warehouse     @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  material                 Material      @relation(fields: [materialId], references: [id], onDelete: Restrict)
  uom                      UnitOfMeasure @relation(fields: [uomId], references: [id], onDelete: Restrict)
  createdBy                User          @relation("StockCountCreator", fields: [createdByUserId], references: [id], onDelete: Restrict)
  submittedBy              User?         @relation("StockCountSubmitter", fields: [submittedByUserId], references: [id], onDelete: Restrict)
  decidedBy                User?         @relation("StockCountDecider", fields: [decidedByUserId], references: [id], onDelete: Restrict)
  stockTransaction         StockTransaction?

  @@index([companyId, projectId, status, createdAt])
  @@index([warehouseId, materialId, projectId, uomId, status])
  @@map("stock_counts")
}`;

const normalize = value => value.replace(/\s+/g, ' ').trim();
const relations = {
  Company: ['stockCounts StockCount[]'],
  Project: ['stockCounts StockCount[]'],
  UnitOfMeasure: ['stockCounts StockCount[]'],
  Material: ['stockCounts StockCount[]'],
  Warehouse: ['stockCounts StockCount[]'],
  User: [
    'createdStockCounts StockCount[] @relation("StockCountCreator")',
    'submittedStockCounts StockCount[] @relation("StockCountSubmitter")',
    'decidedStockCounts StockCount[] @relation("StockCountDecider")',
  ],
  StockTransaction: [
    'stockCountId String? @unique @map("stock_count_id") @db.Uuid',
    'stockCount StockCount? @relation(fields: [stockCountId], references: [id], onDelete: Restrict)',
  ],
};

export const stockCountTables = ['stock_counts'];
export function stripStockCountSchema(schema) {
  const models = new Set(), removed = new Set();
  const stripped = schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm, (block, name) => {
    if (name === 'StockCount') {
      if (models.has(name) || normalize(block) !== normalize(exactModel)) {
        throw new Error('Stock count model differs from the exact approved #289 contract.');
      }
      models.add(name);
      return '';
    }
    return block.split('\n').filter(line => {
      const value = normalize(line);
      if (!(relations[name] ?? []).includes(value)) return true;
      const key = name + ':' + value;
      if (removed.has(key)) throw new Error('Duplicate StockCount relation/source field.');
      removed.add(key);
      return false;
    }).join('\n');
  });
  if ((models.size && models.size !== 1) || (removed.size && removed.size !== 10) ||
      Boolean(models.size) !== Boolean(removed.size)) {
    throw new Error('Partial stock count schema is not an approved release mode.');
  }
  return { text: stripped, present: models.size === 1 };
}
