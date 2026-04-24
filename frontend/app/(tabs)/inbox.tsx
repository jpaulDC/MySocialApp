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
import { ActivityIndicator, Avatar, Badge, Text } from "react-native-paper";
import {
  BASE_URL,
  ChatMessage,
  Conversation,
  getChatConnection,
  getConversations,
  getUnreadCount,
  startChatConnection,
} from "../../services/chatService";

// ── SAKTONG KULAY BASE SA SCREENSHOT MO ───────────────────────────
const THEME = {
  bg: "#000000",
  boxColor: "#1A222E", // Eto yung Navy-Gray box sa screenshot mo
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#FFFFFF",
  muted: "#94A3B8",
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0)
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function InboxScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadInbox = useCallback(async () => {
    try {
      const [convs, unread] = await Promise.all([
        getConversations(),
        getUnreadCount(),
      ]);
      setConversations(convs);
      setTotalUnread(unread);
    } catch {
      Alert.alert("Sync Error", "Connection failed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadInbox();
    const setupSignalR = async () => {
      try {
        const conn = await startChatConnection();
        if (!conn) return;
        conn.on("ReceivePrivateMessage", (msg: ChatMessage) => {
          setConversations((prev) => {
            const otherId = msg.isMyMessage ? msg.receiverId : msg.senderId;
            const exists = prev.some((c) => c.otherUserId === otherId);
            if (!exists) {
              loadInbox();
              return prev;
            }
            const updated = prev.map((c) => {
              if (c.otherUserId !== otherId) return c;
              return {
                ...c,
                lastMessage: msg.content,
                lastMessageTime: msg.sentAt,
                isLastMessageMine: msg.isMyMessage,
                unreadCount: msg.isMyMessage
                  ? c.unreadCount
                  : c.unreadCount + 1,
              };
            });
            return [...updated].sort(
              (a, b) =>
                new Date(b.lastMessageTime).getTime() -
                new Date(a.lastMessageTime).getTime(),
            );
          });
          if (!msg.isMyMessage) setTotalUnread((prev) => prev + 1);
        });
      } catch (err) {
        console.log("SignalR error:", err);
      }
    };
    setupSignalR();
    return () => {
      const conn = getChatConnection();
      if (conn) conn.off("ReceivePrivateMessage");
    };
  }, [loadInbox]);

  const openChat = (conv: Conversation) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.otherUserId === conv.otherUserId ? { ...c, unreadCount: 0 } : c,
      ),
    );
    setTotalUnread((prev) => Math.max(0, prev - conv.unreadCount));
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

  const renderConversation = ({ item }: { item: Conversation }) => {
    const avatarUri = item.otherPicture
      ? `${BASE_URL}${item.otherPicture}`
      : null;
    const initials = (item.otherFullName ??
      item.otherUsername)[0].toUpperCase();
    const hasUnread = item.unreadCount > 0;

    return (
      <TouchableOpacity
        onPress={() => openChat(item)}
        activeOpacity={0.9}
        style={styles.touchableArea}
      >
        {/* ITO YUNG BOX MISMO */}
        <View style={styles.friendBox}>
          {/* Blue accent strip sa gilid (Kapag unread or for design) */}
          <View
            style={[
              styles.sideIndicator,
              { backgroundColor: hasUnread ? THEME.accent : THEME.primary },
            ]}
          />

          <View style={styles.avatarSpace}>
            {avatarUri ? (
              <Avatar.Image size={55} source={{ uri: avatarUri }} />
            ) : (
              <Avatar.Text
                size={55}
                label={initials}
                style={styles.fallbackAvatar}
                labelStyle={{ color: THEME.accent }}
              />
            )}
          </View>

          <View style={styles.textSpace}>
            <View style={styles.topRow}>
              <Text
                variant="titleMedium"
                style={styles.nameLabel}
                numberOfLines={1}
              >
                {item.otherFullName ?? item.otherUsername}
              </Text>
              <Text style={styles.timeLabel}>
                {formatTime(item.lastMessageTime)}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <Text
                variant="bodyMedium"
                style={styles.msgLabel}
                numberOfLines={1}
              >
                {item.isLastMessageMine ? "You: " : ""}
                {item.lastMessage}
              </Text>
              {hasUnread && (
                <Badge style={styles.notifBadge}>{item.unreadCount}</Badge>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading)
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={THEME.accent} />
      </View>
    );

  return (
    <View style={styles.mainContainer}>
      <View style={styles.headerArea}>
        <Text style={styles.headerText}>MESSAGES</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.otherUserId.toString()}
        renderItem={renderConversation}
        contentContainerStyle={styles.listPadding}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadInbox();
            }}
            tintColor={THEME.accent}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: THEME.bg },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME.bg,
  },
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: THEME.bg,
  },
  headerText: {
    fontSize: 32,
    fontWeight: "900",
    color: THEME.text,
    letterSpacing: 1,
  },

  listPadding: { paddingHorizontal: 16, paddingBottom: 20 },
  touchableArea: { marginBottom: 15 },

  // Eto yung saktong box na kamukha nung Gab card sa screenshot
  friendBox: {
    backgroundColor: "#1A222E", // SOLID COLOR para lumitaw ang box
    height: 90, // Explicit height para hindi mag-collapse
    borderRadius: 20, // Bilugan na corners
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    overflow: "hidden", // Para sa side indicator
    position: "relative",
  },

  sideIndicator: {
    position: "absolute",
    left: 0,
    top: 15,
    bottom: 15,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },

  avatarSpace: { marginRight: 15, marginLeft: 5 },
  fallbackAvatar: {
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: THEME.accent,
  },

  textSpace: { flex: 1, justifyContent: "center" },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  nameLabel: { color: THEME.text, fontWeight: "bold", fontSize: 18 },
  timeLabel: { color: THEME.muted, fontSize: 12 },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  msgLabel: { color: THEME.muted, flex: 1, marginRight: 10 },
  notifBadge: {
    backgroundColor: THEME.accent,
    color: "#000",
    fontWeight: "bold",
  },
});
