import {useContext} from 'react';
import {MonetaryLocaleContext} from '../role-ui/monetary-presentation';
const labels = {
  unsaved:['Save your changes before submitting this version.','บันทึกการแก้ไขก่อนส่งฉบับนี้อนุมัติ','請先儲存變更，再送審此版本。'],
  original:['Original','ฉบับตั้งต้น','原始版本'],current:['Current','ฉบับปัจจุบัน','目前版本'],
  customer:['Customer BOQ','BOQ สำหรับลูกค้า','客戶工程量清單'],quantityOnly:['Quantity Only','ดูเฉพาะปริมาณ','僅限數量'],
  project:['Project','โครงการ','專案'],version:['Version','ฉบับ','版本'],edit:['Edit','แก้ไข','編輯'],source:['Approved cost revision','ฉบับต้นทุนที่อนุมัติ','已核准成本修訂'],
  sourceLine:['Approved source line','รายการต้นทุนที่อนุมัติ','已核准來源項目'],share:['Cost allocation %','สัดส่วนต้นทุน %','成本分配 %'],
  description:['Description','รายละเอียดงาน','工作說明'],quantity:['Quantity','ปริมาณ','數量'],uom:['Unit','หน่วย','單位'],
  method:['Pricing method','วิธีตั้งราคา','定價方式'],manual:['Manual rate','ราคาต่อหน่วยที่ระบุ','手動單價'],markup:['Markup %','บวกเพิ่มต้นทุน %','成本加成 %'],
  rate:['Rate','ราคาต่อหน่วย','單價'],amount:['Amount','จำนวนเงิน','金額'],total:['Total','รวม','總額'],
  reason:['Change / negotiation reason','เหตุผลที่แก้ไข / ต่อรอง','變更／議價原因'],mappingReason:['Mapping reason','เหตุผลการเชื่อมโยง','對應原因'],
  zeroReason:['Included / free-line reason','เหตุผลรายการรวม / ไม่คิดเงิน','已含／免費項目原因'],priceReason:['Pricing reason','เหตุผลการตั้งราคา','定價原因'],
  addLine:['Add line','เพิ่มรายการ','新增項目'],remove:['Remove','ลบรายการ','移除'],addMapping:['Add source mapping','เพิ่มการเชื่อมโยงต้นทุน','新增來源對應'],
  preview:['Preview pricing','ตรวจสอบราคา','預覽定價'],save:['Save draft','บันทึกฉบับร่าง','儲存草稿'],newDraft:['New draft','สร้างฉบับร่าง','新增草稿'],
  newRevision:['New revision from approved version','สร้างฉบับใหม่จากฉบับที่อนุมัติ','從已核准版本建立修訂'],submit:['Submit','ส่งอนุมัติ','送審'],
  workflow:['Approval workflow','ขั้นตอนอนุมัติ','核准流程'],approve:['Approve','อนุมัติ','核准'],reject:['Reject','ไม่อนุมัติ','退回'],
  note:['Approval note (optional)','หมายเหตุการอนุมัติ (ไม่บังคับ)','核准備註（選填）'],history:['Immutable history','ประวัติที่แก้ไขไม่ได้','不可變更的歷史'],
  print:['Print','พิมพ์','列印'],export:['Export CSV','ส่งออก CSV','匯出 CSV'],state:['State','สถานะ','狀態'],working:['Working cost BOQ','BOQ ต้นทุนฉบับทำงาน','作業中成本清單'],
  revisions:['Cost revision history','ประวัติฉบับต้นทุน','成本修訂歷史'],loading:['Loading…','กำลังโหลด…','載入中…'],
  error:['The operation could not complete. Review the inputs and refresh the record.','ดำเนินการไม่สำเร็จ โปรดตรวจสอบข้อมูลและโหลดรายการใหม่','操作未完成。請檢查輸入並重新整理紀錄。'],
  empty:['No records available.','ยังไม่มีรายการ','目前沒有紀錄。'],noSource:['No eligible approved cost revision is available.','ยังไม่มีฉบับต้นทุนที่อนุมัติและใช้เป็นแหล่งข้อมูลได้','目前沒有符合條件的已核准成本修訂。'],
  noAccess:['No BOQ read access.','ไม่มีสิทธิ์อ่าน BOQ','沒有工程量清單讀取權限。'],
  quantityInfo:['Rates, cost totals, notes and commercial prices are withheld.','ไม่แสดงราคาต่อหน่วย ยอดต้นทุน หมายเหตุ และราคาลูกค้า','不提供單價、成本總額、備註與客戶價格。'],
  rules:['Positive quantities follow unit precision (up to 4 places). Explain independent quantities/units, split mappings and free lines. Approved versions are immutable.','ปริมาณต้องมากกว่าศูนย์และตรงทศนิยมของหน่วย (สูงสุด 4 ตำแหน่ง) ระบุเหตุผลเมื่อปริมาณ/หน่วยต่างกัน แบ่งต้นทุน หรือไม่คิดเงิน ฉบับอนุมัติแก้ไขไม่ได้','數量須大於零，並符合單位精度（最多 4 位）。獨立數量／單位、拆分對應與免費項目須說明原因。已核准版本不可變更。'],
  rounding:['Rate-first rounding may differ from the target total; review the stored rate and difference before submitting.','การปัดราคาต่อหน่วยก่อนอาจทำให้ยอดต่างจากเป้าหมาย โปรดตรวจสอบราคาที่บันทึกและส่วนต่างก่อนส่งอนุมัติ','先四捨五入單價可能產生總額差異；送審前請檢查儲存單價與差額。'],
  target:['Target amount','ยอดเป้าหมาย','目標金額'],difference:['Rounding difference','ส่วนต่างการปัดเศษ','四捨五入差額'],basis:['Allocated cost basis','ต้นทุนที่จัดสรร','分配成本基礎'],unused:['Unused source coverage %','สัดส่วนต้นทุนที่ยังไม่จัดสรร %','未分配來源比例 %'],
  attachments:['Protected attachments','เอกสารแนบที่จำกัดสิทธิ์','受保護附件'],type:['Document type','ประเภทเอกสาร','文件類型'],file:['File','ไฟล์','檔案'],upload:['Upload','อัปโหลด','上傳'],download:['Download','ดาวน์โหลด','下載'],refresh:['Refresh','โหลดใหม่','重新整理'],
} as const;
export type BoqTextKey = keyof typeof labels;
export function boqText(key:BoqTextKey, locale:'en'|'th'|'zh-TW'){return labels[key][locale==='en'?0:locale==='th'?1:2];}
export function useBoqText(){const locale=useContext(MonetaryLocaleContext);return (key:BoqTextKey)=>boqText(key,locale);}
