import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

const socketOrigin =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export function SocketProvider({ children }) {
  const { identity } = useAuth();
  const socketRef = useRef(null);
  const activeTokenRef = useRef(null);
  const activeUserIdRef = useRef(null);
  const subscriptions = useRef({ tournaments: new Set(), groups: new Set() });
  const [connected, setConnected] = useState(false);

  const userId = identity?.id;

  useEffect(() => {
    const token = window.localStorage.getItem('evoq.accessToken');

    // 1. If not authenticated or no token, disconnect any active socket
    if (!userId || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      activeTokenRef.current = null;
      activeUserIdRef.current = null;
      setConnected(false);
      return;
    }

    // 2. If socket already exists for the SAME user and token, do NOT recreate (prevents premature aborts)
    if (
      socketRef.current &&
      activeUserIdRef.current === userId &&
      activeTokenRef.current === token
    ) {
      return;
    }

    // 3. Disconnect previous socket if user or token changed
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    activeUserIdRef.current = userId;
    activeTokenRef.current = token;

    const socket = io(socketOrigin, {
      path: '/socket.io',
      transports: ['polling', 'websocket'],
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    function handleConnect() {
      setConnected(true);
      subscriptions.current.tournaments.forEach((id) => socket.emit('join_tournament', Number(id)));
      subscriptions.current.groups.forEach((id) => socket.emit('join_group', Number(id)));
    }

    function handleDisconnect() {
      setConnected(false);
    }

    function handleConnectError() {
      setConnected(false);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
      setConnected(false);
    };
  }, [userId]);

  const joinTournament = useCallback((id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) return;
    subscriptions.current.tournaments.add(String(numId));
    socketRef.current?.emit('join_tournament', numId);
  }, []);

  const leaveTournament = useCallback((id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) return;
    subscriptions.current.tournaments.delete(String(numId));
    socketRef.current?.emit('leave_tournament', numId);
  }, []);

  const joinGroup = useCallback((id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) return;
    subscriptions.current.groups.add(String(numId));
    socketRef.current?.emit('join_group', numId);
  }, []);

  const leaveGroup = useCallback((id) => {
    const numId = Number(id);
    if (!Number.isSafeInteger(numId) || numId <= 0) return;
    subscriptions.current.groups.delete(String(numId));
    socketRef.current?.emit('leave_group', numId);
  }, []);

  const on = useCallback((event, handler) => {
    const socket = socketRef.current;
    if (!socket || typeof handler !== 'function') return () => {};
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, []);

  const sendMessage = useCallback(
    (payload) =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket) {
          return reject(new Error('Realtime connection not established'));
        }
        socket.emit('send_message', payload, (result) => {
          if (result?.ok) {
            resolve(result.message);
          } else {
            reject(new Error(result?.error || 'Unable to send message'));
          }
        });
      }),
    [],
  );

  const value = useMemo(
    () => ({
      connected,
      joinTournament,
      leaveTournament,
      joinGroup,
      leaveGroup,
      on,
      sendMessage,
    }),
    [connected, joinTournament, leaveTournament, joinGroup, leaveGroup, on, sendMessage],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error('useSocket must be used inside SocketProvider');
  return context;
}
