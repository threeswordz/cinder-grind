import { createContext, useContext } from 'react';
import { Alert } from '@mui/material';
import type { Locale } from './role-workspace-i18n';

export const MonetaryLocaleContext = createContext<Locale>('en');
const messages = {
  en: { unknown: 'Currency unverified', policy: 'New monetary activity requires Thai baht (THB). Historical records retain their original currency; unknown currency is never assumed to be THB.' },
  th: { unknown: 'ยังไม่ยืนยันสกุลเงิน', policy: 'รายการทางการเงินใหม่ต้องใช้เงินบาท (THB) ประวัติเดิมคงสกุลเงินต้นทาง และจะไม่ถือว่าสกุลเงินที่ไม่ทราบเป็นเงินบาท' },
  'zh-TW': { unknown: '幣別未確認', policy: '新增金額交易必須使用泰銖 (THB)。歷史紀錄保留原幣別；未確認的幣別不會被視為泰銖。' },
};
export function CurrencyLabel({ code }: { code: string | null | undefined }) {
  const locale = useContext(MonetaryLocaleContext);
  return <span lang={locale}>{code ?? messages[locale].unknown}</span>;
}
export function MonetaryPolicyNotice() {
  const locale = useContext(MonetaryLocaleContext);
  return <Alert severity="info" lang={locale}>{messages[locale].policy}</Alert>;
}
