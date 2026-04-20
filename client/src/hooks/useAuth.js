import { useCallback, useEffect, useState } from 'react';

function getIdentity() {
  return typeof window !== 'undefined' ? window.netlifyIdentity : null;
}

export function useAuth() {
  const ni = getIdentity();
  const [user, setUser] = useState(() => ni?.currentUser() ?? null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ni = getIdentity();
    if (!ni) {
      setLoading(false);
      return;
    }
    ni.on('init', (u) => {
      setUser(u ?? null);
      setLoading(false);
    });
    ni.on('login', (u) => {
      setUser(u);
      ni.close();
    });
    ni.on('logout', () => setUser(null));
    ni.init();
    return () => {
      ni.off('init');
      ni.off('login');
      ni.off('logout');
    };
  }, []);

  const login = useCallback(() => getIdentity()?.open('login'), []);
  const signup = useCallback(() => getIdentity()?.open('signup'), []);
  const logout = useCallback(() => getIdentity()?.logout(), []);

  /** Bearer token for API calls — refreshed automatically by the widget. */
  const getToken = useCallback(() => {
    return user?.token?.access_token ?? null;
  }, [user]);

  const authHeaders = useCallback(() => {
    const token = user?.token?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [user]);

  return { user, loading, login, signup, logout, getToken, authHeaders };
}
