import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
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
    readOnly: 'Source-derived view only. Ben reviews without formal approval or acknowledgment.',
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
    readOnly: 'ข้อมูลสรุปจากรายงานเดิมเท่านั้น คุณเบนตรวจสอบได้โดยไม่มีขั้นตอนอนุมัติหรือรับทราบ',
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
    readOnly: '僅彙整原始日報；Ben 僅檢視，不進行正式核准或簽收。',
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
              {data.workCalendarPreview?.status==='CONFIGURED'
                ? <Alert severity="info">{t.calendarConfigured}{' '}
                    {data.workCalendarPreview.calendarName} ({data.workCalendarPreview.timezoneName})
                  </Alert>
                : <Alert severity="warning">{t.calendarMissing}</Alert>}
              {data.days.map((day) => {
                const calendarDay=data.workCalendarPreview?.days.find(item=>item.date===day.date);
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
