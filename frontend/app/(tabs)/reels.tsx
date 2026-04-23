import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native"; // Idinagdag para ma-detect ang tab switch
import { ResizeMode, Video } from "expo-av";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Alert,
    Dimensions,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    TextInput as RNTextInput,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import {
    ActivityIndicator,
    Avatar,
    IconButton,
    Text,
} from "react-native-paper";
import {
    addReelComment,
    deleteReel,
    getReelComments,
    getReels,
    Reel,
    ReelComment,
    toggleReelLike,
} from "../../services/reelService";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const BASE_URL = "http://192.168.1.105:5261";

// Helper: relative time
function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}

export default function ReelsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused(); // Hook para malaman kung active ang tab na ito

  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [myUserId, setMyUserId] = useState<number | null>(null);

  // Comments modal state
  const [showComments, setShowComments] = useState(false);
  const [activeReelId, setActiveReelId] = useState<number | null>(null);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingCmts, setLoadingCmts] = useState(false);
  const [submittingCmt, setSubmittingCmt] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Get current user ID
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

  // Load reels
  const loadReels = useCallback(async (pageNum = 1, refresh = false) => {
    try {
      const data = await getReels(pageNum);
      setReels((prev) =>
        refresh || pageNum === 1 ? data : [...prev, ...data],
      );
      setHasMore(data.length === 10);
    } catch {
      Alert.alert("Error", "Failed to load reels.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReels(1);
  }, []);

  // ── TOGGLE LIKE ────────────────────────────────────────────────────
  const handleLike = async (reelId: number) => {
    setReels((prev) =>
      prev.map((r) => {
        if (r.id !== reelId) return r;
        // Optimistic update
        const nowLiked = !r.isLikedByMe;
        return {
          ...r,
          isLikedByMe: nowLiked,
          likeCount: nowLiked ? r.likeCount + 1 : r.likeCount - 1,
        };
      }),
    );

    try {
      const res = await toggleReelLike(reelId);
      // Sync with server
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelId
            ? { ...r, isLikedByMe: res.isLiked, likeCount: res.likeCount }
            : r,
        ),
      );
    } catch {
      // Revert optimistic update on error
      setReels((prev) =>
        prev.map((r) => {
          if (r.id !== reelId) return r;
          const revert = !r.isLikedByMe;
          return {
            ...r,
            isLikedByMe: revert,
            likeCount: revert ? r.likeCount + 1 : r.likeCount - 1,
          };
        }),
      );
    }
  };

  // ── OPEN COMMENTS ──────────────────────────────────────────────────
  const openComments = async (reelId: number) => {
    setActiveReelId(reelId);
    setShowComments(true);
    setLoadingCmts(true);
    try {
      const data = await getReelComments(reelId);
      setComments(data);
    } catch {
      Alert.alert("Error", "Failed to load comments.");
    } finally {
      setLoadingCmts(false);
    }
  };

  // ── SUBMIT COMMENT ─────────────────────────────────────────────────
  const handleSubmitComment = async () => {
    if (!commentText.trim() || !activeReelId) return;
    setSubmittingCmt(true);
    try {
      const c = await addReelComment(activeReelId, commentText.trim());
      setComments((prev) => [...prev, c]);
      setCommentText("");
      // Update comment count in reel list
      setReels((prev) =>
        prev.map((r) =>
          r.id === activeReelId
            ? { ...r, commentCount: r.commentCount + 1 }
            : r,
        ),
      );
    } catch {
      Alert.alert("Error", "Failed to post comment.");
    } finally {
      setSubmittingCmt(false);
    }
  };

  // ── DELETE REEL ────────────────────────────────────────────────────
  const handleDeleteReel = (reelId: number) => {
    Alert.alert("Delete Reel", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteReel(reelId);
            setReels((prev) => prev.filter((r) => r.id !== reelId));
          } catch {
            Alert.alert("Error", "Failed to delete reel.");
          }
        },
      },
    ]);
  };

  // ── VIEWABILITY CONFIG (detect which reel is visible) ─────────────
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60, // 60% visible = active
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  // ── RENDER EACH REEL ───────────────────────────────────────────────
  const renderReel = ({ item, index }: { item: Reel; index: number }) => {
    // In-update: Dapat Focused ang screen AT ito ang active index
    const isActive = index === activeIndex && isFocused;
    const isMyReel = item.userId === myUserId;
    const avatarUri = item.profilePicture
      ? `${BASE_URL}${item.profilePicture}`
      : null;
    const initials = (item.fullName ?? item.username)[0].toUpperCase();

    return (
      <View style={styles.reelContainer}>
        {/* ── VIDEO PLAYER ── */}
        <Video
          source={{ uri: `${BASE_URL}${item.videoUrl}` }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          shouldPlay={isActive} // Titigil na ito kapag lumipat ng tab (isFocused = false)
          isLooping // Loop the video
          isMuted={false}
        />

        {/* ── DARK GRADIENT OVERLAY ── */}
        <View style={styles.overlay} pointerEvents="box-none">
          {/* ── TOP ROW: Title + Delete ── */}
          <View style={styles.topRow}>
            <Text style={styles.reelsLabel}>Reels</Text>
            {isMyReel && (
              <IconButton
                icon="delete-outline"
                size={22}
                iconColor="white"
                onPress={() => handleDeleteReel(item.id)}
              />
            )}
          </View>

          {/* ── BOTTOM INFO: Author + Caption ── */}
          <View style={styles.bottomInfo}>
            <View style={styles.authorRow}>
              {avatarUri ? (
                <Avatar.Image size={38} source={{ uri: avatarUri }} />
              ) : (
                <Avatar.Text size={38} label={initials} />
              )}
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.authorName}>
                  {item.fullName ?? item.username}
                </Text>
                <Text style={styles.authorUsername}>
                  @{item.username} · {timeAgo(item.createdAt)}
                </Text>
              </View>
            </View>

            {/* Caption */}
            {item.caption ? (
              <Text style={styles.caption} numberOfLines={2}>
                {item.caption}
              </Text>
            ) : null}
          </View>

          {/* ── RIGHT SIDE ACTION BUTTONS ── */}
          <View style={styles.rightActions}>
            {/* Like */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleLike(item.id)}
            >
              <IconButton
                icon={item.isLikedByMe ? "heart" : "heart-outline"}
                size={32}
                iconColor={item.isLikedByMe ? "#ff4d6d" : "white"}
              />
              <Text style={styles.actionCount}>{item.likeCount}</Text>
            </TouchableOpacity>

            {/* Comment */}
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => openComments(item.id)}
            >
              <IconButton icon="comment-outline" size={32} iconColor="white" />
              <Text style={styles.actionCount}>{item.commentCount}</Text>
            </TouchableOpacity>

            {/* Share (placeholder) */}
            <TouchableOpacity style={styles.actionItem}>
              <IconButton icon="share-outline" size={32} iconColor="white" />
              <Text style={styles.actionCount}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  // ── LOADING SCREEN ─────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="white" />
        <Text style={{ color: "white", marginTop: 12 }}>Loading Reels...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── REELS FEED (vertical paged scroll) ── */}
      <FlatList
        ref={flatListRef}
        data={reels}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderReel}
        pagingEnabled // Snap to each reel
        showsVerticalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onEndReached={() => {
          if (!hasMore) return;
          const next = page + 1;
          setPage(next);
          loadReels(next);
        }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyScreen}>
            <Text style={styles.emptyIcon}>🎬</Text>
            <Text style={styles.emptyText}>No Reels yet!</Text>
            <Text style={styles.emptySubtext}>
              Be the first to upload a reel.
            </Text>
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => router.push("/(tabs)/upload-reel")}
            >
              <Text style={styles.uploadBtnText}>+ Upload Reel</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* ── FAB: Upload Reel ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(tabs)/upload-reel")}
      >
        <Text style={styles.fabIcon}>＋</Text>
      </TouchableOpacity>

      {/* ── COMMENTS BOTTOM SHEET MODAL ── */}
      <Modal
        visible={showComments}
        animationType="slide"
        transparent
        onRequestClose={() => setShowComments(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            onPress={() => setShowComments(false)}
          />

          <View style={styles.commentsSheet}>
            {/* Sheet header */}
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>💬 Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Comments list */}
            {loadingCmts ? (
              <View style={styles.centeredInSheet}>
                <ActivityIndicator />
              </View>
            ) : comments.length === 0 ? (
              <View style={styles.centeredInSheet}>
                <Text style={{ color: "#888" }}>
                  No comments yet. Be the first!
                </Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id.toString()}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12, gap: 12 }}
                renderItem={({ item: c }) => {
                  const av = c.profilePicture
                    ? `${BASE_URL}${c.profilePicture}`
                    : null;
                  const ini = (c.fullName ?? c.username)[0].toUpperCase();
                  return (
                    <View style={styles.cmtRow}>
                      {av ? (
                        <Avatar.Image size={34} source={{ uri: av }} />
                      ) : (
                        <Avatar.Text size={34} label={ini} />
                      )}
                      <View style={styles.cmtBubble}>
                        <View style={styles.cmtTop}>
                          <Text style={styles.cmtName}>
                            {c.fullName ?? c.username}
                          </Text>
                          <Text style={styles.cmtTime}>
                            {timeAgo(c.createdAt)}
                          </Text>
                        </View>
                        <Text style={styles.cmtText}>{c.content}</Text>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {/* Comment Input */}
            <View style={styles.cmtInputRow}>
              <RNTextInput
                style={styles.cmtInput}
                placeholder="Add a comment..."
                placeholderTextColor="#aaa"
                value={commentText}
                onChangeText={setCommentText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.cmtSendBtn,
                  !commentText.trim() && { opacity: 0.4 },
                ]}
                onPress={handleSubmitComment}
                disabled={!commentText.trim() || submittingCmt}
              >
                {submittingCmt ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.cmtSendIcon}>➤</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── REEL ─────────────────────────────────────────────────────────
  reelContainer: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: "black",
  },
  video: {
    width: SCREEN_W,
    height: SCREEN_H,
    position: "absolute",
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 52,
  },
  reelsLabel: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  bottomInfo: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  authorName: {
    color: "white",
    fontWeight: "bold",
    fontSize: 15,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  authorUsername: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
  },
  caption: {
    color: "white",
    fontSize: 14,
    lineHeight: 20,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },

  // ── RIGHT ACTION BUTTONS ──────────────────────────────────────────
  rightActions: {
    position: "absolute",
    right: 8,
    bottom: 110,
    alignItems: "center",
    gap: 8,
  },
  actionItem: {
    alignItems: "center",
  },
  actionCount: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: -10,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },

  // ── EMPTY & FAB ───────────────────────────────────────────────────
  emptyScreen: {
    width: SCREEN_W,
    height: SCREEN_H,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  emptyText: {
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  emptySubtext: {
    color: "rgba(255,255,255,0.6)",
    marginTop: 8,
    marginBottom: 24,
  },
  uploadBtn: {
    backgroundColor: "#6200ee",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  uploadBtnText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  fab: {
    position: "absolute",
    bottom: 32,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
  },
  fabIcon: {
    color: "white",
    fontSize: 28,
    lineHeight: 30,
  },

  // ── COMMENTS MODAL ────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  commentsSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_H * 0.65,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  sheetClose: {
    fontSize: 18,
    color: "#888",
    padding: 4,
  },
  centeredInSheet: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cmtRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cmtBubble: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 10,
  },
  cmtTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  cmtName: {
    fontWeight: "bold",
    fontSize: 13,
    color: "#1a1a2e",
  },
  cmtTime: {
    fontSize: 11,
    color: "#aaa",
  },
  cmtText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  cmtInputRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 10,
  },
  cmtInput: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 80,
    color: "#1a1a2e",
  },
  cmtSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
  },
  cmtSendIcon: {
    color: "white",
    fontSize: 18,
  },
});
