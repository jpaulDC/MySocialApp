import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
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

// Service Imports
import { toggleLike } from "../../services/likeCommentService";
import { deletePost, getUserPosts, Post } from "../../services/postService";
import { getMyProfile, UserProfile } from "../../services/userService";

const BASE_URL = "http://192.168.1.105:5261";

const COLORS = {
  background: "#0A0A0A",
  primary: "#2563EB",
  accent: "#00F5FF",
  secondary: "#1E293B",
  textMain: "#E2E8F0",
  textMuted: "#94A3B8",
  danger: "#FF4B4B",
};

// Helper para sa time ago ng mga posts
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

// ── SUB-COMPONENT: POST CARD ──────────────────────────────────────────
const ProfilePostItem = memo(
  ({ item, myUserId, handleDelete, router, profile }: any) => {
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
      router.push({
        pathname: "/(tabs)/post-detail",
        params: { postId: item.id.toString(), post: JSON.stringify(item) },
      });
    };

    const avatarUri = profile?.profilePictureUrl
      ? `${BASE_URL}${profile.profilePictureUrl}`
      : null;
    const initials = profile?.fullName?.[0]?.toUpperCase() ?? "?";

    return (
      <Surface style={styles.postCard} elevation={2}>
        <View style={styles.postCardHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
            {avatarUri ? (
              <Avatar.Image size={40} source={{ uri: avatarUri }} />
            ) : (
              <Avatar.Text
                size={40}
                label={initials}
                style={{ backgroundColor: COLORS.primary }}
              />
            )}
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.postCardName}>
                {profile?.fullName ?? profile?.username}
              </Text>
              <Text style={styles.postCardDate}>{timeAgo(item.createdAt)}</Text>
            </View>
          </View>
          {item.userId === myUserId && (
            <IconButton
              icon="delete-outline"
              iconColor={COLORS.danger}
              size={20}
              onPress={() => handleDelete(item.id)}
            />
          )}
        </View>

        <TouchableOpacity onPress={goToDetail} activeOpacity={0.9}>
          {item.content && (
            <Text style={styles.postCardContent}>{item.content}</Text>
          )}
          {item.imageUrl && (
            <Image
              source={{ uri: `${BASE_URL}${item.imageUrl}` }}
              style={styles.postCardImage}
              resizeMode="cover"
            />
          )}
        </TouchableOpacity>

        <View style={styles.postCardFooter}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <IconButton
              icon={liked ? "heart" : "heart-outline"}
              size={20}
              iconColor={liked ? COLORS.danger : COLORS.textMuted}
            />
            <Text
              style={[styles.postStatsText, liked && { color: COLORS.danger }]}
            >
              {likeCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={goToDetail}>
            <IconButton
              icon="comment-outline"
              size={20}
              iconColor={COLORS.textMuted}
            />
            <Text style={styles.postStatsText}>{item.commentCount}</Text>
          </TouchableOpacity>
        </View>
      </Surface>
    );
  },
);

