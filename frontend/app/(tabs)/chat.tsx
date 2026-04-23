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
  getHubConnection,
  markAsRead,
  Message,
  startSignalRConnection,
} from "../../services/chatService";

// ⚠️ Palitan ng IP mo
const BASE_URL = "http://192.168.1.105:5261";

// Helper: format time (e.g. "2:30 PM")
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Helper: format date divider (e.g. "Today", "Yesterday", "Jan 5")
function formatDateLabel(dateStr: string): string {
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

  // ── Params mula sa navigation ──────────────────────────────────────
  const receiverId = Number(params.userId);
  const receiverName =
    (params.fullName as string) || (params.username as string) || "User";
  const receiverPic = params.picture as string;

  // ── State ──────────────────────────────────────────────────────────
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
  const isTypingRef = useRef(false); // Para hindi masyado maraming invoke

  // ── STEP 1: Kuhanin ang myUserId mula sa JWT ───────────────────────
  useEffect(() => {
    const loadUserId = async () => {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        const decoded: any = jwtDecode(token);
        const id =
          decoded[
            "http://schemas.xmlsoap.org/" +
              "ws/2005/05/identity/claims/nameidentifier"
          ];
        setMyUserId(Number(id));
      }
    };
    loadUserId();
  }, []);

  // ── STEP 2: Load chat history + setup SignalR ──────────────────────
  useEffect(() => {
    if (!myUserId) return; // Hintayin muna ang userId

    const setupChat = async () => {
      try {
        // Load existing messages mula sa REST API
        const history = await getConversation(receiverId);
        setMessages(history);

        // Mark existing messages as read
        await markAsRead(receiverId);

        // Kumonekta sa SignalR Hub
        const connection = await startSignalRConnection();
        setConn(connection);

        // ── Listen sa incoming PRIVATE messages ──────────────────────
        // Tanggapin lang ang messages na para sa conversation na ito
        connection.on("ReceivePrivateMessage", (msg: Message) => {
          // Filter: para lang sa conversation natin
          const isRelevant =
            (msg.senderId === receiverId && msg.receiverId === myUserId) ||
            (msg.senderId === myUserId && msg.receiverId === receiverId);

          if (!isRelevant) return;

          setMessages((prev) => {
            // Iwasan ang duplicate messages
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });

          // Scroll to bottom para makita ang bagong message
          scrollToBottom();

          // Mark as read agad kung ikaw ang receiver
          if (msg.senderId === receiverId) {
            markAsRead(receiverId).catch(() => {});
          }
        });

        // ── Listen sa typing indicator ────────────────────────────────
        connection.on("UserTyping", (userId: number) => {
          if (userId === receiverId) setIsTyping(true);
        });

        connection.on("UserStoppedTyping", (userId: number) => {
          if (userId === receiverId) setIsTyping(false);
        });

        // ── Listen sa online status ───────────────────────────────────
        connection.on("OnlineStatus", (userId: number, online: boolean) => {
          if (userId === receiverId) setIsOnline(online);
        });

        connection.on("UserOnline", (userId: string) => {
          if (Number(userId) === receiverId) setIsOnline(true);
        });

        connection.on("UserOffline", (userId: string) => {
          if (Number(userId) === receiverId) setIsOnline(false);
        });

        // Check kung online ang receiver
        await connection.invoke("CheckOnlineStatus", receiverId);
      } catch (err) {
        console.error("Chat setup error:", err);
        Alert.alert(
          "Connection Error",
          "Failed to connect to chat. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };

    setupChat();

    // Cleanup: tanggalin ang event listeners kapag umalis sa screen
    return () => {
      const connection = getHubConnection();
      if (connection) {
        connection.off("ReceivePrivateMessage");
        connection.off("UserTyping");
        connection.off("UserStoppedTyping");
        connection.off("OnlineStatus");
      }
      // Clear typing timer
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [myUserId, receiverId]);

  // ── Auto-scroll kapag may bagong message ──────────────────────────
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 150);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length]);

  // ══════════════════════════════════════════════════════════════════
  //  ACTIONS
  // ══════════════════════════════════════════════════════════════════

  // ── SEND PRIVATE MESSAGE ───────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !conn || sending) return;

    // I-clear ang input agad (better UX)
    setInputText("");
    setSending(true);

    try {
      // Invoke ang SignalR method – PRIVATE lang, hindi broadcast!
      // senderId ay hindi na kailangan ipadala – kukuhanin sa JWT sa server
      await conn.invoke("SendPrivateMessage", receiverId, text);

      // Stop typing indicator
      if (isTypingRef.current) {
        await conn.invoke("StopTyping", receiverId);
        isTypingRef.current = false;
      }
    } catch (err) {
      console.error("Send error:", err);
      // Ibalik ang text kapag may error
      setInputText(text);
      Alert.alert("Error", "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }, [inputText, conn, receiverId, sending]);

  // ── TYPING INDICATOR ───────────────────────────────────────────────
  const handleInputChange = useCallback(
    (text: string) => {
      setInputText(text);

      if (!conn) return;

      // Mag-send ng "Typing" signal (once lang, hindi paulit-ulit)
      if (!isTypingRef.current && text.length > 0) {
        isTypingRef.current = true;
        conn.invoke("Typing", receiverId).catch(() => {});
      }

      // Clear ang dating timer
      if (typingTimer.current) clearTimeout(typingTimer.current);

      // Stop typing after 2 seconds ng walang input
      typingTimer.current = setTimeout(async () => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          conn.invoke("StopTyping", receiverId).catch(() => {});
        }
      }, 2000);

      // Kung nag-clear ng input, stop typing agad
      if (text.length === 0 && isTypingRef.current) {
        isTypingRef.current = false;
        conn.invoke("StopTyping", receiverId).catch(() => {});
      }
    },
    [conn, receiverId],
  );

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════

  // ── RENDER EACH MESSAGE BUBBLE ─────────────────────────────────────
  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isMe = item.isMyMessage;

      // Check kung kailangan ng date divider
      const prevMsg = messages[index - 1];
      const currentDate = new Date(item.sentAt).toDateString();
      const prevDate = prevMsg ? new Date(prevMsg.sentAt).toDateString() : null;
      const showDateLabel = currentDate !== prevDate;

      // Check kung kailangan ng avatar
      // (ipakita lang sa unang message ng sequence mula sa receiver)
      const nextMsg = messages[index + 1];
      const showAvatar =
        !isMe &&
        (!nextMsg || nextMsg.isMyMessage || nextMsg.senderId !== item.senderId);

      const avatarUri =
        !isMe && receiverPic ? `${BASE_URL}${receiverPic}` : null;
      const initials = receiverName[0].toUpperCase();

      return (
        <>
          {/* ── DATE DIVIDER ── */}
          {showDateLabel && (
            <View style={styles.dateDivider}>
              <View style={styles.dateLine} />
              <Text style={styles.dateLabel}>
                {formatDateLabel(item.sentAt)}
              </Text>
              <View style={styles.dateLine} />
            </View>
          )}

          {/* ── MESSAGE ROW ── */}
          <View
            style={[
              styles.msgRow,
              isMe ? styles.msgRowRight : styles.msgRowLeft,
            ]}
          >
            {/* Avatar (receiver side only) */}
            {!isMe && (
              <View style={styles.avatarSlot}>
                {showAvatar ? (
                  avatarUri ? (
                    <Avatar.Image size={28} source={{ uri: avatarUri }} />
                  ) : (
                    <Avatar.Text
                      size={28}
                      label={initials}
                      style={styles.avatarText}
                    />
                  )
                ) : (
                  // Spacer para maayos ang alignment
                  <View style={{ width: 28 }} />
                )}
              </View>
            )}

            {/* Message bubble + meta */}
            <View
              style={[
                styles.msgContent,
                isMe ? styles.msgContentRight : styles.msgContentLeft,
              ]}
            >
              {/* ── BUBBLE ── */}
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

              {/* ── TIME + READ RECEIPT ── */}
              <View
                style={[
                  styles.msgMeta,
                  isMe
                    ? { alignItems: "flex-end" }
                    : { alignItems: "flex-start" },
                ]}
              >
                <Text style={styles.msgTime}>
                  {formatTime(item.sentAt)}
                  {/* Read receipt para sa sent messages */}
                  {isMe && (
                    <Text
                      style={[
                        styles.readReceipt,
                        item.isRead && styles.readReceiptSeen,
                      ]}
                    >
                      {item.isRead ? "  ✓✓" : "  ✓"}
                    </Text>
                  )}
                </Text>
              </View>
            </View>
          </View>
        </>
      );
    },
    [messages, receiverName, receiverPic, myUserId],
  );

  // ── LOADING SCREEN ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ee" />
        <Text style={styles.loadingText}>Connecting to chat...</Text>
      </View>
    );
  }

  const avatarUri = receiverPic ? `${BASE_URL}${receiverPic}` : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* ══════════════════════════════════════════════════════════════
           CHAT HEADER
         ══════════════════════════════════════════════════════════════ */}
      <Surface style={styles.header} elevation={3}>
        {/* Back button */}
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />

        {/* Avatar */}
        <View style={styles.headerAvatar}>
          {avatarUri ? (
            <Avatar.Image size={42} source={{ uri: avatarUri }} />
          ) : (
            <Avatar.Text
              size={42}
              label={receiverName[0].toUpperCase()}
              style={styles.headerAvatarText}
            />
          )}
          {/* Online dot */}
          {isOnline && <View style={styles.onlineDot} />}
        </View>

        {/* Name + status */}
        <View style={styles.headerInfo}>
          <Text
            variant="titleMedium"
            style={styles.headerName}
            numberOfLines={1}
          >
            {receiverName}
          </Text>
          {isTyping ? (
            <Text style={styles.typingText}>typing...</Text>
          ) : (
            <Text
              style={[
                styles.statusText,
                isOnline ? styles.onlineText : styles.offlineText,
              ]}
            >
              {isOnline ? "● Online" : "○ Offline"}
            </Text>
          )}
        </View>
      </Surface>

      {/* ══════════════════════════════════════════════════════════════
           MESSAGES LIST
         ══════════════════════════════════════════════════════════════ */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👋</Text>
            <Text style={styles.emptyTitle}>Start a conversation!</Text>
            <Text style={styles.emptySubtitle}>
              Say hello to {receiverName}
            </Text>
          </View>
        }
      />

      {/* ── TYPING INDICATOR BUBBLE ── */}
      {isTyping && (
        <View style={styles.typingBubbleRow}>
          <View style={styles.typingBubble}>
            <Text style={styles.typingDots}>● ● ●</Text>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════════════════
           MESSAGE INPUT BAR
         ══════════════════════════════════════════════════════════════ */}
      <Surface style={styles.inputBar} elevation={4}>
        <PaperInput
          value={inputText}
          onChangeText={handleInputChange}
          placeholder="Type a message..."
          placeholderTextColor="#aaa"
          mode="outlined"
          multiline
          maxLength={1000}
          style={styles.input}
          outlineStyle={styles.inputOutline}
          dense
          right={
            <PaperInput.Icon
              icon={sending ? "loading" : "send"}
              disabled={!inputText.trim() || sending}
              color={inputText.trim() && !sending ? "#6200ee" : "#ccc"}
              onPress={handleSend}
            />
          }
        />
      </Surface>
    </KeyboardAvoidingView>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#666",
    fontSize: 15,
  },

  // ── HEADER ───────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingRight: 16,
    paddingVertical: 6,
    gap: 8,
  },
  headerAvatar: {
    position: "relative",
  },
  headerAvatarText: {
    backgroundColor: "#6200ee",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "white",
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
  statusText: {
    fontSize: 12,
  },
  onlineText: {
    color: "#4CAF50",
  },
  offlineText: {
    color: "#aaa",
  },

  // ── MESSAGES ─────────────────────────────────────────────────────
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  msgRowLeft: {
    justifyContent: "flex-start",
  },
  msgRowRight: {
    justifyContent: "flex-end",
  },
  avatarSlot: {
    marginRight: 6,
    justifyContent: "flex-end",
  },
  avatarText: {
    backgroundColor: "#6200ee",
  },
  msgContent: {
    maxWidth: "72%",
  },
  msgContentLeft: {
    alignItems: "flex-start",
  },
  msgContentRight: {
    alignItems: "flex-end",
  },

  // ── BUBBLES ──────────────────────────────────────────────────────
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    maxWidth: "100%",
  },
  bubbleSent: {
    backgroundColor: "#6200ee",
    borderBottomRightRadius: 4,
  },
  bubbleReceived: {
    backgroundColor: "white",
    borderBottomLeftRadius: 4,
    elevation: 1,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextSent: {
    color: "white",
  },
  bubbleTextReceived: {
    color: "#1a1a2e",
  },

  // ── MESSAGE META ──────────────────────────────────────────────────
  msgMeta: {
    flexDirection: "row",
    marginTop: 3,
    paddingHorizontal: 4,
  },
  msgTime: {
    fontSize: 10,
    color: "#aaa",
  },
  readReceipt: {
    fontSize: 10,
    color: "#bbb",
  },
  readReceiptSeen: {
    color: "#6200ee", // Purple kapag na-read na
  },

  // ── DATE DIVIDER ──────────────────────────────────────────────────
  dateDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dateLabel: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "600",
  },

  // ── TYPING BUBBLE ─────────────────────────────────────────────────
  typingBubbleRow: {
    paddingHorizontal: 46,
    paddingBottom: 6,
  },
  typingBubble: {
    backgroundColor: "white",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: "flex-start",
    elevation: 1,
  },
  typingDots: {
    color: "#aaa",
    letterSpacing: 4,
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
  inputOutline: {
    borderRadius: 24,
    borderColor: "#ddd",
  },

  // ── EMPTY STATE ───────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  emptySubtitle: {
    color: "#888",
    fontSize: 14,
  },
});
