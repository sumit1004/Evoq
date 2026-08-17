import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient, normalizeApiError } from '../services/apiClient.js';

const AuthContext = createContext(null);
const storageKey = 'evoq.identity';

function readIdentity() {
  try { return JSON.parse(window.localStorage.getItem(storageKey) || 'null'); } catch { return null; }
}

export function AuthProvider({ children }) {
  const [identity, setIdentity] = useState(readIdentity);
  const [loading, setLoading] = useState(() => Boolean(window.localStorage.getItem('evoq.accessToken')));

  useEffect(() => {
    const token = window.localStorage.getItem('evoq.accessToken');
    if (!token) { setLoading(false); return undefined; }
    let cancelled = false;
    apiClient.get('/auth/me')
      .then(({ data }) => { if (!cancelled) setIdentity(data.identity); })
      .catch(() => {
        if (cancelled) return;
        window.localStorage.removeItem('evoq.accessToken');
        window.localStorage.removeItem(storageKey);
        setIdentity(null);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function persist(result) {
    window.localStorage.setItem('evoq.accessToken', result.token);
    window.localStorage.setItem(storageKey, JSON.stringify(result.identity));
    setIdentity(result.identity);
  }

  const login = useCallback(async (credentials) => {
    try { const { data } = await apiClient.post('/auth/login', credentials); persist(data); return data.identity; }
    catch (error) { throw normalizeApiError(error); }
  }, []);

  const signup = useCallback(async (account) => {
    try { const { data } = await apiClient.post('/auth/signup', account); persist(data); return data.identity; }
    catch (error) { throw normalizeApiError(error); }
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem('evoq.accessToken');
    window.localStorage.removeItem(storageKey);
    setIdentity(null);
  }, []);

  const value = useMemo(() => ({ identity, loading, login, signup, logout }), [identity, loading, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
