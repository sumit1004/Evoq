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
  const [serverError, setServerError] = useState(false);

  const logout = useCallback(() => {
    window.localStorage.removeItem('evoq.accessToken');
    window.localStorage.removeItem(storageKey);
    setIdentity(null);
    setServerError(false);
  }, []);

  function persist(result) {
    window.localStorage.setItem('evoq.accessToken', result.token);
    window.localStorage.setItem(storageKey, JSON.stringify(result.identity));
    setIdentity(result.identity);
    setServerError(false);
  }

  const login = useCallback(async (credentials) => {
    try { const { data } = await apiClient.post('/auth/login', credentials); persist(data); return data.identity; }
    catch (error) { throw normalizeApiError(error); }
  }, []);

  const signup = useCallback(async (account) => {
    try { const { data } = await apiClient.post('/auth/signup', account); persist(data); return data.identity; }
    catch (error) { throw normalizeApiError(error); }
  }, []);

  const verifySession = useCallback(() => {
    const token = window.localStorage.getItem('evoq.accessToken');
    if (!token) {
      setLoading(false);
      setServerError(false);
      return;
    }
    setLoading(true);
    setServerError(false);
    
    apiClient.get('/auth/me')
      .then(({ data }) => {
        setIdentity(data.identity);
        window.localStorage.setItem(storageKey, JSON.stringify(data.identity));
      })
      .catch((error) => {
        const status = error.response?.status;
        if (status === 401) {
          logout();
        } else {
          setServerError(true);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [logout]);

  useEffect(() => {
    // Interceptor to handle global 401s (token expiration)
    const interceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          const isLoginRequest = error.config?.url?.endsWith('/auth/login');
          if (!isLoginRequest) {
            logout();
          }
        }
        return Promise.reject(error);
      }
    );

    verifySession();

    return () => {
      apiClient.interceptors.response.eject(interceptor);
    };
  }, [logout, verifySession]);

  const value = useMemo(() => ({ identity, loading, serverError, login, signup, logout, retry: verifySession }), [identity, loading, serverError, login, signup, logout, verifySession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
