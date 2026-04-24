import * as signalR from "@microsoft/signalr";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// INAYOS NA IMPORTS
import {
  getConversation,
  markMessagesAsRead,
  ChatMessage as Message,
  startChatConnection,
} from "../../services/chatService";

// THEME COLORS (Match sa Home Screen mo)
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

  const receiverId = params.userId ? Number(params.userId) : null;
  const receiverName =
    (params.fullName as string) || (params.username as string) || "User";

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [conn, setConn] = useState<signalR.HubConnection | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

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

  useEffect(() => {
    if (!myUserId || !receiverId) {
      if (!receiverId) setLoading(false);
      return;
    }

    let activeConn: signalR.HubConnection | null = null;

    const setupChat = async () => {
      try {
        const history = await getConversation(receiverId);
        setMessages(history);
        await markMessagesAsRead(receiverId);

        const connection = await startChatConnection();
        activeConn = connection;
        setConn(connection);

        connection.off("ReceivePrivateMessage");
        connection.off("UserTyping");
        connection.off("UserStoppedTyping");
        connection.off("OnlineStatus");

        connection.on("ReceivePrivateMessage", (msg: Message) => {
          const isRelevant =
            (msg.senderId === receiverId && msg.receiverId === myUserId) ||
            (msg.senderId === myUserId && msg.receiverId === receiverId);

          if (!isRelevant) return;

          setMessages((prev) => {
            const exists = prev.some((m) => m.id === msg.id);
            if (exists) return prev;
            return [...prev, msg];
          });

          if (msg.senderId === receiverId) {
            markMessagesAsRead(receiverId).catch(() => {});
          }
        });

        connection.on("UserTyping", (userId: number) => {
          if (userId === receiverId) setIsTyping(true);
        });
        connection.on("UserStoppedTyping", (userId: number) => {
          if (userId === receiverId) setIsTyping(false);
        });
        connection.on("OnlineStatus", (userId: number, online: boolean) => {
          if (userId === receiverId) setIsOnline(online);
        });

        await connection.invoke("CheckOnlineStatus", receiverId);
      } catch (err) {
        console.error("Chat setup error:", err);
      } finally {
        setLoading(false);
      }
    };

    setupChat();

    return () => {
      if (activeConn) {
        activeConn.off("ReceivePrivateMessage");
        activeConn.off("UserTyping");
        activeConn.off("UserStoppedTyping");
        activeConn.off("OnlineStatus");
      }
    };
  }, [myUserId, receiverId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 200);
    }
  }, [messages]);

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

    typingTimer.current = setTimeout(async () => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        conn.invoke("StopTyping", receiverId).catch(() => {});
      }
    }, 2000);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.isMyMessage;
    const prevMsg = messages[index - 1];
    const showDateLabel =
      !prevMsg ||
      new Date(item.sentAt).toDateString() !==
        new Date(prevMsg.sentAt).toDateString();

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
                  icon={item.isRead ? "check-all" : "check"}
                  size={12}
                  iconColor={item.isRead ? THEME.accent : THEME.muted}
                  style={{ margin: 0, padding: 0, height: 12, width: 12 }}
                />
              )}
            </View>
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <Surface style={styles.header} elevation={4}>
        <IconButton
          icon="arrow-left"
          iconColor={THEME.text}
          onPress={() => router.back()}
        />
        <Avatar.Text
          size={40}
          label={receiverName ? receiverName[0].toUpperCase() : "?"}
          style={{ backgroundColor: THEME.primary }}
          labelStyle={{ color: THEME.accent }}
        />
        <View style={styles.headerInfo}>
          <Text variant="titleMedium" style={styles.headerName}>
            {receiverName}
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isOnline ? THEME.online : THEME.muted },
              ]}
            />
            <Text
              style={{
                color: isOnline ? THEME.online : THEME.muted,
                fontSize: 11,
                fontWeight: "bold",
              }}
            >
              {isOnline ? "ONLINE" : "OFFLINE"}
              {isTyping && " | TYPING..."}
            </Text>
          </View>
        </View>
        <IconButton
          icon="video-outline"
          iconColor={THEME.accent}
          onPress={() => {}}
        />
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
          multiline={false}
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
    paddingVertical: 10,
    paddingRight: 8,
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 245, 255, 0.1)",
  },
  headerInfo: { flex: 1, marginLeft: 12 },
  headerName: { fontWeight: "bold", color: THEME.text },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  messagesList: { padding: 16, paddingBottom: 20 },
  msgRow: { flexDirection: "row", marginBottom: 16 },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  msgContent: { maxWidth: "80%" },
  msgContentLeft: { alignItems: "flex-start" },
  msgContentRight: { alignItems: "flex-end" },
  bubble: { padding: 12, borderRadius: 18, borderTopLeftRadius: 18 },
  bubbleSent: {
    backgroundColor: THEME.primary,
    borderBottomRightRadius: 2,
    shadowColor: THEME.primary,
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  bubbleReceived: {
    backgroundColor: THEME.surface,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  bubbleText: { fontSize: 15, lineHeight: 20 },
  bubbleTextSent: { color: "#FFF" },
  bubbleTextReceived: { color: THEME.text },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  msgTime: { fontSize: 10, color: THEME.muted },
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: "rgba(255, 255, 255, 0.1)" },
  dateLabel: {
    marginHorizontal: 10,
    color: THEME.muted,
    fontSize: 11,
    fontWeight: "bold",
  },
  inputBar: {
    padding: 12,
    backgroundColor: THEME.surface,
    paddingBottom: Platform.OS === "ios" ? 30 : 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 245, 255, 0.1)",
  },
  input: {
    backgroundColor: THEME.bg,
    maxHeight: 50,
  },
});
