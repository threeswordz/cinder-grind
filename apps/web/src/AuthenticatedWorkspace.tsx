import {useEffect,useState} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import type {CurrentUser} from './api/auth';
import {setCsrfToken} from './api/client';
import {AdminConsole} from './AdminConsole';
// One data cache per authenticated identity/Company/effective-permission scope.
// Replacing this keyed component discards pending responses and old module data.
export function AuthenticatedWorkspace({user,onLogoutSuccess}:{user:CurrentUser;onLogoutSuccess:()=>Promise<unknown>}){
  const [client]=useState(()=>{
    setCsrfToken(null);
    return new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
  });
  useEffect(()=>()=>{void client.cancelQueries();client.clear();},[client]);
  return <QueryClientProvider client={client}><AdminConsole user={user} onLogoutSuccess={onLogoutSuccess}/></QueryClientProvider>;
}
