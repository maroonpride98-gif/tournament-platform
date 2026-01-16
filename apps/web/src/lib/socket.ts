import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
    });
  }
  return socket;
}

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    if (!socket.connected) {
      socket.connect();
    }

    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // Set initial state
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return { socket: socketRef.current, isConnected };
}

export function useTournamentSocket(tournamentId: string | undefined) {
  const { socket, isConnected } = useSocket();
  const [lastUpdate, setLastUpdate] = useState<any>(null);

  useEffect(() => {
    if (!socket || !tournamentId || !isConnected) return;

    // Join tournament room
    socket.emit('join:tournament', tournamentId);

    // Listen for updates
    const handleMatchUpdate = (data: any) => {
      setLastUpdate({ type: 'match', data, timestamp: Date.now() });
    };

    const handleBracketUpdate = (data: any) => {
      setLastUpdate({ type: 'bracket', data, timestamp: Date.now() });
    };

    const handleParticipantUpdate = (data: any) => {
      setLastUpdate({ type: 'participant', data, timestamp: Date.now() });
    };

    const handleStatusChange = (data: any) => {
      setLastUpdate({ type: 'status', data, timestamp: Date.now() });
    };

    socket.on('match:updated', handleMatchUpdate);
    socket.on('bracket:updated', handleBracketUpdate);
    socket.on('participant:updated', handleParticipantUpdate);
    socket.on('tournament:status', handleStatusChange);

    return () => {
      socket.emit('leave:tournament', tournamentId);
      socket.off('match:updated', handleMatchUpdate);
      socket.off('bracket:updated', handleBracketUpdate);
      socket.off('participant:updated', handleParticipantUpdate);
      socket.off('tournament:status', handleStatusChange);
    };
  }, [socket, tournamentId, isConnected]);

  return { isConnected, lastUpdate };
}

export function useChatSocket(chatRoomId: string | undefined) {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!socket || !chatRoomId || !isConnected) return;

    // Join chat room
    socket.emit('join:chat', chatRoomId);

    const handleMessage = (message: any) => {
      setMessages((prev) => [...prev, message]);
    };

    socket.on('chat:message', handleMessage);

    return () => {
      socket.emit('leave:chat', chatRoomId);
      socket.off('chat:message', handleMessage);
    };
  }, [socket, chatRoomId, isConnected]);

  const sendMessage = useCallback(
    (content: string) => {
      if (socket && chatRoomId) {
        socket.emit('chat:send', { chatRoomId, content });
      }
    },
    [socket, chatRoomId]
  );

  return { isConnected, messages, sendMessage };
}

export function useNotifications(userId: string | undefined) {
  const { socket, isConnected } = useSocket();
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    if (!socket || !userId || !isConnected) return;

    socket.emit('join:user', userId);

    const handleNotification = (notification: any) => {
      setNotifications((prev) => [notification, ...prev]);
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, userId, isConnected]);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { isConnected, notifications, clearNotification };
}
