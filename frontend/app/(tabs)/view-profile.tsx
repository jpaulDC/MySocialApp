import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from "react-native";
import {
    ActivityIndicator,
    Avatar,
    Button,
    Chip,
    Divider,
    IconButton,
    Surface,
    Text,
} from "react-native-paper";
import { BASE_URL } from "../../services/chatService";
import {
    getFriendshipStatus,
    sendFriendRequest,
    unfriend,
} from "../../services/friendService";
import { getUserPosts, Post } from "../../services/postService";
import { getProfileById, UserProfile } from "../../services/userService";

export default function ViewProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const targetUserId = Number(params.userId);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendStatus, setFriendStatus] = useState("None");
  const [friendshipId, setFriendshipId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendLoading, setFriendLoading] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [profileData, postsData, statusData] = await Promise.all([
        getProfileById(targetUserId),
        getUserPosts(targetUserId),
        getFriendshipStatus(targetUserId),
      ]);
      setProfile(profileData);
      setPosts(postsData);
      setFriendStatus(statusData.status);
      setFriendshipId(statusData.friendshipId);
    } catch {
      Alert.alert("Error", "Failed to load profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId]);

  useEffect(() => {
    loadAll();
  }, []);

  // ── Message button → diretso sa chat ──────────────────────────────
  const handleMessage = () => {
    if (!profile) return;
    router.push({
      pathname: "/(tabs)/chat",
      params: {
        userId: profile.id.toString(),
        username: profile.username,
        fullName: profile.fullName ?? profile.username,
        picture: profile.profilePictureUrl ?? "",
      },
    });
  };

  // ── Friend actions ─────────────────────────────────────────────────
  const handleFriendAction = async () => {
    setFriendLoading(true);
    try {
      if (friendStatus === "None") {
        await sendFriendRequest(targetUserId);
        setFriendStatus("Pending");
        Alert.alert("✅", "Friend request sent!");
      } else if (friendStatus === "Accepted" && friendshipId) {
        Alert.alert(
          "Unfriend",
          `Remove ${profile?.fullName ?? profile?.username}?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Unfriend",
              style: "destructive",
              onPress: async () => {
                await unfriend(friendshipId);
                setFriendStatus("None");
                setFriendshipId(null);
              },
            },
          ],
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message ?? "Action failed.");
    } finally {
      setFriendLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const avatarUri = profile?.profilePictureUrl
    ? `${BASE_URL}${profile.profilePictureUrl}`
    : null;
  const initials = profile?.fullName
    ? profile.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : (profile?.username?.[0]?.toUpperCase() ?? "?");

  const friendLabel =
    friendStatus === "None"
      ? "Add Friend"
      : friendStatus === "Pending"
        ? "Request Sent"
        : friendStatus === "Accepted"
          ? "Friends ✓"
          : "Add Friend";

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadAll();
          }}
        />
      }
    >
      {/* ── Back ── */}
      <View style={styles.backRow}>
        <IconButton icon="arrow-left" size={24} onPress={() => router.back()} />
      </View>

      {/* ── Profile Card ── */}
      <Surface style={styles.profileCard} elevation={2}>
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Avatar.Image size={96} source={{ uri: avatarUri }} />
          ) : (
            <Avatar.Text size={96} label={initials} />
          )}
        </View>

        <Text variant="headlineSmall" style={styles.fullName}>
          {profile?.fullName ?? profile?.username}
        </Text>
        <Text variant="bodyMedium" style={styles.username}>
          @{profile?.username}
        </Text>

        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={styles.noBio}>No bio yet.</Text>
        )}

        <Chip icon="calendar" style={styles.chip}>
          Joined {new Date(profile?.createdAt ?? "").toLocaleDateString()}
        </Chip>

        <Divider style={{ width: "100%", marginVertical: 16 }} />

        {/* ── ACTION BUTTONS ── */}
        <View style={styles.actionRow}>
          {/* 💬 MESSAGE BUTTON */}
          <Button
            mode="contained"
            icon="message"
            onPress={handleMessage}
            style={[styles.actionBtn, { backgroundColor: "#6200ee" }]}
            contentStyle={styles.actionBtnContent}
          >
            Message
          </Button>

          {/* 👤 FRIEND BUTTON */}
          <Button
            mode={friendStatus === "Accepted" ? "outlined" : "contained"}
            icon={
              friendStatus === "None"
                ? "account-plus"
                : friendStatus === "Pending"
                  ? "account-clock"
                  : "account-check"
            }
            onPress={handleFriendAction}
            loading={friendLoading}
            disabled={friendLoading || friendStatus === "Pending"}
            style={styles.actionBtn}
            contentStyle={styles.actionBtnContent}
            textColor={friendStatus === "Accepted" ? "#4CAF50" : undefined}
          >
            {friendLabel}
          </Button>
        </View>
      </Surface>

      {/* ── Stats Row ── */}
      <Surface style={styles.statsRow} elevation={1}>
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNum}>
            {posts.length}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Posts
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNum}>
            {friendStatus === "Accepted" ? "✓" : "—"}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Friend
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNum}>
            {posts.reduce((s, p) => s + p.likeCount, 0)}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Likes
          </Text>
        </View>
      </Surface>

      {/* ── Posts ── */}
      <View style={styles.postsSection}>
        <Text variant="titleMedium" style={styles.postsTitle}>
          📝 Posts
        </Text>
        {posts.length === 0 ? (
          <Surface style={styles.emptyPosts} elevation={1}>
            <Text style={{ fontSize: 32 }}>📭</Text>
            <Text style={{ color: "#888", marginTop: 8 }}>No posts yet.</Text>
          </Surface>
        ) : (
          posts.map((post) => (
            <Surface key={post.id} style={styles.postCard} elevation={1}>
              {post.content ? (
                <Text style={styles.postContent}>{post.content}</Text>
              ) : null}
              <View style={styles.postMeta}>
                <Text style={styles.postMetaText}>
                  ❤️ {post.likeCount} 💬 {post.commentCount}
                </Text>
                <Text style={styles.postMetaText}>
                  {new Date(post.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </Surface>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0f2f5" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  backRow: { paddingTop: 8, paddingLeft: 4 },
  profileCard: {
    alignItems: "center",
    margin: 12,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    backgroundColor: "white",
  },
  avatarContainer: { marginBottom: 12 },
  fullName: { fontWeight: "bold", color: "#1a1a2e", textAlign: "center" },
  username: { color: "#888", marginBottom: 8 },
  bio: {
    textAlign: "center",
    color: "#444",
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  noBio: { color: "#bbb", fontStyle: "italic", marginVertical: 8 },
  chip: { marginTop: 8, backgroundColor: "#e8f4ff" },
  actionRow: { flexDirection: "row", gap: 10, width: "100%" },
  actionBtn: { flex: 1, borderRadius: 10 },
  actionBtnContent: { paddingVertical: 4 },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 12,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "white",
    marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontWeight: "bold", color: "#1a1a2e" },
  statLabel: { color: "#888", marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#eee" },
  postsSection: { paddingHorizontal: 12, paddingBottom: 24, gap: 8 },
  postsTitle: { fontWeight: "bold", color: "#1a1a2e", marginBottom: 4 },
  postCard: { borderRadius: 12, padding: 14, backgroundColor: "white", gap: 8 },
  postContent: { color: "#333", lineHeight: 22 },
  postMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    paddingTop: 8,
  },
  postMetaText: { color: "#888", fontSize: 12 },
  emptyPosts: {
    borderRadius: 12,
    padding: 32,
    backgroundColor: "white",
    alignItems: "center",
  },
});
