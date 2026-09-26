import { UnprocessableEntityException } from '@nestjs/common';

export function invalid(field: string, message: string) {
  return new UnprocessableEntityException({
    code: 'VALIDATION_ERROR',
    detail: 'One or more fields are invalid.',
    errors: [{ field, message }],
  });
}
export function object(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw invalid('body','Request body must be a JSON object.');
  return body as Record<string, unknown>;
}
export function str(body: Record<string, unknown>, field: string, max: number) {
  const value=body[field];
  if(typeof value!=='string'||!value.trim()||value.trim().length>max) throw invalid(field,'Is required and must be at most '+max+' characters.');
  return value.trim();
}
export function nullable(body: Record<string, unknown>, field: string, max: number) {
  const value=body[field]; if(value===undefined)return undefined; if(value===null)return null;
  if(typeof value!=='string'||value.trim().length>max) throw invalid(field,'Must be a string of at most '+max+' characters.');
  return value.trim()||null;
}
export function bool(body: Record<string, unknown>, field: string) {
  const value=body[field]; if(value===undefined)return undefined; if(typeof value!=='boolean')throw invalid(field,'Must be a boolean.'); return value;
}
export function code(value:string, field:string){const v=value.toUpperCase();if(!/^[A-Z0-9][A-Z0-9._-]*$/.test(v))throw invalid(field,'Use letters, numbers, dot, underscore or hyphen only.');return v;}
