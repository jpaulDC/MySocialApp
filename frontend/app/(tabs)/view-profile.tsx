import { useLocalSearchParams, useRouter } from "expo-router";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
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
import { toggleLike } from "../../services/likeCommentService"; // Import natin ito
import { getUserPosts, Post } from "../../services/postService";
import { getProfileById, UserProfile } from "../../services/userService";

// ── THEME CONSTANTS ────────────────────────────────────────────────────
const THEME = {
  bg: "#000000",
  card: "#1A222E",
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#FFFFFF",
  muted: "#94A3B8",
  danger: "#E74C3C",
};

// ── SUB-COMPONENT: INTERACTIVE POST CARD ──────────────────────────────
const OtherUserPostItem = memo(({ item, profile, router }: any) => {
  const [liked, setLiked] = useState(item.isLikedByMe);
  const [likeCount, setLikeCount] = useState(item.likeCount);

  // Sync state kung mag-refresh ang data
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
    router.push({
      pathname: "/(tabs)/post-detail",
      params: {
        postId: item.id.toString(),
        post: JSON.stringify(item),
      },
    });
  };

  const avatarUri = profile?.profilePictureUrl
    ? `${BASE_URL}${profile.profilePictureUrl}`
    : null;
  const initials = profile?.fullName?.[0] ?? "?";

  return (
    <Surface style={styles.postCard} elevation={2}>
      <View style={styles.postBoxAccent} />

      {/* HEADER */}
      <View style={styles.postHeader}>
        {avatarUri ? (
          <Avatar.Image
            size={38}
            source={{ uri: avatarUri }}
            style={styles.postAvatar}
          />
        ) : (
          <Avatar.Text
            size={38}
            label={initials}
            style={{ backgroundColor: THEME.primary }}
          />
        )}
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.postName}>
            {profile?.fullName ?? profile?.username}
          </Text>
          <Text style={styles.postDate}>
            @{profile?.username} •{" "}
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {/* CONTENT */}
      <TouchableOpacity onPress={goToDetail} activeOpacity={0.9}>
        {item.content && (
          <Text style={styles.postContentText}>{item.content}</Text>
        )}
        {item.imageUrl && (
          <Image
            source={{ uri: `${BASE_URL}${item.imageUrl}` }}
            style={styles.postImage}
            resizeMode="cover"
          />
        )}
      </TouchableOpacity>

      {/* ACTIONS (LIKE & COMMENT) */}
      <View style={styles.postActionsRow}>
        <TouchableOpacity style={styles.actionBtnIcon} onPress={handleLike}>
          <IconButton
            icon={liked ? "heart" : "heart-outline"}
            size={20}
            iconColor={liked ? THEME.danger : THEME.muted}
          />
          <Text style={[styles.actionCount, liked && { color: THEME.danger }]}>
            {likeCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtnIcon} onPress={goToDetail}>
          <IconButton
            icon="comment-outline"
            size={20}
            iconColor={THEME.muted}
          />
          <Text style={styles.actionCount}>{item.commentCount}</Text>
        </TouchableOpacity>
      </View>
    </Surface>
  );
});

