import {apiRequest} from './client';
type Data<T>={data:T};
export type ReceivingChoice={id:string;warehouseName?:string;supplierName?:string;materialName?:string;defaultUomId?:string;uomCode?:string;poNumber?:string;supplierId?:string;lines?:Array<{id:string;lineNo:number;materialId:string|null;uomId:string;quantity:string;description:string}>};
export type ReceivingLine={id:string;materialId:string;uomId:string;material:{materialCode:string;materialName:string};uom:{uomCode:string};observedQuantity:string;goodQuantity:string;heldQuantity:string;condition:string;note:string;purchaseOrderLineId:string|null};
export type ReceivingDelivery={id:string;projectId:string;warehouseId:string;supplierId:string;receivedAt:string;poLinkDueAt:string;linkedAt:string|null;receiverName:string;reason:string;qualityRequired:boolean;purchaseOrderId:string|null;deadline:string;status:string;version:number;createdByUserId:string;checkedByUserId:string|null;checkNote:string|null;voidReason:string|null;supersedesId:string|null;usable:boolean;lines:ReceivingLine[];goodsReceipt:{id:string;receiptNumber:string;postedAt:string|null;reversedAt:string|null;submittedAt:string|null;approvalInstance:{approvalState:string}|null}|null;evidence:Array<{id:string;purpose:string;documentId:string|null;checksum:string|null;fileName:string|null;active:boolean;superseded:boolean;recordedAt:string}>;events:Array<{id:string;version:number;action:string;note:string;recordedAt:string;actor:{id:string;displayName:string}}>};
export type ReceivingSummary=Pick<ReceivingDelivery,'id'|'receivedAt'|'poLinkDueAt'|'linkedAt'|'status'|'version'|'receiverName'|'deadline'>;
const root='/inventory/receiving';
export const receivingApi={
 projects:()=>apiRequest<Data<Array<{id:string;projectCode:string;projectName:string}>>>(root+'/projects'),
 policy:(projectId:string)=>apiRequest<Data<{enabled:boolean;projectId:string;reason?:string}>>(root+'/projects/'+projectId+'/policy'),
 list:(projectId:string,after='')=>apiRequest<Data<{items:ReceivingSummary[];nextCursor:string|null}>>(root+'/projects/'+projectId+'/deliveries'+(after?'?after='+after:'')),
 get:(id:string)=>apiRequest<Data<ReceivingDelivery>>(root+'/deliveries/'+id),
 choices:(projectId:string,kind:string,after='')=>apiRequest<Data<{items:ReceivingChoice[];nextCursor:string|null}>>(root+'/projects/'+projectId+'/choices/'+kind+(after?'?after='+after:'')),
 command:(path:string,body:unknown)=>apiRequest<Data<{id?:string;version?:number}>>(path,{method:'POST',body:JSON.stringify(body)}),
};
