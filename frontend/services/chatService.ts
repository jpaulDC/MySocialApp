import * as signalR from "@microsoft/signalr";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "./api";

// ⚠️ Palitan ng actual IP ng computer mo
export const BASE_URL = "http://192.168.1.105:5261";

// ══════════════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  id: number;
  content: string;
  isRead: boolean;
  isDelivered: boolean;
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

// Payload ng MessageDelivered event
export interface DeliveredPayload {
  messageId: number;
  receiverId: number;
  deliveredAt: string;
}

// Payload ng MessagesSeen event
export interface SeenPayload {
  seenBy: number;
  messageIds: number[];
  seenAt: string;
}

// ══════════════════════════════════════════════════════════════════════
//  REST API
// ══════════════════════════════════════════════════════════════════════

// Kunin ang chat history ng dalawang user
export const getConversation = async (
  otherUserId: number,
  page = 1,
): Promise<ChatMessage[]> => {
  const res = await api.get(`/chat/conversation/${otherUserId}?page=${page}`);
  return res.data;
};

// Kunin ang inbox (lahat ng recent conversations)
export const getConversations = async (): Promise<Conversation[]> => {
  const res = await api.get("/chat/conversations");
  return res.data;
};

// Total unread count para sa badge notification
export const getUnreadCount = async (): Promise<number> => {
  const res = await api.get("/chat/unread");
  return res.data.unreadCount;
};

// Mark messages as read
export const markMessagesAsRead = async (
  otherUserId: number,
): Promise<void> => {
  await api.put(`/chat/read/${otherUserId}`);
};

// ══════════════════════════════════════════════════════════════════════
//  SIGNALR – SINGLETON CONNECTION
// ══════════════════════════════════════════════════════════════════════

// Isa lang ang connection sa buong app (singleton pattern)
let hubConnection: signalR.HubConnection | null = null;

// I-start ang SignalR connection
export const startChatConnection = async (): Promise<signalR.HubConnection> => {
  // ── FIX PARA SA ACCOUNT SWITCHING ──────────────────────────────────
  if (hubConnection) {
    try {
      // Pinapatay ang lumang connection (Manual stop)
      await hubConnection.stop();
    } catch (e) {
      console.log("Cleaning up old connection...");
    }
    hubConnection = null;
  }
  // ──────────────────────────────────────────────────────────────────

  const token = await AsyncStorage.getItem("token");

  hubConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${BASE_URL}/hubs/chat`, {
      accessTokenFactory: async () => {
        const freshToken = await AsyncStorage.getItem("token");
        return freshToken ?? "";
      },
      skipNegotiation: false,
      transport:
        signalR.HttpTransportType.WebSockets |
        signalR.HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  // ── BINAGO: Ginawang console.log para hindi mag-Red Screen Error ──
  hubConnection.onclose((error) => {
    // Imbes na console.error, console.log lang para tahimik ang app
    console.log(
      "🔌 SignalR Connection info:",
      error?.message || "Manual stop for account switching",
    );
  });

  hubConnection.onreconnecting((error) => {
    console.warn("🔄 SignalR Reconnecting:", error?.message);
  });

  hubConnection.onreconnected((connectionId) => {
    console.log("✅ SignalR Reconnected. ID:", connectionId);
  });

  try {
    await hubConnection.start();
    console.log("✅ SignalR connected!");
  } catch (err) {
    console.error("❌ SignalR Connection Error:", err);
    hubConnection = null;
    throw err;
  }

  return hubConnection;
};

// I-stop ang connection (sa logout)
export const stopChatConnection = async (): Promise<void> => {
  if (hubConnection) {
    try {
      await hubConnection.stop();
      hubConnection = null;
      console.log("🔌 SignalR stopped.");
    } catch (err) {
      console.error("❌ Error stopping SignalR:", err);
    }
  }
};

// Kunin ang current connection
export const getChatConnection = (): signalR.HubConnection | null =>
  hubConnection;
