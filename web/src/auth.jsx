import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api/client.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const refresh = useCallback(
    () =>
      api('/me')
        .then((d) => setUser(d.user))
        .catch(() => setUser(null)),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);
  const signOut = async () => {
    await api('/auth/signout', { method: 'POST' });
    setUser(null);
  };
  return <Ctx.Provider value={{ user, setUser, refresh, signOut }}>{children}</Ctx.Provider>;
}
