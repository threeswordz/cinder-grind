// Redacted read-only observations. Never include SQL text, private values or raw errors.
export function safeFailure(error){
  const safeCode=typeof error?.safeCode==='string'&&/^M6_[A-Z0-9_]{1,100}$/.test(error.safeCode)?error.safeCode:'M6_NATIVE_PRIVATE_FAILURE';
  const result={safeCode};
  if(typeof error?.code==='string'&&/^P[0-9]{4}$/.test(error.code))result.prismaCode=error.code;
  if(typeof error?.meta?.code==='string'&&/^[0-9A-Z]{5}$/.test(error.meta.code))result.sqlState=error.meta.code;
  return result;
}
export async function observeStage(stage,operation){
  if(typeof stage!=='string'||!/^M6_[A-Z0-9_]{1,100}$/.test(stage))throw new Error('M6_DIAGNOSTIC_STAGE_INVALID');
  try{return {stage,status:'PASS',result:await operation()};}
  catch(error){return {stage,status:'BLOCKED',...safeFailure(error)};}
}
