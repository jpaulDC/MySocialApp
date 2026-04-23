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
    Text,
} from "react-native-paper";
import {
    Conversation,
    getConversations,
    getUnreadCount,
    Message,
    startSignalRConnection,
} from "../../services/chatService";

const BASE_URL = "http://192.168.1.XXX:5000";

// Helper: format time
function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function InboxScreen() {
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load conversations + set up real-time listener
  const loadData = useCallback(async () => {
    try {
      const [convs, unread] = await Promise.all([
        getConversations(),
        getUnreadCount(),
      ]);
      setConversations(convs);
      setTotalUnread(unread);
    } catch {
      Alert.alert("Error", "Failed to load conversations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Connect to SignalR and listen for new messages
  useEffect(() => {
    loadData();

    const setupSignalR = async () => {
      try {
        const conn = await startSignalRConnection();

        // When a new message arrives, refresh the inbox
        conn.on("ReceiveMessage", (message: Message) => {
          // Update conversation list with new last message
          setConversations((prev) => {
            const otherUserId = message.isMyMessage
              ? message.receiverId
              : message.senderId;

            const existing = prev.find((c) => c.otherUserId === otherUserId);

            if (existing) {
              // Update existing conversation
              return prev
                .map((c) =>
                  c.otherUserId === otherUserId
                    ? {
                        ...c,
                        lastMessage: message.content,
                        lastMessageTime: message.sentAt,
                        isLastMessageMine: message.isMyMessage,
                        // Increment unread if message is from other person
                        unreadCount: message.isMyMessage
                          ? c.unreadCount
                          : c.unreadCount + 1,
                      }
                    : c,
                )
                .sort(
                  (a, b) =>
                    new Date(b.lastMessageTime).getTime() -
                    new Date(a.lastMessageTime).getTime(),
                );
            } else {
              // New conversation – reload full list
              loadData();
              return prev;
            }
          });

          // Update total unread badge
          if (!message.isMyMessage) {
            setTotalUnread((prev) => prev + 1);
          }
        });
      } catch (err) {
        console.log("SignalR connection error:", err);
      }
    };

    setupSignalR();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ── RENDER EACH CONVERSATION ───────────────────────────────────────
  const renderConversation = ({ item }: { item: Conversation }) => {
    const avatarUri = item.otherPicture
      ? `${BASE_URL}${item.otherPicture}`
      : null;
    const initials = (item.otherFullName ??
      item.otherUsername)[0].toUpperCase();
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: "/(tabs)/chat",
            params: {
              userId: item.otherUserId,
              username: item.otherUsername,
              fullName: item.otherFullName ?? item.otherUsername,
              picture: item.otherPicture ?? "",
            },
          })
        }
      >
        <View style={[styles.convItem, hasUnread && styles.convItemUnread]}>
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            {avatarUri ? (
              <Avatar.Image size={54} source={{ uri: avatarUri }} />
            ) : (
              <Avatar.Text size={54} label={initials} />
            )}
            {/* Online indicator dot (placeholder) */}
            <View style={styles.onlineDot} />
          </View>

          {/* Conversation info */}
          <View style={styles.convInfo}>
            <View style={styles.convTop}>
              <Text
                variant="titleSmall"
                style={[styles.convName, hasUnread && styles.boldText]}
              >
                {item.otherFullName ?? item.otherUsername}
              </Text>
              <Text style={styles.convTime}>
                {formatTime(item.lastMessageTime)}
              </Text>
            </View>
            <View style={styles.convBottom}>
              <Text
                variant="bodySmall"
                style={[styles.lastMsg, hasUnread && styles.boldText]}
                numberOfLines={1}
              >
                {item.isLastMessageMine ? "You: " : ""}
                {item.lastMessage}
              </Text>
              {/* Unread badge */}
              {hasUnread && (
                <Badge style={styles.badge}>{item.unreadCount}</Badge>
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
        <ActivityIndicator size="large" />
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
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text variant="titleMedium" style={styles.emptyText}>
              No messages yet
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Find friends and start chatting!
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: "white",
    gap: 12,
  },
  convItemUnread: {
    backgroundColor: "#f0f4ff", // Light blue for unread
  },
  avatarWrapper: {
    position: "relative",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "white",
  },
  convInfo: {
    flex: 1,
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
  },
  convTime: {
    fontSize: 11,
    color: "#888",
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
  badge: {
    backgroundColor: "#6200ee",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  emptyText: {
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  emptySubtext: {
    color: "#888",
    marginTop: 8,
    textAlign: "center",
  },
});
