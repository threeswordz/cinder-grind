import {useState} from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import type {CurrentUser} from './api/auth';
import {setCsrfToken} from './api/client';
import {AdminConsole} from './AdminConsole';
// One data cache per authenticated identity/Company/effective-permission scope.
// A replacement gets a new client: late old responses cannot enter its cache.
// Do not clear this client in effect cleanup: StrictMode replays those effects.
export function AuthenticatedWorkspace({user,onLogoutSuccess}:{user:CurrentUser;onLogoutSuccess:()=>Promise<unknown>}){
  const [client]=useState(()=>{
    setCsrfToken(null);
    return new QueryClient({defaultOptions:{queries:{retry:1,refetchOnWindowFocus:false}}});
  });
  return <QueryClientProvider client={client}><AdminConsole user={user} onLogoutSuccess={onLogoutSuccess}/></QueryClientProvider>;
}
