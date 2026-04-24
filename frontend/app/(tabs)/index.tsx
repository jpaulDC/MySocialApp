import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Divider,
  FAB,
  IconButton,
  Surface,
  Text,
} from "react-native-paper";

// Iyong mga Custom Services
import { toggleLike } from "../../services/likeCommentService";
import { deletePost, getFeed, Post } from "../../services/postService";

// PALITAN MO ITO NG IP NA GAMIT MO SA LOGIN
const BASE_URL = "http://192.168.1.105:5261";

// THEME COLORS (Techy / Futuristic)
const THEME = {
  bg: "#0A0A0A",
  surface: "#1E293B",
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#E2E8F0",
  muted: "#94A3B8",
  error: "#FF4B4B",
};

// Helper function para sa oras
function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── SEPARATE COMPONENT FOR POST ITEM ──────────────────────────────────
const PostItem = memo(function PostItemBase({
  item,
  myUserId,
  handleDelete,
  router,
}: any) {
  const avatarUri = item.profilePicture
    ? `${BASE_URL}${item.profilePicture}`
    : null;

  const displayName = item.fullName || item.username || "User";
  const initials = displayName[0]?.toUpperCase() ?? "?";
  const isMyPost = item.userId === myUserId;

  const [liked, setLiked] = useState(item.isLikedByMe);
  const [likeCount, setLikeCount] = useState(item.likeCount);

  useEffect(() => {
    setLiked(item.isLikedByMe);
    setLikeCount(item.likeCount);
  }, [item.isLikedByMe, item.likeCount]);

  const handleLike = async () => {
    const wasLiked = liked;
    const prevCount = likeCount;
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? likeCount - 1 : likeCount + 1);

    try {
      const res = await toggleLike(item.id);
      setLiked(res.isLiked);
      setLikeCount(res.likeCount);
    } catch {
      setLiked(wasLiked);
      setLikeCount(prevCount);
      Alert.alert("Error", "Could not update like.");
    }
  };

  const goToDetail = () => {
    const updatedPost = {
      ...item,
      isLikedByMe: liked,
      likeCount: likeCount,
    };
    router.push({
      pathname: "/(tabs)/post-detail",
      params: {
        postId: item.id.toString(),
        post: JSON.stringify(item),
      },
    });
  };

  return (
    <Surface style={styles.postCard} elevation={2}>
      <View style={styles.postHeader}>
        {avatarUri ? (
          <Avatar.Image
            size={42}
            source={{ uri: avatarUri }}
            style={styles.avatarGlow}
          />
        ) : (
          <Avatar.Text
            size={42}
            label={initials}
            style={{ backgroundColor: THEME.primary }}
            labelStyle={{ color: THEME.accent }}
          />
        )}
        <View style={styles.postHeaderInfo}>
          <Text variant="titleSmall" style={styles.postName}>
            {displayName}
          </Text>
          <Text variant="bodySmall" style={styles.postTime}>
            @{item.username} · {timeAgo(item.createdAt)}
          </Text>
        </View>
        {isMyPost && (
          <IconButton
            icon="delete-outline"
            size={20}
            iconColor={THEME.error}
            onPress={() => handleDelete(item.id)}
          />
        )}
      </View>

      <TouchableOpacity onPress={goToDetail} activeOpacity={0.9}>
        {item.content ? (
          <Text variant="bodyMedium" style={styles.postContent}>
            {item.content}
          </Text>
        ) : null}
        {item.imageUrl ? (
          <Image
            source={{ uri: `${BASE_URL}${item.imageUrl}` }}
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : null}
      </TouchableOpacity>

      <Divider style={styles.cardDivider} />

      <View style={styles.postActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <IconButton
            icon={liked ? "heart" : "heart-outline"}
            size={22}
            iconColor={liked ? THEME.error : THEME.muted}
          />
          <Text style={[styles.actionCount, liked && { color: THEME.error }]}>
            {likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={goToDetail}>
          <IconButton
            icon="comment-outline"
            size={22}
            iconColor={THEME.muted}
          />
          <Text style={styles.actionCount}>{item.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </Surface>
  );
});

// ── MAIN SCREEN ─────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myUserId, setMyUserId] = useState<number | null>(null);

  useEffect(() => {
    const init = async () => {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        try {
          const decoded: any = jwtDecode(token);
          const id =
            decoded[
              "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
            ];
          setMyUserId(Number(id));
        } catch (e) {
          console.log("Token decode error", e);
        }
      }
      loadFeed(1, true);
    };
    init();
  }, []);

  const loadFeed = useCallback(async (pageNum: number = 1, refresh = false) => {
    try {
      const data = await getFeed(pageNum);
      if (refresh || pageNum === 1) {
        setPosts(data);
        setPage(1);
      } else {
        setPosts((prev) => [...prev, ...data]);
      }
      setHasMore(data.length >= 10);
    } catch (err) {
      console.error("Feed error:", err);
      if (pageNum === 1)
        Alert.alert("Error", "Failed to load feed. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed(1, true);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || refreshing) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    loadFeed(nextPage);
  };

  const handleDelete = (postId: number) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
          } catch {
            Alert.alert("Error", "Failed to delete post.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: THEME.bg }]}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={{ marginTop: 12, color: THEME.accent }}>
          Syncing Feed...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Surface style={styles.appBar} elevation={4}>
        {/* Balancer View para sa centering */}
        <View style={{ width: 48 }} />

        <Text variant="headlineSmall" style={styles.appBarTitle}>
          SOCIAL<Text style={{ color: THEME.accent }}>APP</Text>
        </Text>

        <IconButton
          icon="dots-vertical"
          iconColor={THEME.text}
          size={24}
          onPress={() => {}}
          style={{ width: 48 }}
        />
      </Surface>

      <FlatList
        data={posts}
        keyExtractor={(item, index) => item.id?.toString() || index.toString()}
        renderItem={({ item }) => (
          <PostItem
            item={item}
            myUserId={myUserId}
            handleDelete={handleDelete}
            router={router}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={THEME.accent}
            colors={[THEME.accent]}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ padding: 16 }} color={THEME.accent} />
          ) : (
            <View style={{ height: 100 }} />
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📡</Text>
            <Text variant="titleMedium" style={styles.emptyText}>
              Empty Transmission
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              Start a new broadcast.
            </Text>
            <Button
              mode="contained"
              style={{ marginTop: 20, backgroundColor: THEME.primary }}
              icon="plus"
              onPress={() => router.push("/(tabs)/create-post")}
            >
              New Post
            </Button>
          </View>
        }
        contentContainerStyle={
          posts.length === 0 ? { flex: 1 } : { padding: 12 }
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push("/(tabs)/create-post")}
        color={THEME.bg}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  appBar: {
    paddingHorizontal: 8,
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingBottom: 12,
    backgroundColor: THEME.surface,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 245, 255, 0.1)",
  },
  appBarTitle: {
    flex: 1,
    textAlign: "center",
    fontWeight: "900",
    color: THEME.text,
    letterSpacing: 2,
    fontSize: 20,
  },
  postCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: THEME.surface,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  postHeaderInfo: { flex: 1, marginLeft: 12 },
  avatarGlow: {
    borderWidth: 1,
    borderColor: THEME.accent,
  },
  postName: { fontWeight: "bold", color: THEME.text },
  postTime: { color: THEME.muted, fontSize: 11 },
  postContent: {
    color: THEME.text,
    lineHeight: 22,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  postImage: {
    width: "100%",
    height: 260,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardDivider: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginVertical: 4,
  },
  postActions: { flexDirection: "row", alignItems: "center" },
  actionBtn: { flexDirection: "row", alignItems: "center", marginRight: 24 },
  actionCount: { color: THEME.muted, fontSize: 13, marginLeft: -6 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIcon: { fontSize: 64, marginBottom: 12, opacity: 0.5 },
  emptyText: { fontWeight: "bold", color: THEME.text, textAlign: "center" },
  emptySubtext: { color: THEME.muted, textAlign: "center", marginTop: 8 },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    borderRadius: 50,
    backgroundColor: THEME.accent,
    elevation: 8,
    shadowColor: THEME.accent,
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
});
