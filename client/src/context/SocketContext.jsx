import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);
const socketOrigin = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:4000' : window.location.origin);

export function SocketProvider({ children }) {
  const { identity } = useAuth(); const socketRef = useRef(null); const subscriptions = useRef({ tournaments: new Set(), groups: new Set() }); const [connected, setConnected] = useState(false);
  useEffect(() => { const token = window.localStorage.getItem('evoq.accessToken'); if (!identity || !token) { socketRef.current?.disconnect(); socketRef.current = null; setConnected(false); return undefined; } const socket = io(socketOrigin, { auth: { token }, autoConnect: true }); socketRef.current = socket; const onConnect = () => { setConnected(true); subscriptions.current.tournaments.forEach((id) => socket.emit('join_tournament', id)); subscriptions.current.groups.forEach((id) => socket.emit('join_group', id)); }; const onDisconnect = () => setConnected(false); socket.on('connect', onConnect); socket.on('disconnect', onDisconnect); return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.disconnect(); socketRef.current = null; setConnected(false); }; }, [identity]);
  const joinTournament = useCallback((id) => { subscriptions.current.tournaments.add(String(id)); socketRef.current?.emit('join_tournament', Number(id)); }, []);
  const leaveTournament = useCallback((id) => { subscriptions.current.tournaments.delete(String(id)); socketRef.current?.emit('leave_tournament', Number(id)); }, []);
  const joinGroup = useCallback((id) => { subscriptions.current.groups.add(String(id)); socketRef.current?.emit('join_group', Number(id)); }, []);
  const leaveGroup = useCallback((id) => { subscriptions.current.groups.delete(String(id)); socketRef.current?.emit('leave_group', Number(id)); }, []);
  const on = useCallback((event, handler) => { socketRef.current?.on(event, handler); return () => socketRef.current?.off(event, handler); }, []);
  const sendMessage = useCallback((payload) => new Promise((resolve, reject) => { socketRef.current?.emit('send_message', payload, (result) => result?.ok ? resolve(result.message) : reject(new Error(result?.error || 'Unable to send message'))); }), []);
  const value = useMemo(() => ({ connected, joinTournament, leaveTournament, joinGroup, leaveGroup, on, sendMessage }), [connected, joinTournament, leaveTournament, joinGroup, leaveGroup, on, sendMessage]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
export function useSocket() { const context = useContext(SocketContext); if (!context) throw new Error('useSocket must be used inside SocketProvider'); return context; }
