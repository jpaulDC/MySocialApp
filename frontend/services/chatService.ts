import * as signalR from "@microsoft/signalr";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

const BASE_URL = "http://192.168.1.105:5261/api"; // ⚠️ Palitan ng IP mo

// ── TYPES ──────────────────────────────────────────────────────────────
export interface Message {
  id: number;
  content: string;
  isRead: boolean;
  sentAt: string;
  readAt?: string;
  senderId: number;
  senderUsername: string;
  senderFullName?: string;
  senderPicture?: string;
  receiverId: number;
  receiverUsername: string;
  receiverFullName?: string;
  receiverPicture?: string;
  isMyMessage: boolean;
}

export interface Conversation {
  otherUserId: number;
  otherUsername: string;
  otherFullName?: string;
  otherPicture?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isLastMessageMine: boolean;
}

// ── REST API CALLS ─────────────────────────────────────────────────────

// Get chat history with a specific user
export const getConversation = async (
  otherUserId: number,
  page = 1,
): Promise<Message[]> => {
  const res = await api.get(`/chat/conversation/${otherUserId}?page=${page}`);
  return res.data;
};

// Get inbox (all conversations)
export const getConversations = async (): Promise<Conversation[]> => {
  const res = await api.get("/chat/conversations");
  return res.data;
};

// Get total unread message count
export const getUnreadCount = async (): Promise<number> => {
  const res = await api.get("/chat/unread");
  return res.data.unreadCount;
};

// ── SIGNALR CONNECTION ─────────────────────────────────────────────────

let connection: signalR.HubConnection | null = null;

// Build and start the SignalR connection
export const startSignalRConnection =
  async (): Promise<signalR.HubConnection> => {
    // If already connected, return existing connection
    if (
      connection &&
      connection.state === signalR.HubConnectionState.Connected
    ) {
      return connection;
    }

    // Get JWT token for auth
    const token = await AsyncStorage.getItem("token");

    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/chat`, {
        // Pass token as query param (required for SignalR)
        accessTokenFactory: () => token ?? "",
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000]) // Retry delays in ms
      .configureLogging(signalR.LogLevel.Information)
      .build();

    await connection.start();
    console.log("✅ SignalR connected!");

    return connection;
  };

// Stop the SignalR connection (on logout)
export const stopSignalRConnection = async (): Promise<void> => {
  if (connection) {
    await connection.stop();
    connection = null;
    console.log("SignalR disconnected.");
  }
};

// Get current connection (null if not connected)
export const getConnection = (): signalR.HubConnection | null => connection;
