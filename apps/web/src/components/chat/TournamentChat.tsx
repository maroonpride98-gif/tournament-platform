'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Send, User, MessageSquare, X, Minimize2, Maximize2 } from 'lucide-react';
import { useChatSocket } from '@/lib/socket';
import { api } from '@/lib/api';

interface Message {
  id: string;
  content: string;
  userId: string;
  user: {
    id: string;
    username: string;
    avatar?: string;
  };
  createdAt: string;
}

interface TournamentChatProps {
  tournamentId: string;
  chatRoomId: string;
  tournamentName: string;
}

export function TournamentChat({ tournamentId, chatRoomId, tournamentName }: TournamentChatProps) {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isConnected, messages: realtimeMessages, sendMessage } = useChatSocket(
    isOpen ? chatRoomId : undefined
  );

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get(`/chat/${chatRoomId}/messages`);
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, [chatRoomId]);

  useEffect(() => {
    if (isOpen && chatRoomId) {
      fetchMessages();
    }
  }, [isOpen, chatRoomId, fetchMessages]);

  useEffect(() => {
    if (realtimeMessages.length > 0) {
      const latest = realtimeMessages[realtimeMessages.length - 1];
      setMessages((prev) => [...prev, latest]);
    }
  }, [realtimeMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !session) return;

    const content = newMessage.trim();
    setNewMessage('');

    try {
      await api.post(`/chat/${chatRoomId}/messages`, { content });
      // Message will be received via socket
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(content); // Restore message on error
    }
  };

  const currentUserId = (session?.user as any)?.id;

  if (!session) return null;

  return (
    <>
      {/* Chat Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 p-4 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors z-40"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div
          className={`fixed bottom-6 right-6 w-80 bg-dark-800 border border-dark-700 rounded-xl shadow-2xl overflow-hidden z-50 transition-all ${
            isMinimized ? 'h-14' : 'h-[500px]'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-dark-900 border-b border-dark-700">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary-400" />
              <span className="font-medium text-white text-sm truncate max-w-[150px]">
                {tournamentName}
              </span>
              {isConnected && (
                <span className="w-2 h-2 bg-green-400 rounded-full" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 text-dark-400 hover:text-white rounded transition-colors"
              >
                {isMinimized ? (
                  <Maximize2 className="w-4 h-4" />
                ) : (
                  <Minimize2 className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-dark-400 hover:text-white rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[380px]">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-dark-400">
                    <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No messages yet</p>
                    <p className="text-xs">Be the first to say something!</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwn = message.userId === currentUserId;

                    return (
                      <div
                        key={message.id}
                        className={`flex items-start gap-2 ${
                          isOwn ? 'flex-row-reverse' : ''
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
                          {message.user.avatar ? (
                            <img
                              src={message.user.avatar}
                              alt={message.user.username}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <div
                          className={`max-w-[70%] ${
                            isOwn ? 'items-end' : 'items-start'
                          }`}
                        >
                          <p className={`text-xs text-dark-400 mb-1 ${
                            isOwn ? 'text-right' : ''
                          }`}>
                            {message.user.username}
                          </p>
                          <div
                            className={`px-3 py-2 rounded-lg text-sm ${
                              isOwn
                                ? 'bg-primary-600 text-white'
                                : 'bg-dark-700 text-white'
                            }`}
                          >
                            {message.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                className="flex items-center gap-2 p-3 border-t border-dark-700"
              >
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white text-sm placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
