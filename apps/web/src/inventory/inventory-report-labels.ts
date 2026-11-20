import type { Locale } from '../role-ui/role-workspace-i18n';

// Labels are presentation-only. Do not recalculate, normalize or backfill stock facts in the browser.
export const inventoryReportLabels: Record<Locale, {
  ledgerNote: string;
  stockQuantity: string;
  stockUom: string;
  enteredQuantity: string;
  frozenRate: string;
  basisVersion: string;
  revision: string;
  noLegacyFactor: string;
}> = {
  en: {
    ledgerNote: 'Movements show signed canonical stock quantities. Entered quantities and the original dated conversion appear only when an immutable conversion record exists; legacy rows have no invented conversion.',
    stockQuantity: 'Stock quantity', stockUom: 'Stock UOM', enteredQuantity: 'Entered quantity',
    frozenRate: 'Frozen ratio / date', basisVersion: 'Basis v', revision: 'Revision',
    noLegacyFactor: 'Legacy movement: no recorded conversion factor',
  },
  th: {
    ledgerNote: 'รายการเคลื่อนไหวแสดงปริมาณสต็อกมาตรฐานพร้อมเครื่องหมายบวก/ลบ ปริมาณที่ป้อนและอัตราแปลงตามวันที่จะแสดงเฉพาะรายการที่บันทึกข้อมูลการแปลงไว้เท่านั้น โดยไม่สร้างอัตราย้อนหลัง',
    stockQuantity: 'ปริมาณสต็อก', stockUom: 'หน่วยสต็อก', enteredQuantity: 'ปริมาณที่ป้อน',
    frozenRate: 'อัตราเดิม / วันที่', basisVersion: 'ฐานรุ่น', revision: 'รุ่นแก้ไข',
    noLegacyFactor: 'รายการเดิมไม่มีข้อมูลอัตราแปลงที่บันทึกไว้',
  },
  'zh-TW': {
    ledgerNote: '異動紀錄顯示帶正負號的標準庫存數量。只有已保存不可變換算紀錄的交易才顯示原輸入數量及當時生效的換算率；歷史資料不會補造換算率。',
    stockQuantity: '庫存數量', stockUom: '庫存單位', enteredQuantity: '原輸入數量',
    frozenRate: '固定比率／日期', basisVersion: '基準版本', revision: '修訂',
    noLegacyFactor: '歷史紀錄沒有已保存的換算率',
  },
};
