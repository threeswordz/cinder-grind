// Auth identity is deliberately no-store in the pinned API. HR/data endpoints
// must keep private, no-store; never decode denials or attachment responses.
export function successorPrivacyHeaders(response,path,origin){
 const cache=(response.headers.get('cache-control')??'').toLowerCase().split(',').map(x=>x.trim());
 const identity=origin==='http://127.0.0.1:33072'&&path==='/auth/me'&&response.status===200;
 return (identity||cache.includes('private'))&&cache.includes('no-store')&&!cache.includes('public')&&response.headers.get('x-content-type-options')?.trim().toLowerCase()==='nosniff'&&!response.headers.has('content-disposition');
}