// ── MAIN SCREEN ───────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [myUserId, setMyUserId] = useState<number | null>(null);

  useEffect(() => {
    const getMyId = async () => {
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
          console.log("Decode error", e);
        }
      }
    };
    getMyId();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await getMyProfile();
      setProfile(data);
      const postsData = await getUserPosts(data.id);
      setPosts(postsData);
    } catch (error) {
      if (Platform.OS !== "web")
        Alert.alert("Error", "Failed to load profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, []);

  const handleDeletePost = (postId: number) => {
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            if (profile) {
              setProfile({
                ...profile,
                postCount: (profile.postCount ?? 1) - 1,
              });
            }
          } catch {
            Alert.alert("Error", "Failed to delete post.");
          }
        },
      },
    ]);
  };

  const handleLogout = async () => {
    const performLogout = async () => {
      await AsyncStorage.removeItem("token");
      if (Platform.OS === "web") localStorage.removeItem("token");
      router.replace("/(auth)/login");
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to logout?"))
        await performLogout();
    } else {
      Alert.alert("Logout", "Are you sure?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: performLogout },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  const avatarUri = profile?.profilePictureUrl
    ? `${BASE_URL}${profile.profilePictureUrl}`
    : null;
  const initials = profile?.fullName
    ? profile.fullName
        .split(" ")
        .map((n: any) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
        />
      }
    >
      {/* HEADER SECTION */}
      <Surface style={styles.header} elevation={4}>
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Avatar.Image
              size={100}
              source={{ uri: avatarUri }}
              style={styles.avatarBorder}
            />
          ) : (
            <Avatar.Text
              size={100}
              label={initials}
              style={{ backgroundColor: COLORS.primary }}
            />
          )}
        </View>
        <Text variant="headlineSmall" style={styles.fullName}>
          {profile?.fullName ?? profile?.username}
        </Text>
        <Text variant="bodyMedium" style={styles.username}>
          @{profile?.username}
        </Text>
        {profile?.bio ? (
          <Text variant="bodyMedium" style={styles.bio}>
            {profile.bio}
          </Text>
        ) : (
          <Text variant="bodySmall" style={styles.noBio}>
            // system: no bio found
          </Text>
        )}
        <Chip
          icon="calendar"
          style={styles.chip}
          textStyle={{ color: COLORS.accent }}
        >
          Joined{" "}
          {profile?.createdAt
            ? new Date(profile.createdAt).toLocaleDateString()
            : "N/A"}
        </Chip>
      </Surface>

      {/* ACTIONS SECTION */}
      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="account-edit"
          // FIX: Iniba natin mula router.back() papuntang router.push
          onPress={() => router.push("/(tabs)/edit-profile")}
          style={[styles.actionBtnBase, { flex: 1, marginRight: 8 }]}
          buttonColor={COLORS.primary}
        >
          Edit Profile
        </Button>
        <Button
          mode="outlined"
          icon="logout"
          onPress={handleLogout}
          style={[
            styles.actionBtnBase,
            { flex: 1, borderColor: COLORS.danger },
          ]}
          textColor={COLORS.danger}
        >
          Logout
        </Button>
      </View>

      <Divider style={styles.divider} />

      {/* STATS SECTION */}
      <Surface style={styles.statsRow} elevation={2}>
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNumber}>
            {profile?.postCount ?? 0}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            POSTS
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNumber}>
            {profile?.friendCount ?? 0}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            FRIENDS
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNumber}>
            {profile?.likeCount ?? 0}
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            LIKES
          </Text>
        </View>
      </Surface>

      {/* POSTS LIST SECTION */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 40 }}>
        <Text style={styles.timelineLabel}>MY_TIMELINE</Text>
        {posts.length === 0 ? (
          <Surface style={styles.noPostsCard} elevation={1}>
            <Text style={{ fontSize: 40 }}>📁</Text>
            <Text style={styles.noPostsText}>NO_POSTS_YET</Text>
          </Surface>
        ) : (
          posts.map((post) => (
            <ProfilePostItem
              key={post.id}
              item={post}
              myUserId={myUserId}
              handleDelete={handleDeletePost}
              router={router}
              profile={profile}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    alignItems: "center",
    padding: 24,
    margin: 16,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: "rgba(0, 245, 255, 0.1)",
  },
  avatarContainer: { marginBottom: 12 },
  avatarBorder: { borderWidth: 2, borderColor: COLORS.accent },
  fullName: { fontWeight: "bold", color: COLORS.textMain },
  username: {
    color: COLORS.accent,
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  bio: {
    textAlign: "center",
    color: COLORS.textMuted,
    marginVertical: 8,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  noBio: { color: "#4A5568", fontStyle: "italic", marginVertical: 8 },
  chip: {
    marginTop: 8,
    backgroundColor: "rgba(0, 245, 255, 0.05)",
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  actions: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 8 },
  actionBtnBase: { borderRadius: 8, height: 48, justifyContent: "center" },
  divider: {
    marginVertical: 16,
    backgroundColor: "rgba(226, 232, 240, 0.1)",
    marginHorizontal: 20,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    backgroundColor: COLORS.secondary,
    marginBottom: 24,
  },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontWeight: "bold", color: COLORS.textMain },
  statLabel: { color: COLORS.accent, fontSize: 10, fontWeight: "bold" },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(226, 232, 240, 0.1)",
    height: "100%",
  },
  timelineLabel: {
    fontWeight: "bold",
    color: COLORS.accent,
    marginBottom: 15,
    letterSpacing: 2,
  },
  postCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: COLORS.secondary,
    marginBottom: 12,
    overflow: "hidden",
  },
  postCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  postCardName: { fontWeight: "bold", color: COLORS.textMain, fontSize: 14 },
  postCardDate: { color: COLORS.textMuted, fontSize: 11 },
  postCardContent: {
    color: "#E5E7EB",
    lineHeight: 22,
    fontSize: 15,
    marginBottom: 8,
  },
  postCardImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    marginBottom: 8,
  },
  postCardFooter: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "rgba(226,232,240,0.1)",
  },
  actionBtn: { flexDirection: "row", alignItems: "center", marginRight: 20 },
  postStatsText: { color: COLORS.textMuted, fontSize: 12, marginLeft: -5 },
  noPostsCard: {
    borderRadius: 20,
    padding: 40,
    backgroundColor: COLORS.secondary,
    alignItems: "center",
  },
  noPostsText: { color: COLORS.textMuted, marginTop: 10, fontWeight: "bold" },
});
