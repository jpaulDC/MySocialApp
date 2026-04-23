import api from './api';
import * as signalR from '@microsoft/signalr';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ Palitan ng actual IP ng computer mo
const BASE_URL = 'http://192.168.1.105:5261';

// ══════════════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════════════

export interface Message
{
    id: number;
  content: string;
  isRead: boolean;
  sentAt: string;
  readAt?: string;

  // Sender info
  senderId: number;
  senderUsername: string;
  senderFullName?: string;
  senderPicture?: string;

  // Receiver info
  receiverId: number;
  receiverUsername: string;
  receiverFullName?: string;
  receiverPicture?: string;

  // Helper flag – true kung ikaw ang nagpadala
  isMyMessage: boolean;
}

export interface Conversation
{
    otherUserId: number;
  otherUsername: string;
  otherFullName?: string;
  otherPicture?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isLastMessageMine: boolean;
}

// ══════════════════════════════════════════════════════════════════════
//  REST API CALLS
// ══════════════════════════════════════════════════════════════════════

// Kunin ang chat history kasama ang isang specific user
export const getConversation = async (
  otherUserId: number,
  page = 1
): Promise<Message[]> => {
    const res = await api.get(
    `/ chat / conversation /${ otherUserId}?page =${ page}`
  );
    return res.data;
};

// Kunin ang lahat ng conversations (inbox)
export const getConversations = async (): Promise<Conversation[]> => {
    const res = await api.get('/chat/conversations');
    return res.data;
};

// Kunin ang total unread count (para sa badge)
export const getUnreadCount = async (): Promise<number> => {
    const res = await api.get('/chat/unread');
    return res.data.unreadCount;
};

// Mark messages as read
export const markAsRead = async (otherUserId: number): Promise<void> => {
    await api.put(`/ chat / read /${ otherUserId}`);
};

// ══════════════════════════════════════════════════════════════════════
//  SIGNALR CONNECTION MANAGEMENT
// ══════════════════════════════════════════════════════════════════════

// Singleton connection – isa lang ang connection sa buong app
let hubConnection: signalR.HubConnection | null = null;

// ── BUILD AT START NG SIGNALR CONNECTION ───────────────────────────────
export const startSignalRConnection =
  async (): Promise<signalR.HubConnection> => {

    // Kung connected na, ibalik ang existing connection
    if (
      hubConnection &&
      hubConnection.state === signalR.HubConnectionState.Connected
    )
    {
        return hubConnection;
    }

    // Kuhanin ang JWT token
    const token = await AsyncStorage.getItem('token');

    // I-build ang connection
    hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${ BASE_URL}/ hubs / chat`, {
    // JWT token bilang query param (kailangan ng SignalR)
    accessTokenFactory: () => token ?? '',
    })
    // Auto-reconnect: 0s, 2s, 5s, 10s, 30s
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

    // I-start ang connection
    await hubConnection.start();
    console.log('✅ SignalR connected! State:', hubConnection.state);

    return hubConnection;
};

// ── STOP CONNECTION (kapag nag-logout) ────────────────────────────────
export const stopSignalRConnection = async (): Promise<void> => {
    if (hubConnection)
    {
        await hubConnection.stop();
        hubConnection = null;
        console.log('🔌 SignalR disconnected.');
    }
};

// ── GET CURRENT CONNECTION ─────────────────────────────────────────────
export const getHubConnection = (): signalR.HubConnection | null => {
    return hubConnection;
};