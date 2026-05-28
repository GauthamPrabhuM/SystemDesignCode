'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { auth, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/store/auth';

function AuthInit() {
  const { setUser, setReady } = useAuth();

  useEffect(() => {
    const token = localStorage.getItem('sdc-access-token');
    if (!token) {
      setReady();
      return;
    }
    setAccessToken(token);
    auth.me()
      .then((me) => { setUser(me); })
      .catch(() => { setAccessToken(null); })
      .finally(() => { setReady(); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AuthInit />
      {children}
    </QueryClientProvider>
  );
}
