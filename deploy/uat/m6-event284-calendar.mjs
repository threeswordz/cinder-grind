// Event284 calendar contract: exactly one non-default SITE_A synthetic calendar.
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_EVENT284_CALENDAR_'+c),{safeCode:'M6_EVENT284_CALENDAR_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
export const calendarName='M6-RESIDUAL-266 synthetic test calendar';
export const calendarDescription='SYNTHETIC REHEARSAL ONLY; not a business working-hours policy';
export function calendarBody(projectId){need(uuid(projectId),'PROJECT');return {projectId,calendarName,description:calendarDescription,timezoneName:'Asia/Bangkok',isDefault:false};}
export function calendarWeekdays(){return {weekdays:Array.from({length:7},(_,i)=>({weekdayNo:i+1,isWorking:true,startTime:'08:00',endTime:'17:00'}))};}
export function verifyCalendarHeader(row,b){const p=calendarBody(b.projectId);need(uuid(row?.id)&&row.companyId===b.companyId&&row.isActive===true&&Object.entries(p).every(([k,v])=>row[k]===v),'HEADER');return true;}
function time(v){if(v instanceof Date)return Number.isFinite(v.getTime())?v.toISOString().slice(11,19):null;if(typeof v==='string'&&/^\d{2}:\d{2}$/.test(v))return v+':00';if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))return v.slice(11,19);return null;}
export function verifyCalendarWeekdays(rows,id){need(uuid(id)&&Array.isArray(rows)&&rows.length===7&&new Set(rows.map(r=>r.id)).size===7&&calendarWeekdays().weekdays.every(w=>rows.filter(r=>uuid(r.id)&&r.workingCalendarId===id&&r.weekdayNo===w.weekdayNo&&r.isWorking===true&&time(r.startTime)==='08:00:00'&&time(r.endTime)==='17:00:00').length===1),'WEEKDAYS');return true;}
