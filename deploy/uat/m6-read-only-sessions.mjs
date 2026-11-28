// Read-only diagnostics only. Deployment/session-revocation gates are unchanged.
// Use database transaction time, not the inspector host's clock.
export async function requireNoLiveSessions(tx){
  const rows=await tx.$queryRawUnsafe(`SELECT
    COUNT(*) FILTER (WHERE revoked_at IS NULL) AS unrevoked,
    COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP) AS active,
    COUNT(*) FILTER (WHERE revoked_at IS NULL AND expires_at <= CURRENT_TIMESTAMP) AS expired
    FROM public.user_sessions`);
  const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
  if(!Array.isArray(rows)||rows.length!==1)fail('M6_SESSION_COUNTS_INVALID');
  const {unrevoked,active,expired}=rows[0]??{};
  if(![unrevoked,active,expired].every(n=>typeof n==='bigint'&&n>=0n)||unrevoked!==active+expired)fail('M6_SESSION_COUNTS_INVALID');
  if(active!==0n)fail('M6_NATIVE_ACTIVE_SESSIONS');
  // Keep expired sessions and their historical bytes intact. This result is
  // not permission to drain, migrate, deploy, or mutate the runtime.
  return true;
}
