import { Alert, Button, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { apiRequest } from '../api/client';

type ProjectWork = {
  id: string; projectCode: string; projectName: string;
  pendingPurchaseRequests: number|null; returnedLinesWithoutCorrection: number|null;
  correctionRequestsNotApproved: number|null; pendingStockCounts: number|null;
  toolsDueToday: number|null; toolsOverdue: number|null;
  pendingWorkOrders: number|null; pendingClaims: number|null;
  pendingCertifications: number|null;
  activeSiteWarehouses:number; configuredMinimums:number; comparableActiveMinimums:number;
  belowMinimumSiteDimensions:number; minimumsRequireReview:number;
  lateDeliveryLines:number; deliveryLinesDueToday:number; deliveryLinesWithin7Days:number;
  unknownDeliveryDateLines:number; deliverySourceReviewLines:number; lateRequiredOnSiteLines:number;
};
type Queue = { companyId: string; asOfThailandDate: string; projects: ProjectWork[] };
const columns = [
  ['pendingPurchaseRequests','PRs submitted'],
  ['returnedLinesWithoutCorrection','Returned lines without correction'],
  ['correctionRequestsNotApproved','Correction PRs not approved'],
  ['pendingStockCounts','Stock counts submitted'],
  ['toolsDueToday','Tools due today'],
  ['toolsOverdue','Tools overdue'],
  ['pendingWorkOrders','Work orders submitted'],
  ['pendingClaims','Claims submitted'],
  ['pendingCertifications','Certifications submitted'],
  ['activeSiteWarehouses','Active sites'],
  ['comparableActiveMinimums','Active comparable minima'],
  ['belowMinimumSiteDimensions','Below minimum (site dimensions)'],
  ['minimumsRequireReview','Minima require review'],
  ['lateDeliveryLines','Overdue PO lines'],
  ['deliveryLinesDueToday','PO lines due today'],
  ['deliveryLinesWithin7Days','PO lines due within 7 days'],
  ['unknownDeliveryDateLines','PO date unknown'],
  ['deliverySourceReviewLines','PO source review'],
  ['lateRequiredOnSiteLines','Required-on-site date passed'],
] as const;
export function PortfolioWorkQueuePanel({selectProject}: {selectProject:(id:string)=>void}) {
  const [result,setResult]=useState<Queue|null>(null);
  const [error,setError]=useState(false);
  const [reload,setReload]=useState(0);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;
    setResult(null);setError(false);setLoading(true);
    apiRequest<{data:Queue}>('/inventory/stock-minimums/portfolio-work-queue')
      .then(r=>{if(active)setResult(r.data)})
      .catch(()=>{if(active)setError(true)})
      .finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[reload]);
  return <Paper variant="outlined" sx={{p:2}}><Stack spacing={1.5}>
    <Typography variant="subtitle1">Project Manager — operational work queue / รายการงานติดตามรายโครงการ</Typography>
    <Alert severity="info">
      Active authorized Projects in the selected Company only. Counts are source record counts, not financial amounts.
      A dash means no view permission, not zero. Submitted documents are awaiting the relevant workflow; these are not all unresolved obligations.
      Stock warnings count configured site/material/unit dimensions; zero comparable minima means no configured comparable coverage, not proof of sufficient stock. PO lines count once per Project across all sites and approved revisions. Expected dates are internal PO dates, not confirmed supplier promises. Select a Project for site detail. No approval or posting.
    </Alert>
    <Button disabled={loading} onClick={()=>setReload(x=>x+1)}>Refresh portfolio / รีเฟรช</Button>
    {loading&&<Typography role="status">Loading authorized work queue…</Typography>}
    {error&&<Alert severity="error">Unable to read authorized work queue. Refresh or check current permissions; no counts are inferred.</Alert>}
    {result&&<><Typography variant="body2">Thailand date: {result.asOfThailandDate}</Typography>
    <TableContainer><Table size="small" aria-label="Authorized project operational work queue">
      <TableHead><TableRow><TableCell>Project / โครงการ</TableCell>
      {columns.map(([key,label])=><TableCell key={key} align="right">{label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{result.projects.map(row=><TableRow key={row.id}>
        <TableCell><Button onClick={()=>selectProject(row.id)}>{row.projectCode} — {row.projectName}</Button></TableCell>
        {columns.map(([key])=><TableCell key={key} align="right">{row[key]===null?'—':row[key]}</TableCell>)}
      </TableRow>)}
      {result.projects.length===0&&<TableRow><TableCell colSpan={columns.length+1}>No active authorized Projects.</TableCell></TableRow>}
      </TableBody>
    </Table></TableContainer></>}
  </Stack></Paper>;
}
