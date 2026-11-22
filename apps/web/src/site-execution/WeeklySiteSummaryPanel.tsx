import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContext, useMemo, useState } from 'react';

import { siteExecutionApi } from '../api/site-execution';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';

const DAY_MS = 86_400_000;

function mondayOfCurrentWeek() {
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const day = new Date(todayUtc).getUTCDay();
  return new Date(todayUtc - ((day + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
}
function endingDate(from: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return null;
  const day = new Date(from + 'T00:00:00.000Z');
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== from) return null;
  return new Date(day.getTime() + 6 * DAY_MS).toISOString().slice(0, 10);
}

const words = {
  en: {
    title: 'Weekly site report', week: 'First day of seven-day period',
    loading: 'Loading weekly source reports…', error: 'Weekly reports are unavailable. Verify your Project access.',
    draft: 'Draft', submitted: 'Submitted', missing: 'No report',
    missingNote: 'No report is not an overdue finding. Current calendars may change; historical deadlines are not established by this preview.',
    calendarConfigured: 'Current Project calendar preview (not historical deadline compliance):',
    calendarMissing: 'No unique, valid default Project/Company calendar; planned workdays and reporting deadlines remain unknown.',
    workday: 'Planned workday', offday: 'Planned off-day: report not required',
    unknownDay: 'Workday status unknown', due: 'Next planned workday starts', clockUnknown: 'Start time not configured',
    readOnly: 'Source-derived view. Ben may acknowledge what was reviewed; this is not formal approval.',
    reviewUnrecorded: 'Ben review: not yet acknowledged',
    reviewAck: 'Ben review acknowledged (not approved)',
    reviewStale: 'Previous Ben review is stale: weekly source changed. Review again.',
    reviewBy: 'Reviewed by user', reviewAt: 'at',
    reviewNote: 'Ben review note / outstanding exceptions',
    reviewAction: 'Acknowledge reviewed weekly source (not approval)',
    noWorkReason: 'Reason for no work on a planned working day',
    noWorkDeclare: 'Record planned no-work day',
    noWorkCorrect: 'Append reason correction',
    noWorkDeclared: 'Planned-day stoppage',
    noWorkNeedsCheck: 'Source corrections after no-work evidence require reconciliation',
    noWorkHelp: 'First submit an empty daily report for a configured planned workday. Reason history is append-only.',
    saveNoWork: 'Record reason evidence', cancel: 'Cancel',
    operationFailed: 'Unable to record review evidence. Check authorization, source state or refresh the week.',
    days: 'Days', issues: 'Issues', delays: 'Delays', inspections: 'Inspections',
    manpower: 'People observed', progress: 'Activity observations', corrections: 'Corrections',
    open: 'Open daily report', noProgress: 'No recorded activity observations',
    submittedDays: 'Submitted days', draftDays: 'Draft days', missingDays: 'Unrecorded days',
  },
  th: {
    title: 'รายงานหน้างานรายสัปดาห์', week: 'วันแรกของช่วง 7 วัน',
    loading: 'กำลังโหลดรายงานรายสัปดาห์…', error: 'ไม่สามารถแสดงรายงานได้ กรุณาตรวจสอบสิทธิ์โครงการ',
    draft: 'ฉบับร่าง', submitted: 'ส่งแล้ว', missing: 'ไม่มีรายงาน',
    missingNote: 'การไม่มีรายงานไม่ใช่ข้อสรุปว่าส่งล่าช้า ปฏิทินปัจจุบันอาจเปลี่ยนแปลง จึงยังยืนยันกำหนดส่งในอดีตไม่ได้',
    calendarConfigured: 'ตัวอย่างตามปฏิทินโครงการปัจจุบัน (ไม่ใช่การตรวจการส่งล่าช้าในอดีต):',
    calendarMissing: 'ไม่มีปฏิทินโครงการ/บริษัทหลักที่ถูกต้องและไม่ซ้ำกัน จึงยังระบุวันทำงานและกำหนดส่งไม่ได้',
    workday: 'วันทำงานตามแผน', offday: 'วันหยุดตามแผน: ไม่ต้องส่งรายงาน',
    unknownDay: 'ไม่ทราบสถานะวันทำงาน', due: 'วันทำงานถัดไปเริ่ม', clockUnknown: 'ยังไม่กำหนดเวลาเริ่มงาน',
    readOnly: 'สรุปจากรายงานต้นฉบับ คุณเบนบันทึกการรับทราบได้ แต่ไม่ใช่การอนุมัติ',
    reviewUnrecorded: 'คุณเบนยังไม่ได้รับทราบการตรวจทาน',
    reviewAck: 'คุณเบนรับทราบการตรวจทานแล้ว (ไม่ใช่อนุมัติ)',
    reviewStale: 'รายงานต้นฉบับเปลี่ยนหลังการรับทราบ โปรดตรวจทานอีกครั้ง',
    reviewBy: 'ตรวจทานโดยผู้ใช้', reviewAt: 'เมื่อ',
    reviewNote: 'หมายเหตุการตรวจทานของคุณเบน / ข้อค้างดำเนินการ',
    reviewAction: 'รับทราบการตรวจทานรายสัปดาห์ (ไม่ใช่อนุมัติ)',
    noWorkReason: 'เหตุผลที่ไม่ได้ทำงานในวันทำงานตามแผน',
    noWorkDeclare: 'บันทึกวันหยุดงานตามแผนที่หยุดทำจริง',
    noWorkCorrect: 'เพิ่มการแก้ไขเหตุผล',
    noWorkDeclared: 'หยุดงานในวันทำงานตามแผน',
    noWorkNeedsCheck: 'มีการแก้ไขรายงานหลังบันทึกหยุดงาน ต้องตรวจสอบความสอดคล้อง',
    noWorkHelp: 'ต้องส่งรายงานประจำวันแบบไม่มีงานสำหรับวันทำงานตามแผนก่อน ประวัติเหตุผลจะไม่ถูกเขียนทับ',
    saveNoWork: 'บันทึกหลักฐานเหตุผล', cancel: 'ยกเลิก',
    operationFailed: 'ไม่สามารถบันทึกได้ กรุณาตรวจสอบสิทธิ์และสถานะรายงาน แล้วรีเฟรช',
    days: 'วัน', issues: 'ปัญหา', delays: 'ความล่าช้า', inspections: 'การตรวจ',
    manpower: 'จำนวนคนที่บันทึก', progress: 'รายการความก้าวหน้ากิจกรรม', corrections: 'การแก้ไข',
    open: 'เปิดรายงานประจำวัน', noProgress: 'ไม่มีบันทึกความก้าวหน้ากิจกรรม',
    submittedDays: 'วันที่ส่งแล้ว', draftDays: 'วันที่เป็นฉบับร่าง', missingDays: 'วันที่ไม่มีรายงาน',
  },
  'zh-TW': {
    title: '工地週報', week: '七日期間的第一天',
    loading: '載入工地週報中…', error: '無法取得週報，請檢查專案存取權限。',
    draft: '草稿', submitted: '已提交', missing: '沒有報告',
    missingNote: '未有報告不代表逾期；現行日曆可變更，無法據此判定歷史提交期限。',
    calendarConfigured: '依目前專案工作日曆預覽（不代表歷史期限合規）：',
    calendarMissing: '缺少唯一有效的專案／公司預設日曆，無法確定工作日與提交期限。',
    workday: '計畫工作日', offday: '計畫休息日：無需日報',
    unknownDay: '工作日狀態未明', due: '下一工作日開始', clockUnknown: '未設定開始時間',
    readOnly: '彙整原始日報；Ben 可記錄檢視確認，但並非正式核准。',
    reviewUnrecorded: 'Ben 尚未記錄檢視確認',
    reviewAck: 'Ben 已確認檢視（非核准）',
    reviewStale: '來源已變更，先前檢視確認已過期，請重新檢視',
    reviewBy: '檢視者', reviewAt: '時間',
    reviewNote: 'Ben 的檢視備註／未完成事項',
    reviewAction: '記錄週報檢視確認（非核准）',
    noWorkReason: '計畫工作日未施工的原因',
    noWorkDeclare: '登記計畫工作日停工',
    noWorkCorrect: '追加原因更正',
    noWorkDeclared: '計畫工作日停工',
    noWorkNeedsCheck: '停工記錄後來源經更正，需要核對',
    noWorkHelp: '請先提交該計畫工作日的零施工日報；原因更正僅追加，不會覆寫歷史。',
    saveNoWork: '記錄原因證據', cancel: '取消',
    operationFailed: '無法記錄，請檢查權限或來源資料後重新整理。',
    days: '天', issues: '問題', delays: '延誤', inspections: '檢查',
    manpower: '記錄人數', progress: '活動進度記錄', corrections: '修正',
    open: '開啟日報', noProgress: '沒有活動進度記錄',
    submittedDays: '已提交天數', draftDays: '草稿天數', missingDays: '無報告天數',
  },
} as const;

export function WeeklySiteSummaryPanel({
  projectId,
  onOpenReport,
}: {
  projectId: string;
  onOpenReport: (id: string) => void;
}) {
  const locale = useContext(MonetaryLocaleContext);
  const t = words[locale];
  const queryClient = useQueryClient();
  const [reviewNote, setReviewNote] = useState('');
  const [noWorkReason, setNoWorkReason] = useState('');
  const [editingReportId, setEditingReportId] = useState('');
  const reviewMutation = useMutation({
    mutationFn: (payload: {projectId:string;from:string;to:string;fingerprint:string;note:string}) =>
      siteExecutionApi.acknowledgeWeekly(payload.projectId,payload.from,payload.to,payload.fingerprint,payload.note),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey:['site-execution','weekly',projectId]});
      setReviewNote('');
    },
  });
  const noWorkMutation = useMutation({
    mutationFn: (payload: {id:string;reason:string;previousEventId:string|null}) =>
      siteExecutionApi.declareNoWork(payload.id,payload.reason,payload.previousEventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey:['site-execution','weekly',projectId]});
      setEditingReportId('');
      setNoWorkReason('');
    },
  });
  const [from, setFrom] = useState(mondayOfCurrentWeek);
  const to = useMemo(() => endingDate(from), [from]);
  const week = useQuery({
    queryKey: ['site-execution', 'weekly', projectId, from, to],
    queryFn: () => siteExecutionApi.weekly(projectId, from, to!),
    enabled: Boolean(projectId && to),
  });
  // Do not display cached data from a previous Project after the selector changes.
  // React Query can retain the previous successful payload after a denied
  // refetch. Never re-display private sources unless the CURRENT query is
  // successful; loading/error states must fail closed even for the same Project.
  const data = week.isSuccess && !week.isFetching && !week.isError &&
    week.data?.data.projectId === projectId
    ? week.data.data : null;

  return (
    <Card variant="outlined" lang={locale}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="subtitle1">{t.title}</Typography>
          <TextField
            label={t.week}
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            fullWidth
          />
          <Alert severity="info">{t.readOnly}</Alert>
          {week.isFetching ? <Typography>{t.loading}</Typography> : null}
          {week.isError || (to === null)
            ? <Alert severity="error">{t.error}</Alert> : null}
          {data ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {data.from} — {data.to}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={t.submittedDays + ': ' + data.totals.submittedDays} />
                <Chip label={t.draftDays + ': ' + data.totals.draftDays} />
                <Chip label={t.missingDays + ': ' + data.totals.missingDays} />
                <Chip label={t.issues + ': ' + data.totals.issues} />
                <Chip label={t.delays + ': ' + data.totals.delays} />
                <Chip label={t.inspections + ': ' + data.totals.inspections} />
              </Stack>
              <Alert severity="info">{t.missingNote}</Alert>
              <Alert severity={data.weeklyReview.status==='ACKNOWLEDGED'?'success':
                data.weeklyReview.status==='STALE'?'warning':'info'}>
                {data.weeklyReview.status==='ACKNOWLEDGED'?t.reviewAck:
                  data.weeklyReview.status==='STALE'?t.reviewStale:t.reviewUnrecorded}
                {data.weeklyReview.review ? ' · '+t.reviewBy+': '+
                  data.weeklyReview.review.reviewedByUserId+' '+t.reviewAt+' '+
                  data.weeklyReview.review.reviewedAt : ''}
                {data.weeklyReview.review?.note ? ' · '+data.weeklyReview.review.note : ''}
              </Alert>
              {data.weeklyReview.canAcknowledge && data.weeklyReview.status!=='ACKNOWLEDGED' ? (
                <Stack spacing={1}>
                  <TextField label={t.reviewNote} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}
                    multiline minRows={2} slotProps={{htmlInput:{maxLength:2000}}} />
                  <Button variant="outlined" disabled={reviewMutation.isPending}
                    onClick={() => reviewMutation.mutate({
                      projectId,from:data.from,to:data.to,
                      fingerprint:data.weeklyReview.fingerprint,note:reviewNote,
                    })}>
                    {t.reviewAction}
                  </Button>
                </Stack>
              ) : null}
              {(reviewMutation.isError||noWorkMutation.isError) ?
                <Alert severity="error">{t.operationFailed}</Alert> : null}
              {data.workCalendarPreview?.status==='CONFIGURED'
                ? <Alert severity="info">{t.calendarConfigured}{' '}
                    {data.workCalendarPreview.calendarName} ({data.workCalendarPreview.timezoneName})
                  </Alert>
                : <Alert severity="warning">{t.calendarMissing}</Alert>}
              {data.days.map((day) => {
                const calendarDay=data.workCalendarPreview?.days.find(item=>item.date===day.date);
                const noWork=day.report ? data.noWorkByReportId[day.report.id] : undefined;
                const canDeclare=Boolean(day.report&&
                  data.weeklyReview.canDeclareNoWork&&
                  day.report.createdBy.id===data.weeklyReview.viewerUserId&&
                  day.status==='SUBMITTED'&&
                  day.report.totalManpower===0&&
                  day.report.counts.materialUsage===0&&
                  day.report.counts.equipmentUsage===0&&
                  day.report.counts.progressLines===0&&
                  day.report.counts.inspections===0&&
                  day.report.counts.corrections===0&&
                  calendarDay?.plannedDayKind==='PLANNED_WORKDAY');
                return (
                <Box key={day.date} sx={{ borderTop: 1, borderColor: 'divider', pt: 1 }}>
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography fontWeight={600}>{day.date}</Typography>
                      <Chip size="small" label={
                        day.status === 'SUBMITTED' ? t.submitted
                          : day.status === 'DRAFT' ? t.draft : t.missing
                      } />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {calendarDay?.plannedDayKind==='PLANNED_WORKDAY'?t.workday:
                        calendarDay?.plannedDayKind==='PLANNED_OFF_DAY'?t.offday:t.unknownDay}
                      {calendarDay?.plannedDayKind==='PLANNED_WORKDAY'&&calendarDay.dueLocalDate
                        ? ' · '+t.due+': '+calendarDay.dueLocalDate+' '+
                          (calendarDay.dueLocalStartTime??t.clockUnknown)+' '+
                          (data.workCalendarPreview?.timezoneName??'')
                        : ''}
                      {calendarDay?.exceptionReason?' · '+calendarDay.exceptionReason:''}
                    </Typography>
                    {day.report ? (
                      <>
                        <Typography variant="body2">
                          {day.report.createdBy.displayName} · {t.manpower}: {day.report.totalManpower} ·
                          {' '}{t.issues}: {day.report.counts.issues} · {t.delays}: {day.report.counts.delays}
                          {' '}· {t.inspections}: {day.report.counts.inspections}
                          {' '}· {t.corrections}: {day.report.counts.corrections}
                        </Typography>
                        {day.report.progressObservations.length ? (
                          <Stack spacing={0.5}>
                            <Typography variant="caption" color="text.secondary">{t.progress}</Typography>
                            {day.report.progressObservations.map((observation) => (
                              <Typography key={observation.activityId} variant="body2">
                                {observation.activityCode} — {observation.activityName}:
                                {' '}{observation.percentComplete}%
                                {observation.note ? ' · ' + observation.note : ''}
                              </Typography>
                            ))}
                          </Stack>
                        ) : <Typography variant="caption" color="text.secondary">{t.noProgress}</Typography>}
                        {noWork ? <Alert severity={noWork.status==='DECLARED'?'info':'warning'}>
                          {t.noWorkDeclared}: {noWork.reason} · {noWork.createdAt}
                          {noWork.status==='REQUIRES_RECONCILIATION'?' · '+t.noWorkNeedsCheck:''}
                        </Alert> : null}
                        {canDeclare ? (
                          <Stack spacing={1} alignItems="flex-start">
                            <Button size="small" variant="outlined" onClick={() => {
                              setEditingReportId(day.report!.id);
                              setNoWorkReason('');
                            }}>
                              {noWork?t.noWorkCorrect:t.noWorkDeclare}
                            </Button>
                            {editingReportId===day.report.id ? <>
                              <Typography variant="caption">{t.noWorkHelp}</Typography>
                              <TextField fullWidth multiline minRows={2} label={t.noWorkReason}
                                value={noWorkReason} onChange={e=>setNoWorkReason(e.target.value)}
                                slotProps={{htmlInput:{maxLength:1000}}} />
                              <Stack direction="row" spacing={1}>
                                <Button size="small" disabled={noWorkMutation.isPending||noWorkReason.trim().length<8}
                                  onClick={() => noWorkMutation.mutate({
                                    id:day.report!.id,reason:noWorkReason,
                                    previousEventId:noWork?.eventId??null,
                                  })}>{t.saveNoWork}</Button>
                                <Button size="small" onClick={() => setEditingReportId('')}>{t.cancel}</Button>
                              </Stack>
                            </> : null}
                          </Stack>
                        ) : null}
                        <Button size="small" variant="outlined" onClick={() => onOpenReport(day.report!.id)}>
                          {t.open}
                        </Button>
                      </>
                    ) : null}
                  </Stack>
                </Box>
                );
              })}
            </Stack>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
}
