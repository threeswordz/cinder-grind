import {Alert,Stack} from '@mui/material';
import {BudgetPanel} from './BudgetPanel';
import {CustomerBoqPanel} from './CustomerBoqPanel';
import {QuantityBoqPanel} from './QuantityBoqPanel';
import {useBoqText} from './boq-i18n';
import type {ComponentProps} from 'react';
export function BudgetWorkspace(props:ComponentProps<typeof BudgetPanel>){
  const t=useBoqText(),p=props.permissions;
  const full=p.includes('budget.boq.view')||p.includes('budget.revision.view');
  const customer=['budget.boq.view','budget.revision.view','budget.customer.view'].every(x=>p.includes(x));
  return <Stack spacing={2}>{full?<BudgetPanel {...props}/>:p.includes('budget.quantity.view')?<QuantityBoqPanel/>:<Alert severity="info">{t('noAccess')}</Alert>}
    {full&&p.includes('budget.quantity.view')&&(!p.includes('budget.boq.view')||!p.includes('budget.revision.view'))?<QuantityBoqPanel/>:null}
    {customer?<CustomerBoqPanel permissions={p}/>:null}</Stack>;
}
