const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseOfficeAttendanceCsv:parse}=require('./attendance-import.js');
const header='employeeCode,workDate,startTime,endTime,workType\n';
test('normalized office CSV supports BOM, CRLF, quotes and midnight end',()=>{
  const rows=parse('\uFEFF'+header.replace('\n','\r\n')+'E1,2026-11-20,08:00,24:00,"Office, ""งาน"""\r\n');
  assert.deepEqual(rows,[{employeeCode:'E1',workDate:'2026-11-20',startMinute:480,endMinute:1440,workType:'Office, "งาน"'}]);
});
test('invalid header, bad clock, malformed quotes, extra fields, empty and oversized CSV fail closed',()=>{
  for(const x of ['x\nE1',header,header+'E1,2026-11-31,08:00,17:00,Office',header+'E1,2026-11-20,17:00,08:00,Office',header+'E1,2026-11-20,08:00,17:00,"Open',header+'E1,2026-11-20,08:00,17:00,"Closed"x',header+'E1,2026-11-20,08:00,17:00,Office,x',header+'x'.repeat(262145)])assert.throws(()=>parse(x));
});
