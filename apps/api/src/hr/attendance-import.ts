import { attendanceDay, clockMinute } from './attendance-contract';

/** Bounded normalized CSV interchange, not a vendor-specific clock-device format.
 * Exact header, UTF-8 text, RFC4180-style quoted fields, no multiline fields. */
export function parseOfficeAttendanceCsv(raw: unknown) {
  if(typeof raw!=='string'||Buffer.byteLength(raw,'utf8')>262144) throw new Error('ATTENDANCE_CSV_INVALID');
  const source=raw.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  if(source.includes('\r')||source.includes('\0')) throw new Error('ATTENDANCE_CSV_INVALID');
  const records=source.endsWith('\n')?source.slice(0,-1).split('\n'):source.split('\n');
  if(records.length<2||records.length>1001) throw new Error('ATTENDANCE_CSV_INVALID');
  function fields(record:string):string[] {
    const result:string[]=[]; let value='',quoted=false,closed=false;
    for(let i=0;i<record.length;i++){
      const ch=record[i];
      if(quoted){
        if(ch==='"'&&record[i+1]==='"'){value+='"';i++;}
        else if(ch==='"'){quoted=false;closed=true;}
        else value+=ch;
      }else if(ch===','){result.push(value);value='';closed=false;}
      else if(ch==='"'&&value===''&&!closed)quoted=true;
      else if(closed||ch==='"')throw new Error('ATTENDANCE_CSV_INVALID');
      else value+=ch;
    }
    if(quoted)throw new Error('ATTENDANCE_CSV_INVALID');
    result.push(value);return result;
  }
  if(fields(records[0]!).join(',')!=='employeeCode,workDate,startTime,endTime,workType')throw new Error('ATTENDANCE_CSV_INVALID');
  return records.slice(1).map(record=>{
    const row=fields(record);
    if(row.length!==5)throw new Error('ATTENDANCE_CSV_INVALID');
    const [employeeCode,workDate,startTime,endTime,workType]=row as [string,string,string,string,string];
    if(!employeeCode.trim()||employeeCode!==employeeCode.trim()||employeeCode.length>50||!workType.trim()||workType.length>100)throw new Error('ATTENDANCE_CSV_INVALID');
    attendanceDay(workDate);
    const startMinute=clockMinute(startTime),endMinute=endTime==='24:00'?1440:clockMinute(endTime);
    if(startMinute>=endMinute)throw new Error('ATTENDANCE_CSV_INVALID');
    return {employeeCode,workDate,startMinute,endMinute,workType:workType.trim()};
  });
}
