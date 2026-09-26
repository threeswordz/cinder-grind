import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function equipmentInvalid(field: string, message: string): never {
  throw new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more Equipment fields are invalid.',
    errors: [{ field, message }],
  });
}

export function equipmentObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return equipmentInvalid('body', 'Must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function equipmentString(
  input: Record<string, unknown>,
  field: string,
  max: number,
  required = true,
): string | null | undefined {
  const value=input[field];
  if(value===undefined){
    if(required) return equipmentInvalid(field,'Is required.');
    return undefined;
  }
  if(value===null || value===''){
    if(required) return equipmentInvalid(field,'Is required.');
    return null;
  }
  if(typeof value!=='string') return equipmentInvalid(field,'Must be a string.');
  const trimmed=value.trim();
  if(!trimmed && required) return equipmentInvalid(field,'Is required.');
  if(trimmed.length>max) return equipmentInvalid(field,`Must be at most ${max} characters.`);
  return trimmed || null;
}

export function requiredEquipmentString(input:Record<string,unknown>,field:string,max:number):string {
  return equipmentString(input,field,max,true) as string;
}

export function nullableEquipmentString(input:Record<string,unknown>,field:string,max:number):string|null|undefined {
  return equipmentString(input,field,max,false);
}

export function equipmentUuid(value:unknown,field:string):string {
  if(typeof value!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)){
    return equipmentInvalid(field,'Must be a valid UUID.');
  }
  return value;
}

export function optionalEquipmentUuid(value:unknown,field:string):string|null|undefined {
  if(value===undefined) return undefined;
  if(value===null || value==='') return null;
  return equipmentUuid(value,field);
}

export function equipmentDate(value:unknown,field:string):Date {
  if(typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)){
    return equipmentInvalid(field,'Must use YYYY-MM-DD.');
  }
  const date=new Date(value+'T00:00:00.000Z');
  if(Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==value){
    return equipmentInvalid(field,'Must be a valid calendar date.');
  }
  return date;
}

export function optionalEquipmentHours(value:unknown,field:string):Prisma.Decimal|null|undefined {
  if(value===undefined) return undefined;
  if(value===null || value==='') return null;
  try{
    const decimal=new Prisma.Decimal(typeof value==='number'||typeof value==='string'?value:'');
    if(!decimal.isFinite() || decimal.lte(0) || decimal.gt(24)){
      return equipmentInvalid(field,'Must be greater than 0 and no more than 24.');
    }
    return decimal;
  }catch{
    return equipmentInvalid(field,'Must be a valid number greater than 0 and no more than 24.');
  }
}

export function equipmentBoolean(value:unknown,field:string):boolean {
  if(typeof value!=='boolean') return equipmentInvalid(field,'Must be boolean.');
  return value;
}

export function equipmentStatus(value:unknown,field='operationalStatus'):'AVAILABLE'|'UNAVAILABLE' {
  if(value!=='AVAILABLE' && value!=='UNAVAILABLE'){
    return equipmentInvalid(field,'Must be AVAILABLE or UNAVAILABLE.');
  }
  return value;
}
