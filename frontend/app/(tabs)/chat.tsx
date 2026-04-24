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

// INAYOS NA IMPORTS: Tinugma sa ChatServices.ts
import {
  getConversation,
  markMessagesAsRead,
  ChatMessage as Message,
  startChatConnection
} from "../../services/chatService";

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

  // ── SAFETY CHECK SA PARAMS ──
  const receiverId = params.userId ? Number(params.userId) : null;
  const receiverName =
    (params.fullName as string) || (params.username as string) || "User";
  const receiverPic = params.picture as string;

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
    // Huwag mag-run kung walang receiverId
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

        // CLEANUP LISTENERS BAGO MAG-ATTACH (Para iwas double messages)
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

    // CLEANUP FUNCTION: Tatanggalin ang listeners kapag umalis sa screen
    return () => {
      if (activeConn) {
        activeConn.off("ReceivePrivateMessage");
        activeConn.off("UserTyping");
        activeConn.off("UserStoppedTyping");
        activeConn.off("OnlineStatus");
      }
    };
  }, [myUserId, receiverId]);

  // Auto-scroll to bottom kapag may bagong message
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
            <View
              style={[
                styles.bubble,
                isMe ? styles.bubbleSent : styles.bubbleReceived,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  isMe ? styles.bubbleTextSent : styles.bubbleTextReceived,
                ]}
              >
                {item.content}
              </Text>
            </View>
            <Text style={styles.msgTime}>
              {formatTime(item.sentAt)} {isMe && (item.isRead ? "✓✓" : "✓")}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!receiverId) {
    return (
      <View style={styles.centered}>
        <Text variant="titleMedium" style={{ color: "#888" }}>
          No conversation selected
        </Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Surface style={styles.header} elevation={3}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        <Avatar.Text
          size={40}
          label={receiverName ? receiverName[0].toUpperCase() : "?"}
        />
        <View style={styles.headerInfo}>
          <Text variant="titleMedium" style={styles.headerName}>
            {receiverName}
          </Text>
          <Text style={{ color: isOnline ? "#4CAF50" : "#aaa", fontSize: 12 }}>
            {isOnline ? "● Online" : "○ Offline"}
            {isTyping && " | Typing..."}
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

      <Surface style={styles.inputBar} elevation={4}>
        <PaperInput
          value={inputText}
          onChangeText={handleInputChange}
          mode="outlined"
          placeholder="Type a message..."
          style={styles.input}
          outlineStyle={{ borderRadius: 25 }}
          multiline={false}
          right={
            <PaperInput.Icon
              icon="send"
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
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: 6,
    paddingRight: 15,
    marginTop: Platform.OS === "android" ? 30 : 0,
  },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerName: { fontWeight: "bold" },
  messagesList: { padding: 15, paddingBottom: 20 },
  msgRow: { flexDirection: "row", marginBottom: 10 },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  msgContent: { maxWidth: "80%" },
  msgContentLeft: { alignItems: "flex-start" },
  msgContentRight: { alignItems: "flex-end" },
  bubble: { padding: 12, borderRadius: 18 },
  bubbleSent: { backgroundColor: "#6200ee" },
  bubbleReceived: { backgroundColor: "white" },
  bubbleText: { fontSize: 15 },
  bubbleTextSent: { color: "white" },
  bubbleTextReceived: { color: "black" },
  msgTime: { fontSize: 10, color: "#aaa", marginTop: 2 },
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  dateLine: { flex: 1, height: 1, backgroundColor: "#eee" },
  dateLabel: { marginHorizontal: 10, color: "#aaa", fontSize: 12 },
  inputBar: {
    padding: 10,
    backgroundColor: "white",
    paddingBottom: Platform.OS === "ios" ? 25 : 10,
  },
  input: { backgroundColor: "white" },
  quickActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    padding: 10,
  },
});
