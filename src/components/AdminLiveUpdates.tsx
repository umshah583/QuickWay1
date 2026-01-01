'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

type LiveUpdateEvent = {
  type: 'services.changed' | 'bookings.updated' | 'subscription.request.approved' | 'subscription.request.rejected' | 'subscription.request.created' | 'subscription.created' | 'subscription.status.updated' | 'notifications.updated' | 'loyalty.updated' | 'generic';
  userId?: string;
  bookingId?: string;
  requestId?: string;
  subscriptionId?: string;
  timestamp?: number;
  payload?: Record<string, unknown>;
};

export function AdminLiveUpdates() {
  const { data: session } = useSession();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    console.log('[AdminLiveUpdates] useEffect triggered', { 
      hasSession: !!session,
      userRole: session?.user?.role,
      userEmail: session?.user?.email
    });
    
    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      console.log('[AdminLiveUpdates] Not admin user, skipping Socket.IO connection');
      return;
    }

    // Get mobile token from session for Socket.IO auth
    let mobileToken = (session as any)?.mobileToken;
    if (!mobileToken) {
      console.warn('[AdminLiveUpdates] No mobile token available for Socket.IO auth, generating admin token');
      // Fallback: generate a simple JWT-like token for admin users
      const userId = session?.user?.id;
      const email = session?.user?.email;
      const role = session?.user?.role;
      
      if (!userId) {
        console.error('[AdminLiveUpdates] Cannot authenticate admin - no session user ID');
        return;
      }
      
      // Create a simple JWT-like token (header.payload.signature)
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64').replace(/=/g, '');
      const payload = Buffer.from(JSON.stringify({ 
        sub: userId, 
        email, 
        role,
        iat: Math.floor(Date.now() / 1000)
      })).toString('base64').replace(/=/g, '');
      const signature = 'admin'; // Simple signature for admin fallback
      
      mobileToken = `${header}.${payload}.${signature}`;
      console.log('[AdminLiveUpdates] Generated fallback admin token');
    }

    const connectSocket = () => {
      if (socketRef.current?.connected) {
        console.log('[AdminLiveUpdates] Already connected');
        return;
      }

      console.log('[AdminLiveUpdates] Connecting to Socket.IO...');
      
      const socket = io('/', {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('[AdminLiveUpdates] Connected to Socket.IO with ID:', socket.id);
        reconnectAttempts.current = 0;
        setIsConnected(true);
        
        // Authenticate with mobile token
        console.log('[AdminLiveUpdates] Sending auth with token type:', typeof mobileToken);
        socket.emit('auth', { token: mobileToken });
      });

      socket.on('connected', (data) => {
        console.log('[AdminLiveUpdates] Server confirmed connection:', data.message);
      });

      socket.on('authenticated', (data) => {
        console.log('[AdminLiveUpdates] Authenticated as admin user:', data.userId);
      });

      socket.on('auth_failed', (data) => {
        console.error('[AdminLiveUpdates] Authentication failed:', data.message);
      });

      socket.on('live-update', (event: LiveUpdateEvent) => {
        console.log('[AdminLiveUpdates] Received live update:', event.type);
        
        // Trigger page refresh to update badge counts
        router.refresh();
        
        // Handle different event types for admin UI refresh
        switch (event.type) {
          case 'bookings.updated':
            // Refresh admin bookings pages
            router.refresh();
            break;
          
          case 'services.changed':
            // Refresh admin services and partners pages
            router.refresh();
            break;
          
          case 'subscription.request.created':
          case 'subscription.request.approved':
          case 'subscription.request.rejected':
          case 'subscription.created':
          case 'subscription.status.updated':
            // Refresh subscription requests and subscriptions pages
            router.refresh();
            break;
          
          case 'notifications.updated':
            // Refresh notifications and admin dashboard
            router.refresh();
            break;
          
          case 'loyalty.updated':
            // Refresh loyalty-related pages
            router.refresh();
            break;
          
          case 'generic':
            // Handle generic events - refresh based on payload
            if (event.payload?.event === 'subscription.request.created') {
              router.refresh();
            } else if (event.payload?.event === 'driver.assigned' || event.payload?.event === 'driver.started' || event.payload?.event === 'driver.completed') {
              router.refresh();
            } else {
              // Default refresh for unknown generic events
              router.refresh();
            }
            break;
          
          default:
            // Generic refresh for any other events
            router.refresh();
            break;
        }
      });

      socket.on('disconnect', (reason) => {
        console.log('[AdminLiveUpdates] Disconnected:', reason);
        setIsConnected(false);
        
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't auto-reconnect
          return;
        }
        
        // Auto-reconnect with backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current++;
          
          console.log(`[AdminLiveUpdates] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
          setTimeout(() => {
            connectSocket();
          }, delay);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('[AdminLiveUpdates] Connection error:', error);
      });
    };

    connectSocket();

    return () => {
      if (socketRef.current) {
        console.log('[AdminLiveUpdates] Cleaning up Socket.IO connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [session]);

  
  return null;
}
