import { apiRequest } from './client';
type Data<T>={data:T};
export type WbsProject={id:string;projectCode:string;projectName:string};
export type WbsRecord={id:string;projectId:string;parentId:string|null;wbsCode:string;wbsName:string;description:string|null;isActive:boolean};
export type CostCodeRecord={id:string;costCode:string;costName:string;description:string|null;isActive:boolean};
export const wbsApi={
 projects:()=>apiRequest<Data<WbsProject[]>>('/wbs/projects'),
 list:(projectId:string)=>apiRequest<Data<WbsRecord[]>>('/wbs/projects/'+projectId),
 create:(projectId:string,body:Record<string,unknown>)=>apiRequest<Data<WbsRecord>>('/wbs/projects/'+projectId,{method:'POST',body:JSON.stringify(body)}),
 update:(projectId:string,id:string,body:Record<string,unknown>)=>apiRequest<Data<WbsRecord>>('/wbs/projects/'+projectId+'/'+id,{method:'PATCH',body:JSON.stringify(body)}),
 setWbsActive:(projectId:string,id:string,active:boolean)=>apiRequest<Data<WbsRecord>>('/wbs/projects/'+projectId+'/'+id+(active?'/reactivate':'/archive'),{method:'POST'}),
 costCodes:(search='',active='all')=>{const p=new URLSearchParams();if(search.trim())p.set('search',search.trim());if(active!=='all')p.set('active',active);return apiRequest<Data<CostCodeRecord[]>>('/cost-codes'+(p.toString()?'?'+p:''));},
 createCostCode:(body:Record<string,unknown>)=>apiRequest<Data<CostCodeRecord>>('/cost-codes',{method:'POST',body:JSON.stringify(body)}),
 updateCostCode:(id:string,body:Record<string,unknown>)=>apiRequest<Data<CostCodeRecord>>('/cost-codes/'+id,{method:'PATCH',body:JSON.stringify(body)}),
 setCostCodeActive:(id:string,active:boolean)=>apiRequest<Data<CostCodeRecord>>('/cost-codes/'+id+(active?'/reactivate':'/archive'),{method:'POST'})
};
