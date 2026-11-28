import {z} from 'zod';
import {apiRequest} from '../api/client';
const line=z.object({employeeId:z.string().uuid(),workDate:z.string(),startMinute:z.number().int().min(0).max(1439),
  endMinute:z.number().int().min(1).max(1440),workType:z.string().max(100)});
const snapshot=z.object({id:z.string().uuid(),projectId:z.null(),periodStart:z.string(),version:z.number().int().positive(),
  state:z.literal('SUBMITTED'),action:z.literal('OFFICE_SAVE'),lines:z.array(line.extend({employee:z.object({employeeCode:z.string(),employeeName:z.string()})})).max(1000)});
const preview=z.object({expectedVersion:z.number().int().nonnegative(),lines:z.array(line).min(1).max(1000)});
export type OfficePreview=z.infer<typeof preview>;
const route=(companyId:string,period:string)=>'/hr/companies/'+encodeURIComponent(companyId)+'/office-attendance/'+encodeURIComponent(period);
export async function getOfficeAttendance(companyId:string,period:string){
  return z.object({data:snapshot.nullable()}).parse(await apiRequest<unknown>(route(companyId,period))).data;
}
export async function previewOfficeAttendance(companyId:string,period:string,csv:string,expectedVersion:number){
  return z.object({data:preview}).parse(await apiRequest<unknown>(route(companyId,period)+'/preview',
    {method:'POST',body:JSON.stringify({csv,expectedVersion})})).data;
}
export async function saveOfficeAttendance(companyId:string,period:string,value:OfficePreview&{requestId:string;reason:string}){
  return z.object({data:z.object({id:z.string().uuid(),version:z.number().int().positive()})}).parse(
    await apiRequest<unknown>(route(companyId,period),{method:'POST',body:JSON.stringify(value)})).data;
}
