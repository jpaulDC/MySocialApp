import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Divider,
  IconButton,
  Surface,
  Text,
  TextInput,
} from "react-native-paper";

// DINAGDAG NA IMPORTS PARA SA TOKEN AT DECODE
import AsyncStorage from "@react-native-async-storage/async-storage";
import { jwtDecode } from "jwt-decode";

import {
  Comment,
  addComment,
  deleteComment,
  getComments,
  toggleLike,
} from "../../services/likeCommentService";
import { Post, deletePost, getPostById } from "../../services/postService";

const BASE_URL = "http://192.168.1.105:5261";

const THEME = {
  bg: "#000000",
  card: "#1A222E",
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#FFFFFF",
  muted: "#94A3B8",
  danger: "#E74C3C",
};

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

export default function PostDetailScreen() {
  const router = useRouter();
  const { postId, post: postParam } = useLocalSearchParams();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // EFFECT PARA MAKUHA ANG USER ID MULA SA TOKEN
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
          console.log("Token decode error", e);
        }
      }
    };
    getMyId();
  }, []);

  useEffect(() => {
    const fetchPostData = async () => {
      try {
        setLoading(true);
        let currentPost: Post | null = null;
        if (postParam) {
          try {
            currentPost =
              typeof postParam === "string" ? JSON.parse(postParam) : postParam;
          } catch (e) {
            console.log("Post param parse error, fetching via ID instead.");
          }
        }
        if (!currentPost && postId) {
          currentPost = await getPostById(Number(postId));
        }
        if (currentPost) {
          setPost(currentPost);
          setLiked(currentPost.isLikedByMe);
          setLikeCount(currentPost.likeCount);
          const commentData = await getComments(currentPost.id);
          setComments(commentData);
        }
      } catch (error) {
        console.error("Error loading post data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPostData();
  }, [postId, postParam]);

  const handleLike = async () => {
    if (!post) return;
    const wasLiked = liked;
    const prevCount = likeCount;
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? likeCount - 1 : likeCount + 1);
    try {
      const res = await toggleLike(post.id);
      setLiked(res.isLiked);
      setLikeCount(res.likeCount);
    } catch {
      setLiked(wasLiked);
      setLikeCount(prevCount);
      Alert.alert("Error", "Failed to update like.");
    }
  };

  const handleSubmitComment = async () => {
    if (!post) {
      Alert.alert("Error", "Post data not found.");
      return;
    }
    const text = newComment.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const comment = await addComment(post.id, text);
      setComments((prev) => [...prev, comment]);
      setNewComment("");
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (error) {
      Alert.alert("Error", "Failed to post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    Alert.alert("Delete Comment", "Remove this comment?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteComment(commentId);
            setComments((prev) => prev.filter((c) => c.id !== commentId));
          } catch {
            Alert.alert("Error", "Failed to delete comment.");
          }
        },
      },
    ]);
  };

  const handleDeletePost = () => {
    if (!post) return;
    Alert.alert("Delete Post", "Are you sure you want to delete this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePost(post.id);
            Alert.alert("Deleted!", "Your post has been removed.", [
              { text: "OK", onPress: () => router.replace("/(tabs)/home") },
            ]);
          } catch {
            Alert.alert("Error", "Failed to delete post.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={THEME.accent} />
        <Text style={{ marginTop: 12, color: THEME.muted }}>
          Loading details...
        </Text>
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: THEME.danger, fontWeight: "bold", fontSize: 18 }}>
          Data Lost
        </Text>
        <Button
          mode="contained"
          onPress={() => router.replace("/(tabs)/home")}
          style={{ marginTop: 20 }}
          buttonColor={THEME.primary}
        >
          Bumalik sa Home
        </Button>
      </View>
    );
  }

  const PostHeader = () => {
    const avatarUri = post.profilePicture
      ? `${BASE_URL}${post.profilePicture}`
      : null;
    const displayName = post.fullName ?? post.username ?? "User";
    const initials = displayName[0]?.toUpperCase() ?? "?";

    return (
      <View style={styles.postMainCard}>
        <View style={styles.postHeader}>
          {avatarUri ? (
            <Avatar.Image size={50} source={{ uri: avatarUri }} />
          ) : (
            <Avatar.Text
              size={50}
              label={initials}
              style={styles.avatarFallback}
            />
          )}
          <View style={styles.postHeaderInfo}>
            <Text style={styles.postName}>{displayName}</Text>
            <Text style={styles.postTime}>
              @{post.username} • {timeAgo(post.createdAt)}
            </Text>
          </View>

          {/* DITO IN-ADD ANG USER ID CHECK PARA SA DELETE BUTTON */}
          {post?.userId === myUserId && (
            <IconButton
              icon="delete-outline"
              size={22}
              iconColor={THEME.danger}
              onPress={handleDeletePost}
            />
          )}
        </View>

        {post.content ? (
          <Text style={styles.postContent}>{post.content}</Text>
        ) : null}

        {post.imageUrl ? (
          <Image
            source={{ uri: `${BASE_URL}${post.imageUrl}` }}
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : null}

        <View style={styles.countsRow}>
          <Text style={styles.countText}>❤️ {likeCount} Likes</Text>
          <Text style={styles.countText}>💬 {comments.length} Comments</Text>
        </View>

        <Divider style={styles.darkDivider} />

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <IconButton
              icon={liked ? "heart" : "heart-outline"}
              size={22}
              iconColor={liked ? THEME.danger : THEME.muted}
            />
            <Text
              style={[
                styles.actionLabel,
                liked && { color: THEME.danger, fontWeight: "bold" },
              ]}
            >
              {liked ? "Liked" : "Like"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <IconButton
              icon="comment-outline"
              size={22}
              iconColor={THEME.muted}
            />
            <Text style={styles.actionLabel}>Comment</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.commentsLabel}>💬 Comments</Text>
      </View>
    );
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const commentName = item.fullName ?? item.username ?? "User";
    return (
      <View style={styles.commentBoxWrapper}>
        <View style={styles.commentCard}>
          <View style={styles.sideAccent} />
          <View style={styles.commentContentArea}>
            <View style={styles.commentHeader}>
              <Text style={styles.commentName}>{commentName}</Text>
              <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
            </View>
            <Text style={styles.commentText}>{item.content}</Text>
          </View>
          {/* Kung gusto mo rin lagyan ng check ang comments: */}
          {item.userId === myUserId && (
            <IconButton
              icon="delete-outline"
              size={18}
              iconColor={THEME.danger}
              onPress={() => handleDeleteComment(item.id)}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Surface style={styles.header} elevation={4}>
        <IconButton
          icon="arrow-left"
          iconColor={THEME.text}
          onPress={() => {
            if (router.canGoBack()) {
              router.back(); // Babalik kung saan siya galing (Profile or Home)
            } else {
              router.replace("/(tabs)/profile"); // Fallback kung biglang nawala ang stack
            }
          }}
        />
        <Text style={styles.headerTitle}>POST_DETAIL</Text>
        <View style={{ width: 48 }} />
      </Surface>

      <FlatList
        ref={flatListRef}
        data={comments}
        keyExtractor={(item, index) => item?.id?.toString() ?? index.toString()}
        renderItem={renderComment}
        ListHeaderComponent={<PostHeader />}
        contentContainerStyle={styles.listContent}
      />

      <Surface style={styles.inputBar} elevation={4}>
        <TextInput
          placeholder="Write a comment..."
          placeholderTextColor={THEME.muted}
          value={newComment}
          onChangeText={setNewComment}
          mode="flat"
          style={styles.commentInput}
          textColor={THEME.text}
          multiline
          dense
          right={
            <TextInput.Icon
              icon="send"
              disabled={!newComment.trim() || submitting}
              color={newComment.trim() ? THEME.accent : THEME.muted}
              onPress={handleSubmitComment}
            />
          }
        />
      </Surface>
    </KeyboardAvoidingView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.bg,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1A222E",
  },
  headerTitle: {
    fontWeight: "bold",
    color: THEME.text,
    fontSize: 18,
    letterSpacing: 1,
  },
  postMainCard: { padding: 16 },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  postHeaderInfo: { flex: 1, marginLeft: 12 },
  avatarFallback: { backgroundColor: "#1A222E" },
  postName: { fontWeight: "bold", color: THEME.text, fontSize: 18 },
  postTime: { color: THEME.muted, fontSize: 13 },
  postContent: {
    color: "#D1D5DB",
    lineHeight: 22,
    fontSize: 16,
    marginBottom: 12,
  },
  postImage: { width: "100%", height: 300, borderRadius: 20, marginBottom: 15 },
  countsRow: { flexDirection: "row", gap: 16, paddingVertical: 8 },
  countText: { color: THEME.accent, fontWeight: "600" },
  darkDivider: { backgroundColor: "#1A222E", height: 1 },
  actionsRow: { flexDirection: "row", paddingVertical: 5 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  actionLabel: { color: THEME.muted, fontWeight: "600", marginLeft: -5 },
  commentsLabel: {
    fontWeight: "bold",
    color: THEME.accent,
    marginTop: 20,
    fontSize: 16,
  },
  listContent: { paddingBottom: 20 },
  commentBoxWrapper: { paddingHorizontal: 16, marginTop: 12 },
  commentCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    overflow: "hidden",
  },
  sideAccent: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    backgroundColor: THEME.primary,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  commentContentArea: { flex: 1, marginLeft: 10 },
  commentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  commentName: { fontWeight: "bold", color: THEME.text, fontSize: 14 },
  commentTime: { color: THEME.muted, fontSize: 11 },
  commentText: { color: "#94A3B8", fontSize: 14 },
  inputBar: {
    padding: 10,
    backgroundColor: THEME.bg,
    borderTopWidth: 1,
    borderTopColor: "#1A222E",
  },
  commentInput: { backgroundColor: "#1A222E", borderRadius: 15, minHeight: 50 },
});
