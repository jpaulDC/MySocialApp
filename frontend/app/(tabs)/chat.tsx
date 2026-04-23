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
    View
} from "react-native";
import {
    ActivityIndicator,
    Avatar,
    IconButton,
    TextInput as PaperInput,
    Surface,
    Text,
} from "react-native-paper";
import {
    getConversation,
    Message,
    startSignalRConnection
} from "../../services/chatService";

const BASE_URL = "http://192.168.1.XXX:5000";

// Helper: format time
function formatMsgTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Other user info (passed from inbox or friend list)
  const otherUserId = Number(params.userId);
  const otherName = (params.fullName as string) || (params.username as string);
  const otherPic = params.picture as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false); // Other user typing?
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [connection, setConnection] = useState<signalR.HubConnection | null>(
    null,
  );

  const flatListRef = useRef<FlatList>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get current user ID from JWT
  useEffect(() => {
    const loadUser = async () => {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        const decoded: any = jwtDecode(token);
        const id =
          decoded[
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
          ];
        setMyUserId(Number(id));
      }
    };
    loadUser();
  }, []);

  // Load chat history + connect to SignalR
  useEffect(() => {
    const setup = async () => {
      try {
        // Load previous messages
        const history = await getConversation(otherUserId);
        setMessages(history);

        // Connect to SignalR hub
        const conn = await startSignalRConnection();
        setConnection(conn);

        // Listen for incoming messages
        conn.on("ReceiveMessage", (msg: Message) => {
          // Only add messages relevant to THIS conversation
          if (
            (msg.senderId === otherUserId && msg.receiverId === myUserId) ||
            (msg.senderId === myUserId && msg.receiverId === otherUserId)
          ) {
            setMessages((prev) => {
              // Avoid duplicate messages
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            scrollToBottom();
          }
        });

        // Listen for typing indicators
        conn.on("UserTyping", (userId: number) => {
          if (userId === otherUserId) setIsTyping(true);
        });
        conn.on("UserStoppedTyping", (userId: number) => {
          if (userId === otherUserId) setIsTyping(false);
        });

        // Listen for read receipts
        conn.on("MessagesRead", (userId: number) => {
          if (userId === otherUserId) {
            setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
          }
        });

        // Mark incoming messages as read
        await conn.invoke("MarkRead", otherUserId);
      } catch (err) {
        Alert.alert("Error", "Failed to connect to chat.");
      } finally {
        setLoading(false);
      }
    };

    if (myUserId) setup();
  }, [myUserId, otherUserId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length]);

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // ── SEND MESSAGE ───────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !connection || sending) return;

    setSending(true);
    setInputText("");

    try {
      // Send via SignalR (real-time)
      await connection.invoke("SendMessage", otherUserId, text);

      // Stop typing indicator
      await connection.invoke("StopTyping", otherUserId);
    } catch {
      Alert.alert("Error", "Failed to send message.");
      setInputText(text); // Restore on error
    } finally {
      setSending(false);
    }
  }, [inputText, connection, otherUserId, sending]);

  // ── TYPING INDICATOR ───────────────────────────────────────────────
  const handleInputChange = useCallback(
    (text: string) => {
      setInputText(text);

      if (!connection) return;

      // Send "typing" signal
      connection.invoke("Typing", otherUserId).catch(() => {});

      // Stop typing after 2 seconds of inactivity
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        connection.invoke("StopTyping", otherUserId).catch(() => {});
      }, 2000);
    },
    [connection, otherUserId],
  );

  // ── RENDER EACH MESSAGE BUBBLE ─────────────────────────────────────
  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.isMyMessage;
    const prevMsg = messages[index - 1];
    // Show avatar only for first message in a sequence from same sender
    const showAvatar =
      !isMe && (!prevMsg || prevMsg.senderId !== item.senderId);

    const avatarUri = !isMe && otherPic ? `${BASE_URL}${otherPic}` : null;
    const initials = otherName[0].toUpperCase();

    return (
      <View
        style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}
      >
        {/* Avatar (other person only) */}
        {!isMe && (
          <View style={styles.msgAvatarSlot}>
            {showAvatar ? (
              avatarUri ? (
                <Avatar.Image size={30} source={{ uri: avatarUri }} />
              ) : (
                <Avatar.Text
                  size={30}
                  label={initials}
                  style={styles.smallAvatar}
                />
              )
            ) : (
              // Spacer to keep alignment
              <View style={{ width: 30 }} />
            )}
          </View>
        )}

        <View style={styles.msgContent}>
          {/* Message bubble */}
          <View
            style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}
          >
            <Text
              style={[
                styles.bubbleText,
                isMe ? styles.bubbleTextMe : styles.bubbleTextOther,
              ]}
            >
              {item.content}
            </Text>
          </View>

          {/* Time + Read receipt */}
          <View
            style={[styles.msgMeta, isMe ? { alignItems: "flex-end" } : {}]}
          >
            <Text style={styles.msgTime}>{formatMsgTime(item.sentAt)}</Text>
            {/* Read checkmark for my messages */}
            {isMe && (
              <Text
                style={[
                  styles.readReceipt,
                  item.isRead && styles.readReceiptRead,
                ]}
              >
                {item.isRead ? " ✓✓" : " ✓"}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── LOADING ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10 }}>Loading chat...</Text>
      </View>
    );
  }

  const avatarUri = otherPic ? `${BASE_URL}${otherPic}` : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* ── CHAT HEADER ── */}
      <Surface style={styles.chatHeader} elevation={3}>
        <IconButton icon="arrow-left" onPress={() => router.back()} />
        {avatarUri ? (
          <Avatar.Image size={40} source={{ uri: avatarUri }} />
        ) : (
          <Avatar.Text size={40} label={otherName[0].toUpperCase()} />
        )}
        <View style={styles.headerInfo}>
          <Text variant="titleMedium" style={styles.headerName}>
            {otherName}
          </Text>
          {/* Typing indicator */}
          {isTyping ? (
            <Text style={styles.typingText}>typing...</Text>
          ) : (
            <Text style={styles.onlineText}>● Online</Text>
          )}
        </View>
      </Surface>

      {/* ── MESSAGES LIST ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatIcon}>👋</Text>
            <Text style={styles.emptyChatText}>Say hello to {otherName}!</Text>
          </View>
        }
        onContentSizeChange={scrollToBottom}
      />

      {/* ── TYPING BUBBLE (other person typing) ── */}
      {isTyping && (
        <View style={styles.typingBubbleRow}>
          <View style={styles.typingBubble}>
            <Text style={styles.typingDots}>● ● ●</Text>
          </View>
        </View>
      )}

      {/* ── MESSAGE INPUT BAR ── */}
      <Surface style={styles.inputBar} elevation={4}>
        <PaperInput
          value={inputText}
          onChangeText={handleInputChange}
          placeholder="Type a message..."
          mode="outlined"
          style={styles.input}
          multiline
          maxLength={1000}
          dense
          outlineStyle={{ borderRadius: 24 }}
          right={
            <PaperInput.Icon
              icon="send"
              disabled={!inputText.trim() || sending}
              color={inputText.trim() ? "#6200ee" : "#ccc"}
              onPress={handleSend}
            />
          }
          onSubmitEditing={handleSend}
        />
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── HEADER ───────────────────────────────────────────────────────
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingVertical: 6,
    paddingRight: 16,
    gap: 10,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  typingText: {
    color: "#6200ee",
    fontSize: 12,
    fontStyle: "italic",
  },
  onlineText: {
    color: "#4CAF50",
    fontSize: 12,
  },

  // ── MESSAGES ─────────────────────────────────────────────────────
  messagesList: {
    padding: 12,
    paddingBottom: 8,
    gap: 4,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 2,
  },
  msgRowMe: {
    justifyContent: "flex-end",
  },
  msgRowOther: {
    justifyContent: "flex-start",
  },
  msgAvatarSlot: {
    marginRight: 6,
    justifyContent: "flex-end",
  },
  smallAvatar: {
    backgroundColor: "#6200ee",
  },
  msgContent: {
    maxWidth: "75%",
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  bubbleMe: {
    backgroundColor: "#6200ee",
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: "white",
    borderBottomLeftRadius: 4,
    elevation: 1,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMe: {
    color: "white",
  },
  bubbleTextOther: {
    color: "#1a1a2e",
  },
  msgMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    paddingHorizontal: 4,
  },
  msgTime: {
    fontSize: 10,
    color: "#aaa",
  },
  readReceipt: {
    fontSize: 11,
    color: "#aaa",
  },
  readReceiptRead: {
    color: "#6200ee", // Purple when read
  },

  // ── TYPING BUBBLE ─────────────────────────────────────────────────
  typingBubbleRow: {
    paddingHorizontal: 52,
    paddingBottom: 4,
  },
  typingBubble: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: "flex-start",
    elevation: 1,
  },
  typingDots: {
    color: "#aaa",
    letterSpacing: 3,
    fontSize: 12,
  },

  // ── INPUT BAR ─────────────────────────────────────────────────────
  inputBar: {
    padding: 10,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  input: {
    backgroundColor: "white",
    fontSize: 15,
    maxHeight: 120,
  },

  // ── EMPTY ─────────────────────────────────────────────────────────
  emptyChat: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyChatIcon: {
    fontSize: 52,
  },
  emptyChatText: {
    color: "#888",
    fontSize: 16,
  },
});