// ── MAIN SCREEN ────────────────────────────────────────────────────────
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
  }, [loadAll]);

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
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  const initials = profile?.fullName
    ? profile.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={THEME.accent}
          onRefresh={() => {
            setRefreshing(true);
            loadAll();
          }}
        />
      }
    >
      <View style={styles.backRow}>
        <IconButton
          icon="arrow-left"
          iconColor={THEME.text}
          size={24}
          onPress={() => router.back()}
        />
      </View>

      {/* PROFILE INFO BOX */}
      <Surface style={styles.profileCard} elevation={4}>
        <View style={styles.sideAccent} />
        <View style={styles.avatarContainer}>
          {profile?.profilePictureUrl ? (
            <Avatar.Image
              size={100}
              source={{ uri: `${BASE_URL}${profile.profilePictureUrl}` }}
              style={styles.avatarGlow}
            />
          ) : (
            <Avatar.Text
              size={100}
              label={initials}
              style={{ backgroundColor: THEME.primary }}
            />
          )}
        </View>

        <Text style={styles.fullName}>
          {profile?.fullName ?? profile?.username}
        </Text>
        <Text style={styles.username}>@{profile?.username}</Text>
        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : (
          <Text style={styles.noBio}>// No bio available</Text>
        )}

        <Chip
          icon="calendar"
          style={styles.chip}
          textStyle={{ color: THEME.accent, fontSize: 11 }}
        >
          JOINED {new Date(profile?.createdAt ?? "").getFullYear()}
        </Chip>

        <Divider style={styles.darkDivider} />

        <View style={styles.actionRow}>
          <Button
            mode="contained"
            icon="message-outline"
            onPress={handleMessage}
            style={[
              styles.actionBtn,
              {
                backgroundColor: THEME.card,
                borderWidth: 1,
                borderColor: THEME.primary,
              },
            ]}
            labelStyle={{ color: THEME.text, fontWeight: "bold" }}
          >
            MESSAGE
          </Button>
          <Button
            mode="contained"
            icon={
              friendStatus === "Accepted" ? "account-check" : "account-plus"
            }
            onPress={handleFriendAction}
            loading={friendLoading}
            disabled={friendLoading || friendStatus === "Pending"}
            style={styles.actionBtn}
            buttonColor={friendStatus === "Accepted" ? "#10B981" : THEME.accent}
            textColor="#000"
            labelStyle={{ fontWeight: "bold" }}
          >
            {friendStatus === "None"
              ? "ADD FRIEND"
              : friendStatus === "Pending"
                ? "REQUESTED"
                : "FRIENDS ✓"}
          </Button>
        </View>
      </Surface>

      {/* STATS SECTION */}
      <Surface style={styles.statsRow} elevation={2}>
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{posts.length}</Text>
          <Text style={styles.statLabel}>POSTS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>{profile?.friendCount ?? 0}</Text>
          <Text style={styles.statLabel}>FRIENDS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNum}>
            {posts.reduce((s, p) => s + p.likeCount, 0)}
          </Text>
          <Text style={styles.statLabel}>LIKES</Text>
        </View>
      </Surface>

      {/* TIMELINE */}
      <View style={styles.postsSection}>
        <Text style={styles.postsTitle}>USER_TIMELINE</Text>
        {posts.length === 0 ? (
          <Surface style={styles.emptyPosts} elevation={1}>
            <Text style={{ fontSize: 40 }}>📁</Text>
            <Text
              style={{ color: THEME.muted, marginTop: 10, fontWeight: "bold" }}
            >
              NO_POSTS_YET
            </Text>
          </Surface>
        ) : (
          posts.map((post) => (
            <OtherUserPostItem
              key={post.id}
              item={post}
              profile={profile}
              router={router}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: THEME.bg,
  },
  backRow: { paddingTop: Platform.OS === "ios" ? 50 : 10, paddingLeft: 10 },
  profileCard: {
    alignItems: "center",
    margin: 16,
    padding: 24,
    borderRadius: 25,
    backgroundColor: THEME.card,
    position: "relative",
    overflow: "hidden",
  },
  sideAccent: {
    position: "absolute",
    left: 0,
    top: 30,
    bottom: 30,
    width: 5,
    backgroundColor: THEME.accent,
    borderTopRightRadius: 5,
    borderBottomRightRadius: 5,
  },
  avatarContainer: { marginBottom: 15 },
  avatarGlow: { borderWidth: 2, borderColor: THEME.accent },
  fullName: {
    fontWeight: "900",
    color: THEME.text,
    fontSize: 22,
    letterSpacing: 1,
  },
  username: { color: THEME.accent, marginBottom: 12, fontWeight: "bold" },
  bio: {
    textAlign: "center",
    color: "#D1D5DB",
    lineHeight: 20,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  noBio: { color: THEME.muted, fontStyle: "italic", marginBottom: 15 },
  chip: {
    backgroundColor: "rgba(0, 245, 255, 0.1)",
    borderRadius: 8,
    height: 30,
  },
  darkDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#2D3748",
    marginVertical: 20,
  },
  actionRow: { flexDirection: "row", gap: 12, width: "100%" },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 20,
    backgroundColor: THEME.card,
    marginBottom: 20,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNum: { fontWeight: "900", color: THEME.text, fontSize: 18 },
  statLabel: {
    color: THEME.muted,
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 1,
    fontWeight: "bold",
  },
  statDivider: { width: 1, backgroundColor: "#2D3748" },
  postsSection: { paddingHorizontal: 16, paddingBottom: 40 },
  postsTitle: {
    fontWeight: "bold",
    color: THEME.accent,
    marginBottom: 15,
    letterSpacing: 2,
    fontSize: 14,
  },
  // POST ITEM STYLES
  postCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: THEME.card,
    marginBottom: 12,
    position: "relative",
    overflow: "hidden",
  },
  postBoxAccent: {
    position: "absolute",
    left: 0,
    top: 15,
    bottom: 15,
    width: 3,
    backgroundColor: THEME.primary,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    marginLeft: 8,
  },
  postAvatar: { borderWidth: 1, borderColor: THEME.accent },
  postName: { fontWeight: "bold", color: THEME.text, fontSize: 13 },
  postDate: { color: THEME.muted, fontSize: 11 },
  postContentText: {
    color: "#E5E7EB",
    lineHeight: 22,
    fontSize: 15,
    marginLeft: 8,
    marginBottom: 8,
  },
  postImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  postActionsRow: {
    flexDirection: "row",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#2D3748",
    marginLeft: 8,
  },
  actionBtnIcon: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 25,
  },
  actionCount: { color: THEME.muted, fontSize: 12, marginLeft: -5 },
  emptyPosts: {
    borderRadius: 20,
    padding: 40,
    backgroundColor: THEME.card,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#2D3748",
    borderStyle: "dashed",
  },
});
