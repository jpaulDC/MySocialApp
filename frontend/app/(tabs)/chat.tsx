import * as signalR from "@microsoft/signalr";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Avatar,
  IconButton,
  TextInput as PaperInput,
  Surface,
  Text,
} from "react-native-paper";

// SERVICES IMPORTS
import {
  BASE_URL,
  ChatMessage,
  DeliveredPayload,
  getChatConnection,
  getConversation,
  SeenPayload,
  startChatConnection,
} from "../../services/chatService";

// THEME COLORS (Pinanatili ang iyong Dark Theme)
const THEME = {
  bg: "#0A0A0A",
  surface: "#1E293B",
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#E2E8F0",
  muted: "#94A3B8",
  error: "#FF4B4B",
  online: "#00FF94",
};

// HELPERS
function formatTime(dateStr: string): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = new Date();
  const diff = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Params mula sa navigation
  const receiverId = params.userId ? Number(params.userId) : null;
  const receiverName =
    (params.fullName as string) || (params.username as string) || "User";
  const receiverPic = params.picture as string;

  // STATE
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [conn, setConn] = useState<signalR.HubConnection | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // 1. Get Current User ID
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (token) {
          const decoded: any = jwtDecode(token);
          const id =
            decoded[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            ];
          setMyUserId(Number(id));
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadUserId();
  }, []);

  // 2. Setup Chat & SignalR
  useEffect(() => {
    if (!myUserId || !receiverId) return;

    const setupChat = async () => {
      try {
        const history = await getConversation(receiverId);
        setMessages(history);

        const connection = await startChatConnection();
        setConn(connection);

        const currentReceiverId = Number(receiverId);
        const currentMyUserId = Number(myUserId);

        // -- RECEIVE MESSAGE --
        connection.on("ReceivePrivateMessage", async (msg: ChatMessage) => {
          const isRelevant =
            (msg.senderId === currentReceiverId &&
              msg.receiverId === currentMyUserId) ||
            (msg.senderId === currentMyUserId &&
              msg.receiverId === currentReceiverId);

          if (!isRelevant) return;

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          // API Call para sa Mark as Read kapag live ang message
          if (msg.senderId === currentReceiverId) {
            try {
              const token = await AsyncStorage.getItem("token");
              await axios.put(
                `${BASE_URL}/api/Chat/read/${currentReceiverId}`,
                {},
                {
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
            } catch (err) {
              console.log("Live MarkAsRead failed:", err);
            }
          }
        });

        // -- MESSAGE DELIVERED (✓✓ Grey) --
        connection.on("MessageDelivered", (payload: DeliveredPayload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.messageId ? { ...m, isDelivered: true } : m,
            ),
          );
        });

        // -- MESSAGES SEEN (✓✓ Blue/Accent) --
        connection.on("MessagesSeen", (payload: SeenPayload) => {
          if (Number(payload.seenBy) !== currentReceiverId) return;
          setLastSeenAt(payload.seenAt);
          setMessages((prev) =>
            prev.map((m) =>
              payload.messageIds.includes(m.id)
                ? { ...m, isRead: true, isDelivered: true }
                : m,
            ),
          );
        });

        // -- ADDED: ERROR LISTENER (Para malaman kung bakit failed ang send) --
        connection.on("Error", (errorMessage: string) => {
          Alert.alert("Chat Error", errorMessage);
        });

        // -- TYPING & STATUS --
        connection.on("UserTyping", (uid: number) => {
          if (uid === currentReceiverId) setIsTyping(true);
        });
        connection.on("UserStoppedTyping", (uid: number) => {
          if (uid === currentReceiverId) setIsTyping(false);
        });
        connection.on("OnlineStatus", (uid: number, online: boolean) => {
          if (uid === currentReceiverId) setIsOnline(online);
        });
        connection.on("UserOnline", (uid: string) => {
          if (Number(uid) === currentReceiverId) setIsOnline(true);
        });
        connection.on("UserOffline", (uid: string) => {
          if (Number(uid) === currentReceiverId) setIsOnline(false);
        });

        // -- INITIAL ACTIONS --
        try {
          if (connection.state === signalR.HubConnectionState.Connected) {
            // Online status ay sa Hub pa rin
            await connection.invoke("CheckOnlineStatus", currentReceiverId);

            // MarkAsRead ay via API PUT na (Base sa Swagger mo)
            const token = await AsyncStorage.getItem("token");
            await axios.put(
              `${BASE_URL}/api/Chat/read/${currentReceiverId}`,
              {},
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
          }
        } catch (e) {
          console.log("Initial status/read sync skipped:", e);
        }
      } catch (err) {
        console.error("Chat setup error:", err);
      } finally {
        setLoading(false);
      }
    };

    setupChat();

    return () => {
      const c = getChatConnection();
      if (c) {
        c.off("ReceivePrivateMessage");
        c.off("MessageDelivered");
        c.off("MessagesSeen");
        c.off("Error"); // Added cleanup for Error listener
        c.off("UserTyping");
        c.off("UserStoppedTyping");
        c.off("OnlineStatus");
      }
    };
  }, [myUserId, receiverId]);

  // 3. Handlers
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !conn || sending || !receiverId) return;

    setInputText("");
    setSending(true);
    try {
      await conn.invoke("SendPrivateMessage", receiverId, text);
      if (isTypingRef.current) {
        await conn.invoke("StopTyping", receiverId);
        isTypingRef.current = false;
      }
    } catch (err) {
      setInputText(text);
      Alert.alert("Error", "Failed to send message.");
    } finally {
      setSending(false);
    }
  }, [inputText, conn, receiverId, sending]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    if (!conn || !receiverId) return;
    if (!isTypingRef.current && text.length > 0) {
      isTypingRef.current = true;
      conn.invoke("Typing", receiverId).catch(() => {});
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        conn.invoke("StopTyping", receiverId).catch(() => {});
      }
    }, 2000);
  };

  // 4. Render Message
  const renderMessage = ({
    item,
    index,
  }: {
    item: ChatMessage;
    index: number;
  }) => {
    const isMe = item.senderId === myUserId;
    const prevMsg = messages[index - 1];
    const showDateLabel =
      !prevMsg ||
      new Date(item.sentAt).toDateString() !==
        new Date(prevMsg.sentAt).toDateString();

    // Check if last sent message para sa Seen label
    const nextMsg = messages[index + 1];
    const isLastMyMsg = isMe && (!nextMsg || !nextMsg.isMyMessage);

    return (
      <View key={item.id}>
        {showDateLabel && (
          <View style={styles.dateDivider}>
            <View style={styles.dateLine} />
            <Text style={styles.dateLabel}>{formatDateLabel(item.sentAt)}</Text>
            <View style={styles.dateLine} />
          </View>
        )}
        <View
          style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}
        >
          <View
            style={[
              styles.msgContent,
              isMe ? styles.msgContentRight : styles.msgContentLeft,
            ]}
          >
            <Surface
              style={[
                styles.bubble,
                isMe ? styles.bubbleSent : styles.bubbleReceived,
              ]}
              elevation={isMe ? 4 : 1}
            >
              <Text
                style={[
                  styles.bubbleText,
                  isMe ? styles.bubbleTextSent : styles.bubbleTextReceived,
                ]}
              >
                {item.content}
              </Text>
            </Surface>
            <View style={styles.timeRow}>
              <Text style={styles.msgTime}>{formatTime(item.sentAt)}</Text>
              {isMe && (
                <IconButton
                  icon={
                    item.isRead
                      ? "check-all"
                      : item.isDelivered
                        ? "check-all"
                        : "check"
                  }
                  size={14}
                  iconColor={item.isRead ? THEME.accent : THEME.muted}
                  style={{ margin: 0, padding: 0, height: 14, width: 14 }}
                />
              )}
            </View>
            {isLastMyMsg && item.isRead && lastSeenAt && (
              <Text style={styles.seenLabel}>
                Seen {formatTime(lastSeenAt)}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: THEME.bg }]}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  const avatarUri = receiverPic ? `${BASE_URL}${receiverPic}` : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Surface style={styles.header} elevation={4}>
        <IconButton
          icon="arrow-left"
          iconColor={THEME.text}
          onPress={() => router.back()}
        />
        <View style={styles.headerAvatarContainer}>
          {avatarUri ? (
            <Avatar.Image size={40} source={{ uri: avatarUri }} />
          ) : (
            <Avatar.Text
              size={40}
              label={receiverName[0].toUpperCase()}
              style={{ backgroundColor: THEME.primary }}
              labelStyle={{ color: THEME.accent }}
            />
          )}
          {isOnline && <View style={styles.headerOnlineDot} />}
        </View>
        <View style={styles.headerInfo}>
          <Text variant="titleMedium" style={styles.headerName}>
            {receiverName}
          </Text>
          <Text
            style={{
              color: isTyping
                ? THEME.accent
                : isOnline
                  ? THEME.online
                  : THEME.muted,
              fontSize: 11,
              fontWeight: "bold",
            }}
          >
            {isTyping ? "TYPING..." : isOnline ? "ONLINE" : "OFFLINE"}
          </Text>
        </View>
      </Surface>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />

      <Surface style={styles.inputBar} elevation={5}>
        <PaperInput
          value={inputText}
          onChangeText={handleInputChange}
          mode="outlined"
          placeholder="Type a message..."
          placeholderTextColor={THEME.muted}
          textColor={THEME.text}
          style={styles.input}
          outlineStyle={{
            borderRadius: 25,
            borderColor: "rgba(0, 245, 255, 0.2)",
          }}
          activeOutlineColor={THEME.accent}
          right={
            <PaperInput.Icon
              icon="send"
              color={inputText.trim() ? THEME.accent : THEME.muted}
              disabled={!inputText.trim() || sending}
              onPress={handleSend}
            />
          }
        />
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.surface,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  headerAvatarContainer: { position: "relative" },
  headerOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: THEME.online,
    borderWidth: 2,
    borderColor: THEME.surface,
  },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerName: { color: THEME.text, fontWeight: "bold" },
  messagesList: { padding: 16 },
  msgRow: { flexDirection: "row", marginBottom: 12 },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  msgContent: { maxWidth: "80%" },
  msgContentLeft: { alignItems: "flex-start" },
  msgContentRight: { alignItems: "flex-end" },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  bubbleSent: { backgroundColor: THEME.primary, borderBottomRightRadius: 4 },
  bubbleReceived: { backgroundColor: THEME.surface, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextSent: { color: "white" },
  bubbleTextReceived: { color: THEME.text },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  msgTime: { fontSize: 10, color: THEME.muted },
  seenLabel: {
    fontSize: 10,
    color: THEME.accent,
    fontStyle: "italic",
    marginTop: 2,
  },
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: "rgba(148, 163, 184, 0.2)" },
  dateLabel: {
    marginHorizontal: 10,
    color: THEME.muted,
    fontSize: 12,
    fontWeight: "bold",
  },
  inputBar: { padding: 10, backgroundColor: THEME.surface },
  input: { backgroundColor: THEME.bg, height: 45 },
});
