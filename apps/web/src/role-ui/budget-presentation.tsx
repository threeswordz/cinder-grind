import { useContext } from 'react';
import { Alert } from '@mui/material';
import type { BudgetBaseline } from '../api/cost-control';
import { MonetaryLocaleContext } from './monetary-presentation';

const messages = {
  en: {
    missing: 'No approved Budget',
    current: 'No approved Budget. Budget comparison and variance are unavailable; cost totals remain available.',
    original: 'No approved Original Budget. Original Budget comparison is unavailable.',
    portfolioOriginal: 'One or more projects has no approved Original Budget. Portfolio Original Budget comparison is incomplete.',
    portfolio: 'One or more projects has no approved Budget. Portfolio Budget comparison and variance are incomplete.',
  },
  th: {
    missing: 'ยังไม่มีงบประมาณที่อนุมัติ',
    current: 'ยังไม่มีงบประมาณที่อนุมัติ จึงยังเปรียบเทียบงบประมาณหรือแสดงผลต่างไม่ได้ แต่ยังแสดงยอดต้นทุนได้',
    original: 'ยังไม่มีงบประมาณตั้งต้นที่อนุมัติ จึงยังเปรียบเทียบงบประมาณตั้งต้นไม่ได้',
    portfolioOriginal: 'บางโครงการยังไม่มีงบประมาณตั้งต้นที่อนุมัติ การเปรียบเทียบงบประมาณตั้งต้นรวมจึงยังไม่ครบถ้วน',
    portfolio: 'บางโครงการยังไม่มีงบประมาณที่อนุมัติ การเปรียบเทียบงบประมาณและผลต่างรวมจึงยังไม่ครบถ้วน',
  },
  'zh-TW': {
    missing: '尚無已核准預算',
    current: '尚無已核准預算，因此無法比較預算或顯示差異；成本總額仍可查看。',
    original: '尚無已核准原始預算，因此無法比較原始預算。',
    portfolioOriginal: '部分專案尚無已核准原始預算，因此整體原始預算比較尚不完整。',
    portfolio: '部分專案尚無已核准預算，因此整體預算比較與差異尚不完整。',
  },
};

export function BudgetBaselineMessage({ baseline, portfolio = false }: { baseline: BudgetBaseline; portfolio?: boolean }) {
  const locale = useContext(MonetaryLocaleContext);
  if (baseline.original && baseline.current) return null;
  return <span lang={locale}>{messages[locale][portfolio ? baseline.current ? 'portfolioOriginal' : 'portfolio' : baseline.current ? 'original' : 'current']}</span>;
}

export function BudgetBaselineNotice({ baseline, portfolio = false }: { baseline: BudgetBaseline; portfolio?: boolean }) {
  if (baseline.original && baseline.current) return null;
  return <Alert severity="warning"><BudgetBaselineMessage baseline={baseline} portfolio={portfolio} /></Alert>;
}

export function BudgetValue({ available, value, currency }: { available: boolean; value: string; currency?: string }) {
  const locale = useContext(MonetaryLocaleContext);
  return <span lang={locale}>{available ? [currency, value].filter(Boolean).join(' ') : messages[locale].missing}</span>;
}
