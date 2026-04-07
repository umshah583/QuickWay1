"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import { MessageCircle, Send, Users, RefreshCw, Bell } from "lucide-react";

interface ChatMessage {
  id: string;
  message: string;
  messageType: string;
  sender: {
    id: string;
    name: string | null;
    image: string | null;
  };
  senderType: 'CUSTOMER' | 'DRIVER' | 'SYSTEM' | 'ADMIN';
  readAt: Date | null;
  createdAt: Date;
  delivered?: boolean;
}

interface ChatConversation {
  id: string;
  bookingId: string;
  customer: {
    id: string;
    name: string | null;
    image: string | null;
  };
  driver: {
    id: string;
    name: string | null;
    image: string | null;
  };
  booking: {
    id: string;
    startAt: Date;
    service: {
      name: string;
    };
    status: string;
    taskStatus: string;
  };
  lastMessage: ChatMessage | null;
  messageCount: number;
  status: string;
  updatedAt: Date;
  isCustomer: boolean;
  isDriver: boolean;
}

export default function AdminChatPage() {
  const { data: session } = useSession();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to deduplicate messages by ID
  const deduplicateMessages = (msgs: ChatMessage[]): ChatMessage[] => {
    return Array.from(new Map(msgs.map(msg => [msg.id, msg])).values());
  };

  // Initialize Socket.IO connection
  useEffect(() => {
    if (!session?.user) return;

    console.log('[AdminChat] Session data:', session.user);

    const initSocket = async () => {
      try {
        console.log('[AdminChat] Initializing socket connection...');
        
        // Get JWT token for socket authentication
        const tokenResponse = await fetch('/api/admin/chat-token', { method: 'POST' });
        const tokenData = await tokenResponse.json();
        
        console.log('[AdminChat] Token response:', tokenData);
        
        if (!tokenData.token) {
          console.error('[AdminChat] Failed to get auth token');
          return;
        }

        console.log('[AdminChat] Creating socket connection to:', window.location.origin);
        const socketInstance = io(window.location.origin, {
          transports: ['websocket'],
          auth: {
            token: tokenData.token,
          },
        });

        socketInstance.on('connect', () => {
          console.log('[AdminChat] ✅ Connected to server with socket ID:', socketInstance.id);
          setIsConnected(true);
          console.log('[AdminChat] Sending auth token...');
          socketInstance.emit('auth', { token: tokenData.token });
        });

        socketInstance.on('auth_success', (data) => {
          console.log('[AdminChat] ✅ Authentication successful:', data);
          // Join any already selected conversation immediately
          if (selectedConversation) {
            console.log('[AdminChat] 🚪 Joining chat room after auth:', selectedConversation.id);
            socketInstance.emit('join_chat', { conversationId: selectedConversation.id });
          }
        });

        socketInstance.on('disconnect', (reason) => {
          console.log('[AdminChat] ❌ Disconnected from server:', reason);
          setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
          console.error('[AdminChat] ❌ Connection error:', error.message);
        });

        socketInstance.on('auth_failed', (error) => {
          console.error('[AdminChat] ❌ Authentication failed:', error);
        });

        socketInstance.on('chat_joined', (data) => {
          console.log('[AdminChat] 📝 Chat joined successfully:', data);
        });

        socketInstance.on('auth_required', (data) => {
          console.log('[AdminChat] 🔐 Auth required:', data);
          socketInstance.emit('auth', { token: tokenData.token });
        });

        socketInstance.on('chat_message', (data: any) => {
          const startTime = performance.now();
          const delay = data.timestamp ? Date.now() - data.timestamp : 'unknown';
          console.log('[AdminChat] 💬 Chat message received (room broadcast):', data);
          console.log('[AdminChat] ⏱️ Delay from server:', delay, 'ms');
          
          if (selectedConversation && data.conversationId === selectedConversation.id) {
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === data.message.id);
              if (!exists) {
                console.log('[AdminChat] Adding message to UI:', data.message.id);
                const updated = [...prev, { ...data.message, delivered: true }];
                return deduplicateMessages(updated);
              }
              // Message already exists (likely from optimistic update), update it with status
              console.log('[AdminChat] Updating existing message:', data.message.id);
              const updated = prev.map(msg => msg.id === data.message.id ? { 
                ...data.message, 
                delivered: true,
                readAt: data.message.readAt || msg.readAt 
              } : msg);
              return deduplicateMessages(updated);
            });
            console.log('[AdminChat] UI updated in:', performance.now() - startTime, 'ms');

            // If message is from someone else, mark it as read immediately since chat is open
            if (data.message.sender?.id !== session?.user?.id && socketInstance) {
              console.log('[AdminChat] 📖 Marking message as read since chat is open:', data.message.id);
              socketInstance.emit('message_read', {
                conversationId: selectedConversation.id,
                messageId: data.message.id,
              });
            }
          }
        });

        socketInstance.on('chat.message.new', (data: any) => {
          const startTime = performance.now();
          console.log('[AdminChat] 💬 New chat message received (direct):', data);
          
          if (selectedConversation && data.conversationId === selectedConversation.id) {
            setMessages(prev => {
              const exists = prev.some(msg => msg.id === data.message.id);
              if (!exists) {
                console.log('[AdminChat] Adding message to UI:', data.message.id);
                const updated = [...prev, { ...data.message, delivered: true }];
                return deduplicateMessages(updated);
              }
              // Message already exists (likely from optimistic update), update it with status
              console.log('[AdminChat] Updating existing message:', data.message.id);
              const updated = prev.map(msg => msg.id === data.message.id ? { 
                ...data.message, 
                delivered: true,
                readAt: data.message.readAt || msg.readAt 
              } : msg);
              return deduplicateMessages(updated);
            });
            console.log('[AdminChat] UI updated in:', performance.now() - startTime, 'ms');

            // If message is from someone else, mark it as read immediately since chat is open
            if (data.message.sender?.id !== session?.user?.id && socketInstance) {
              console.log('[AdminChat] 📖 Marking message as read since chat is open:', data.message.id);
              socketInstance.emit('message_read', {
                conversationId: selectedConversation.id,
                messageId: data.message.id,
              });
            }
          }
        });

        socketInstance.on('typing_started', (data: any) => {
          console.log('[AdminChat] ⌨️ Typing started:', data);
          if (selectedConversation && data.conversationId === selectedConversation.id && data.userId !== session?.user?.id) {
            setIsTyping(true);
            setTypingUser(data.userName || 'Someone');
            // Clear typing indicator after 3 seconds of no updates
            setTimeout(() => {
              setIsTyping(false);
              setTypingUser(null);
            }, 3000);
          }
        });

        socketInstance.on('typing_stopped', (data: any) => {
          console.log('[AdminChat] ⌨️ Typing stopped:', data);
          if (selectedConversation && data.conversationId === selectedConversation.id && data.userId !== session?.user?.id) {
            setIsTyping(false);
            setTypingUser(null);
          }
        });

        socketInstance.on('message_read', (data: any) => {
          console.log('[AdminChat] 📖 Message read event received:', data);
          if (selectedConversation && data.conversationId === selectedConversation.id) {
            // Update the specific message to mark as read
            setMessages(prev => {
              const updated = prev.map(msg => {
                // If this is the message that was read
                if (data.messageId && msg.id === data.messageId) {
                  return { ...msg, readAt: data.readAt || new Date() };
                }
                return msg;
              });
              return deduplicateMessages(updated);
            });
          }
        });

        setSocket(socketInstance);
      } catch (error) {
        console.error('[AdminChat] Failed to initialize socket:', error);
      }
    };

    initSocket();

    return () => {
      // Cleanup will be handled when socket is set
    };
  }, [session]);

  // Fetch conversations
  useEffect(() => {
    fetchConversations();
  }, [session]);

  // Join chat room when conversation is selected
  useEffect(() => {
    console.log('[AdminChat] 🔄 Conversation selection useEffect triggered:', {
      hasSocket: !!socket,
      isConnected,
      hasSelectedConversation: !!selectedConversation,
      conversationId: selectedConversation?.id
    });
    
    if (socket && isConnected && selectedConversation) {
      console.log('[AdminChat] 🚪 Joining chat room:', selectedConversation.id);
      socket.emit('join_chat', { conversationId: selectedConversation.id });
      fetchMessages(selectedConversation.id);
    } else {
      console.log('[AdminChat] ⚠️ Cannot join room - conditions not met:', {
        hasSocket: !!socket,
        isConnected,
        hasSelectedConversation: !!selectedConversation
      });
    }
  }, [selectedConversation, socket, isConnected]);

  // Auto-scroll to bottom - use instant scrolling for faster display
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  // Emit typing events when admin types
  useEffect(() => {
    if (!socket || !selectedConversation || !session?.user) return;

    let typingTimeout: ReturnType<typeof setTimeout> | null = null;

    if (messageInput.trim()) {
      // Emit typing started
      socket.emit('typing_started', {
        conversationId: selectedConversation.id,
        userId: session.user.id,
        userName: session.user.name,
      });

      // Clear any existing timeout
      if (typingTimeout) clearTimeout(typingTimeout);

      // Emit typing stopped after 3 seconds of no typing
      typingTimeout = setTimeout(() => {
        socket.emit('typing_stopped', {
          conversationId: selectedConversation.id,
          userId: session.user.id,
        });
      }, 3000);
    } else {
      // Emit typing stopped immediately if message is empty
      socket.emit('typing_stopped', {
        conversationId: selectedConversation.id,
        userId: session.user.id,
      });
    }

    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
    };
  }, [messageInput, socket, selectedConversation, session?.user]);

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/chat/conversations');
      const data = await response.json();
      setConversations(data.conversations || []);
      // Calculate unread count
      const unread = (data.conversations || []).filter((conv: any) => conv.unreadCount > 0).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('[AdminChat] Failed to fetch conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTestConversation = async () => {
    try {
      const response = await fetch('/api/admin/create-test-conversation', { method: 'POST' });
      const data = await response.json();
      
      if (response.ok) {
        console.log('[AdminChat] Test conversation created:', data);
        alert(`Test conversation created!\nService: ${data.service}\nCustomer: ${data.customer}\nDriver: ${data.driver}`);
        // Refresh conversations list
        fetchConversations();
      } else {
        alert(`Failed to create test conversation: ${data.error}`);
      }
    } catch (error) {
      console.error('[AdminChat] Failed to create test conversation:', error);
      alert('Failed to create test conversation');
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      const data = await response.json();
      const uniqueMessages = deduplicateMessages(data.messages || []);
      console.log('[AdminChat] 📨 Loaded', uniqueMessages.length, 'unique messages (deduped from', data.messages?.length || 0, ')');
      setMessages(uniqueMessages);
    } catch (error) {
      console.error('[AdminChat] Failed to fetch messages:', error);
    }
  };

  const sendMessage = async () => {
    console.log('[AdminChat] 📤 sendMessage called', {
      hasMessage: !!messageInput.trim(),
      messageLength: messageInput.length,
      hasConversation: !!selectedConversation,
      conversationId: selectedConversation?.id,
      isConnected
    });

    if (!messageInput.trim() || !selectedConversation) {
      console.log('[AdminChat] ⚠️ sendMessage blocked - missing message or conversation');
      return;
    }

    // Optimistic update - add message to UI immediately
    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      message: messageInput.trim(),
      messageType: 'TEXT',
      sender: {
        id: session?.user?.id || 'unknown',
        name: session?.user?.name || 'Admin',
        image: session?.user?.image || null,
      },
      senderType: 'ADMIN',
      readAt: null,
      createdAt: new Date(),
      delivered: false, // Initially not delivered (single tick)
    };
    
    console.log('[AdminChat] 📝 Adding optimistic message to UI:', tempMessage.id);
    setMessages(prev => deduplicateMessages([...prev, tempMessage]));
    const messageToSend = messageInput;
    setMessageInput("");

    try {
      console.log('[AdminChat] 🚀 Sending message to API:', selectedConversation.id);
      const response = await fetch(`/api/chat/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageInput }),
      });

      console.log('[AdminChat] API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[AdminChat] ✅ Message sent successfully:', data);
        // Replace temporary message with real one from server - mark as delivered (double grey tick)
        setMessages(prev => deduplicateMessages(prev.map(msg => 
          msg.id === tempMessage.id ? { ...data.data, delivered: true } : msg
        )));
      } else {
        const errorData = await response.json();
        console.error('[AdminChat] ❌ API returned error:', response.status, errorData);
        // Remove temporary message on error
        setMessages(prev => deduplicateMessages(prev.filter(msg => msg.id !== tempMessage.id)));
        setMessageInput(messageToSend); // Restore the message text
      }
    } catch (error) {
      console.error('[AdminChat] ❌ Failed to send message:', error);
      // Remove temporary message on error
      setMessages(prev => deduplicateMessages(prev.filter(msg => msg.id !== tempMessage.id)));
      setMessageInput(messageToSend); // Restore the message text
    }
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="flex h-[calc(100vh-200px)] bg-white rounded-lg shadow-lg">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              Chat Conversations
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <button
                onClick={createTestConversation}
                className="px-3 py-1 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors"
              >
                Create Test
              </button>
              <button
                onClick={fetchConversations}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">No conversations found</div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedConversation?.id === conversation.id
                    ? 'bg-blue-50 border-l-4 border-l-blue-500'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-sm">
                    {conversation.booking.service.name}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {formatTime(conversation.updatedAt)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mb-1">
                  Customer: {conversation.customer.name || 'Unknown'}
                </div>
                <div className="text-xs text-gray-600 mb-2">
                  Driver: {conversation.driver.name || 'Unknown'}
                </div>
                {conversation.lastMessage && (
                  <div className="text-xs text-gray-500 truncate">
                    {conversation.lastMessage.message}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">
                    {conversation.messageCount} messages
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    conversation.status === 'ACTIVE' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {conversation.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    {selectedConversation.booking.service.name}
                  </h3>
                  <div className="text-sm text-gray-600">
                    Customer: {selectedConversation.customer.name || 'Unknown'} | 
                    Driver: {selectedConversation.driver.name || 'Unknown'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-gray-500">
                    {isConnected ? 'Live' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#ECE5DD]">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.senderType === 'ADMIN' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg ${
                      message.senderType === 'ADMIN'
                        ? 'bg-[#DCF8C6] text-gray-800 border border-[#DCF8C6]'
                        : message.senderType === 'SYSTEM'
                        ? 'bg-gray-200 text-gray-700'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                    style={{
                      borderBottomRightRadius: message.senderType === 'ADMIN' ? '2px' : '8px',
                      borderBottomLeftRadius: message.senderType === 'ADMIN' ? '8px' : '2px',
                    }}
                  >
                    {message.senderType !== 'ADMIN' && (
                      <div className="text-xs font-bold text-[#128C7E] mb-1">
                        {message.sender.name || message.senderType}
                      </div>
                    )}
                    <div className="text-sm">{message.message}</div>
                    <div className={`text-xs mt-1 flex justify-end items-center gap-1 ${
                      message.senderType === 'ADMIN' ? 'text-gray-600' : 'text-gray-500'
                    }`}>
                      {formatTime(message.createdAt)}
                      {message.senderType === 'ADMIN' && (
                        <span className={`ml-2 ${
                          message.readAt ? 'text-[#34B7F1]' : message.delivered ? 'text-gray-400' : 'text-gray-400'
                        }`}>
                          {message.delivered ? (message.readAt ? '✓✓' : '✓✓') : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {isTyping && typingUser && (
              <div className="px-4 py-2 bg-gray-100 text-sm text-gray-600 italic border-t border-gray-200">
                {typingUser} is typing...
              </div>
            )}

            {/* Message Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  // disabled={!isConnected}
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageInput.trim() /* || !isConnected */}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  title={isConnected ? 'Send message' : 'Not connected to server'}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
