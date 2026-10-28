import { apiDownload, apiRequest } from './client';
type Data<T> = {data:T};
export type CustomerLineInput = {lineId:string;description:string;quantity:string;uomId:string;method:'MANUAL'|'MARKUP';manualRate?:string;markupPercent?:string;mappingReason?:string;pricingReason?:string;zeroPriceReason?:string;mappings:{sourceLineId:string;sharePercent:string}[]};
export type CustomerDraft = {sourceRevisionId:string;previousVersionId?:string;reason:string;lines:CustomerLineInput[]};
export type CustomerOptions = {sources:{id:string;revisionNo:number;revisionNumber:string;currencyCode:string;lines:{id:string;itemCode:string;description:string;quantity:string;uomId:string;uomCode:string;rate:string;amount:string}[]}[];
  uoms:{id:string;uomCode:string;uomName:string;decimalPlaces:number}[];workflows:{workflowCode:string;workflowName:string}[]};
export type PriceLine = {lineId:string;quantity:string;uomId:string;rate:string;amount:string;method:'MANUAL'|'MARKUP';markupPercent:string|null;mappingReason:string|null;pricingReason:string|null;zeroPriceReason:string|null;costBasis:string;targetAmount:string|null;rateRoundingDifference:string|null};
export type PricePreview = {currencyCode:string;totalAmount:string;lines:PriceLine[];sourceCoverage:{sourceLineId:string;allocatedPercent:string;unallocatedPercent:string}[]};
export type VersionList = {id:string;versionNo:number;sourceRevisionId:string;previousVersionId:string|null;currentEditNo:number;approvalState:string;totalAmount:string;currencyCode:string};
export type CustomerEdit = {id:string;editNo:number;reason:string;createdAt:string;totalAmount:string;actorUserId:string;lines:{id:string;lineKey:string;description:string;quantity:string;uomId:string;uomSnapshot:{code:string;name:string;decimalPlaces:number};rate:string;amount:string;pricingSnapshot:PriceLine;mappings:{sourceLineId:string;sharePercent:string;allocatedCost:string}[]}[]};
export type CustomerHistory = {allowedActions:{edit:boolean;submit:boolean;decide:boolean};version:Omit<VersionList,'approvalState'|'totalAmount'> & {createdByUserId:string;submittedByUserId:string|null;approvalInstanceId:string|null;approvalInstance:{approvalState:string}|null;edits:CustomerEdit[]};
  approvals:{id:string;approvalState:string;startedAt:string;actions:{id:string;action:string;actionByUserId:string;comment:string|null;actionAt:string}[]}[]};
export type CustomerReceipt = {id:string;editNo:number;approvalState:string};
const path = (projectId:string) => '/budget/customer/projects/'+projectId;
export const customerBoqApi = {
  projects:()=>apiRequest<Data<{id:string;projectCode:string;projectName:string}[]>>('/budget/customer/projects'),
  options:(p:string)=>apiRequest<Data<CustomerOptions>>(path(p)+'/options'),
  list:(p:string)=>apiRequest<Data<VersionList[]>>(path(p)+'/versions'),
  history:(p:string,id:string)=>apiRequest<Data<CustomerHistory>>(path(p)+'/versions/'+id),
  preview:(p:string,draft:CustomerDraft,versionId?:string)=>apiRequest<Data<PricePreview>>(path(p)+'/preview',{method:'POST',body:JSON.stringify({draft,...(versionId?{versionId}:{})})}),
  save:(p:string,requestId:string,draft:CustomerDraft,id?:string,expectedEditNo?:number)=>apiRequest<Data<CustomerReceipt>>(path(p)+'/versions'+(id?'/'+id+'/edit':''),{method:'POST',body:JSON.stringify({requestId,draft,...(id?{expectedEditNo}:{})})}),
  submit:(p:string,id:string,requestId:string,expectedEditNo:number,workflowCode:string)=>apiRequest<Data<CustomerReceipt>>(path(p)+'/versions/'+id+'/submit',{method:'POST',body:JSON.stringify({requestId,expectedEditNo,workflowCode})}),
  decide:(p:string,id:string,requestId:string,expectedInstanceId:string,decision:'APPROVE'|'REJECT',comment?:string)=>apiRequest<Data<CustomerReceipt>>(path(p)+'/versions/'+id+'/decision',{method:'POST',body:JSON.stringify({requestId,expectedInstanceId,decision,...(comment?.trim()?{comment:comment.trim()}:{})})}),
  export:(p:string,id:string)=>apiDownload(path(p)+'/versions/'+id+'/export'),
};
