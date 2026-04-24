import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Badge,
  Divider,
  Surface,
  Text
} from "react-native-paper";
import {
  BASE_URL,
  ChatMessage,
  Conversation,
  getChatConnection,
  getConversations,
  getUnreadCount,
  startChatConnection,
} from "../../services/chatService";

// ── Format timestamp ───────────────────────────────────────────────────
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0)
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function InboxScreen() {
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Load inbox data ────────────────────────────────────────────────
  const loadInbox = useCallback(async () => {
    try {
      const [convs, unread] = await Promise.all([
        getConversations(),
        getUnreadCount(),
      ]);
      setConversations(convs);
      setTotalUnread(unread);
    } catch {
      Alert.alert("Error", "Failed to load messages.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // ── Setup: load data + SignalR listener ────────────────────────────
  useEffect(() => {
    loadInbox();

    const setupSignalR = async () => {
      try {
        const conn = await startChatConnection();

        // Kapag may bagong private message → i-update ang inbox
        conn.on("ReceivePrivateMessage", (msg: ChatMessage) => {
          setConversations((prev) => {
            const otherId = msg.isMyMessage ? msg.receiverId : msg.senderId;

            // I-update ang existing conversation
            const updated = prev.map((c) => {
              if (c.otherUserId !== otherId) return c;
              return {
                ...c,
                lastMessage: msg.content,
                lastMessageTime: msg.sentAt,
                isLastMessageMine: msg.isMyMessage,
                // Dagdagan ang unread kung hindi ako ang sender
                unreadCount: msg.isMyMessage
                  ? c.unreadCount
                  : c.unreadCount + 1,
              };
            });

            // Kung bagong conversation, i-reload
            const exists = prev.some((c) => c.otherUserId === otherId);
            if (!exists) {
              loadInbox();
              return prev;
            }

            // I-sort para pinakabago ay nasa taas
            return [...updated].sort(
              (a, b) =>
                new Date(b.lastMessageTime).getTime() -
                new Date(a.lastMessageTime).getTime(),
            );
          });

          // I-update ang total unread badge
          if (!msg.isMyMessage) {
            setTotalUnread((prev) => prev + 1);
          }
        });
      } catch (err) {
        console.log("SignalR inbox error:", err);
      }
    };

    setupSignalR();

    // Cleanup listeners kapag umalis sa screen
    return () => {
      const conn = getChatConnection();
      if (conn) conn.off("ReceivePrivateMessage");
    };
  }, []);

  // ── Open a conversation ────────────────────────────────────────────
  const openChat = (conv: Conversation) => {
    // I-reset ang unread count locally
    setConversations((prev) =>
      prev.map((c) =>
        c.otherUserId === conv.otherUserId ? { ...c, unreadCount: 0 } : c,
      ),
    );
    setTotalUnread((prev) => Math.max(0, prev - conv.unreadCount));

    // Navigate sa chat screen
    router.push({
      pathname: "/(tabs)/chat",
      params: {
        userId: conv.otherUserId.toString(),
        username: conv.otherUsername,
        fullName: conv.otherFullName ?? conv.otherUsername,
        picture: conv.otherPicture ?? "",
      },
    });
  };

  // ── Render each conversation row ───────────────────────────────────
  const renderConversation = ({ item }: { item: Conversation }) => {
    const avatarUri = item.otherPicture
      ? `${BASE_URL}${item.otherPicture}`
      : null;
    const initials = (item.otherFullName ??
      item.otherUsername)[0].toUpperCase();
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity onPress={() => openChat(item)} activeOpacity={0.7}>
        <View style={[styles.convRow, hasUnread && styles.convRowUnread]}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Avatar.Image size={54} source={{ uri: avatarUri }} />
            ) : (
              <Avatar.Text
                size={54}
                label={initials}
                style={styles.avatarFallback}
              />
            )}
          </View>

          {/* Conversation info */}
          <View style={styles.convInfo}>
            {/* Name + Time */}
            <View style={styles.convTop}>
              <Text
                variant="titleSmall"
                style={[styles.convName, hasUnread && styles.boldText]}
                numberOfLines={1}
              >
                {item.otherFullName ?? item.otherUsername}
              </Text>
              <Text style={styles.convTime}>
                {formatTime(item.lastMessageTime)}
              </Text>
            </View>

            {/* Last message + Unread badge */}
            <View style={styles.convBottom}>
              <Text
                variant="bodySmall"
                style={[styles.lastMsg, hasUnread && styles.boldText]}
                numberOfLines={1}
              >
                {item.isLastMessageMine ? "You: " : ""}
                {item.lastMessage}
              </Text>
              {hasUnread && (
                <Badge style={styles.unreadBadge}>{item.unreadCount}</Badge>
              )}
            </View>
          </View>
        </View>
        <Divider />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6200ee" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <Surface style={styles.header} elevation={2}>
        <Text variant="headlineSmall" style={styles.headerTitle}>
          💬 Messages
        </Text>
        {totalUnread > 0 && (
          <Badge style={styles.headerBadge}>{totalUnread}</Badge>
        )}
      </Surface>

      {/* ── CONVERSATIONS LIST ── */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.otherUserId.toString()}
        renderItem={renderConversation}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadInbox();
            }}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text variant="titleMedium" style={styles.emptyTitle}>
              No messages yet
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtitle}>
              Go to Friends and start a conversation!
            </Text>
          </View>
        }
        contentContainerStyle={
          conversations.length === 0 ? { flex: 1 } : undefined
        }
      />
    </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "white",
    gap: 8,
  },
  headerTitle: {
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  headerBadge: {
    backgroundColor: "#e74c3c",
  },

  // ── CONVERSATION ROW ──────────────────────────────────────────────
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    gap: 12,
  },
  convRowUnread: {
    backgroundColor: "#f5f0ff", // Light purple for unread
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarFallback: {
    backgroundColor: "#6200ee",
  },
  convInfo: {
    flex: 1,
    justifyContent: "center",
  },
  convTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  convName: {
    color: "#1a1a2e",
    flex: 1,
    marginRight: 8,
  },
  convTime: {
    fontSize: 11,
    color: "#aaa",
  },
  convBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastMsg: {
    color: "#888",
    flex: 1,
    marginRight: 8,
  },
  boldText: {
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  unreadBadge: {
    backgroundColor: "#6200ee",
  },

  // ── EMPTY STATE ───────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  emptyTitle: {
    fontWeight: "bold",
    color: "#1a1a2e",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#888",
    textAlign: "center",
  },
});
