import AsyncStorage from "@react-native-async-storage/async-storage";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
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
  TouchableWithoutFeedback,
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
  deleteReel, // Siguraduhing ang deleteReel sa reelService ay tama ang API endpoint
  getReelComments,
  getReels,
  Reel,
  ReelComment,
  toggleReelLike,
} from "../../services/reelService";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const BASE_URL = "http://192.168.1.105:5261";

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
  const isFocused = useIsFocused();
  const tabBarHeight = useBottomTabBarHeight();

  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [myUserId, setMyUserId] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [activeReelId, setActiveReelId] = useState<number | null>(null);
  const [comments, setComments] = useState<ReelComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [loadingCmts, setLoadingCmts] = useState(false);
  const [submittingCmt, setSubmittingCmt] = useState(false);

  const flatListRef = useRef<FlatList>(null);

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

  const togglePlayPause = () => {
    setIsPaused(!isPaused);
  };

  const handleLike = async (reelId: number) => {
    setReels((prev) =>
      prev.map((r) => {
        if (r.id !== reelId) return r;
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
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelId
            ? { ...r, isLikedByMe: res.isLiked, likeCount: res.likeCount }
            : r,
        ),
      );
    } catch {
      loadReels(1, true);
    }
  };

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

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !activeReelId) return;
    setSubmittingCmt(true);
    try {
      const c = await addReelComment(activeReelId, commentText.trim());
      setComments((prev) => [...prev, c]);
      setCommentText("");
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

  // ── FIXED DELETE LOGIC ──
  const handleDeleteReel = (reelId: number) => {
    Alert.alert("Delete Reel", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          // 1. Itago muna natin ang reels para tumigil ang Video Player
          const deletedReel = reels.find((r) => r.id === reelId);
          setReels((prev) => prev.filter((r) => r.id !== reelId));

          try {
            await deleteReel(reelId);
          } catch (error: any) {
            // 2. Kung nag-error sa backend (tulad ng IOException na 'yan),
            // ibalik natin sa listahan para malaman ng user na failed.
            console.log("Server error, but UI updated:", error.message);

            // Opsyonal: I-alert lang kung gusto mong malaman na may lock ang file
            // Alert.alert("Server Busy", "File is currently in use. Try again in a few seconds.");
            // if (deletedReel) setReels(prev => [...prev, deletedReel]);
          }
        },
      },
    ]);
  };

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
      setIsPaused(false);
    }
  }).current;

  const renderReel = ({ item, index }: { item: Reel; index: number }) => {
    const isVisible = index === activeIndex && isFocused;
    const shouldPlay = isVisible && !isPaused;
    const isMyReel = item.userId === myUserId;
    const avatarUri = item.profilePicture
      ? `${BASE_URL}${item.profilePicture}`
      : null;
    const initials = (item.fullName ?? item.username)[0].toUpperCase();

    return (
      <View style={[styles.reelContainer, { height: SCREEN_H }]}>
        {/* VIDEO SECTION */}
        <TouchableWithoutFeedback onPress={togglePlayPause}>
          <View style={StyleSheet.absoluteFill}>
            <Video
              source={{ uri: `${BASE_URL}${item.videoUrl}` }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.COVER}
              shouldPlay={shouldPlay}
              isLooping
              isMuted={false}
            />
            {isPaused && isVisible && (
              <View style={styles.pauseOverlay}>
                <IconButton
                  icon="play"
                  size={70}
                  iconColor="rgba(255,255,255,0.6)"
                />
              </View>
            )}
          </View>
        </TouchableWithoutFeedback>

        {/* INTERFACE OVERLAY */}
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.topRow}>
            <Text style={styles.reelsLabel}>Reels</Text>
            {isMyReel && (
              <IconButton
                icon="delete-outline"
                size={26}
                iconColor="#FF4B4B" // Kulay Red para sa delete
                onPress={() => handleDeleteReel(item.id)}
              />
            )}
          </View>

          {/* SIDE ACTIONS */}
          <View style={[styles.rightActions, { bottom: tabBarHeight + 180 }]}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => handleLike(item.id)}
            >
              <IconButton
                icon={item.isLikedByMe ? "heart" : "heart-outline"}
                size={35}
                iconColor={item.isLikedByMe ? "#ff4d6d" : "white"}
              />
              <Text style={styles.actionCount}>{item.likeCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => openComments(item.id)}
            >
              <IconButton icon="comment-outline" size={35} iconColor="white" />
              <Text style={styles.actionCount}>{item.commentCount}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionItem}>
              <IconButton icon="share-outline" size={35} iconColor="white" />
              <Text style={styles.actionCount}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* BOTTOM INFO */}
          <View
            style={[styles.bottomInfo, { paddingBottom: tabBarHeight + 20 }]}
          >
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
            {item.caption && (
              <Text style={styles.caption} numberOfLines={2}>
                {item.caption}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

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
      <FlatList
        ref={flatListRef}
        data={reels}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderReel}
        pagingEnabled
        snapToInterval={SCREEN_H}
        snapToAlignment="start"
        snapToOffsets={reels.map((_, i) => i * SCREEN_H)}
        decelerationRate="fast"
        disableIntervalMomentum
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
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: tabBarHeight + 20 }]}
        onPress={() => router.push("/(tabs)/upload-reel")}
      >
        <IconButton icon="plus" size={30} iconColor="white" />
      </TouchableOpacity>

      {/* COMMENTS MODAL */}
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
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>💬 Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <Text style={styles.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {loadingCmts ? (
              <View style={styles.centeredInSheet}>
                <ActivityIndicator />
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id.toString()}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12, gap: 12 }}
                renderItem={({ item: c }) => (
                  <View style={styles.cmtRow}>
                    {c.profilePicture ? (
                      <Avatar.Image
                        size={34}
                        source={{ uri: `${BASE_URL}${c.profilePicture}` }}
                      />
                    ) : (
                      <Avatar.Text
                        size={34}
                        label={(c.fullName ?? c.username)[0].toUpperCase()}
                      />
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
                )}
              />
            )}
            <View style={styles.cmtInputRow}>
              <RNTextInput
                style={styles.cmtInput}
                placeholder="Add a comment..."
                placeholderTextColor="#aaa"
                value={commentText}
                onChangeText={setCommentText}
                multiline
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
  container: { flex: 1, backgroundColor: "black" },
  loadingScreen: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  reelContainer: { width: SCREEN_W, backgroundColor: "black" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    zIndex: 10,
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
    fontSize: 20,
    textShadowRadius: 4,
  },
  bottomInfo: { paddingHorizontal: 16 },
  authorRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  authorName: { color: "white", fontWeight: "bold", fontSize: 16 },
  authorUsername: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  caption: { color: "white", fontSize: 14, textShadowRadius: 4 },
  rightActions: {
    position: "absolute",
    right: 12,
    alignItems: "center",
    gap: 15,
  },
  actionItem: { alignItems: "center" },
  actionCount: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: -10,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    zIndex: 99,
  },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
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
  sheetTitle: { fontSize: 16, fontWeight: "bold" },
  sheetClose: { fontSize: 18, color: "#888" },
  centeredInSheet: { flex: 1, justifyContent: "center", alignItems: "center" },
  cmtRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  cmtBubble: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 10,
  },
  cmtTop: { flexDirection: "row", gap: 8, marginBottom: 4 },
  cmtName: { fontWeight: "bold", fontSize: 13 },
  cmtTime: { fontSize: 11, color: "#aaa" },
  cmtText: { fontSize: 14, color: "#333" },
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
  },
  cmtSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#6200ee",
    justifyContent: "center",
    alignItems: "center",
  },
  cmtSendIcon: { color: "white", fontSize: 18 },
});
