import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
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
  IconButton,
  Searchbar,
  SegmentedButtons,
  Surface,
  Text,
} from "react-native-paper";
import { BASE_URL } from "../../services/chatService";
import {
  acceptFriendRequest,
  Friend,
  getFriends,
  getPendingRequests,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  unfriend,
} from "../../services/friendService";
import { UserProfile } from "../../services/userService";

export default function FriendsScreen() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);

  // ── Action Modal State ─────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  // ── Load Data ──────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([getFriends(), getPendingRequests()]);
      setFriends(f);
      setRequests(r);
    } catch {
      Alert.alert("Error", "Failed to load friends.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  // ── Search debounce ────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "search") return;
    const timer = setTimeout(async () => {
      if (searchQuery.length < 2) {
        setSearchResult([]);
        return;
      }
      setSearching(true);
      try {
        const res = await searchUsers(searchQuery);
        setSearchResult(res);
      } catch {
        Alert.alert("Error", "Search failed.");
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, tab]);

  // ══════════════════════════════════════════════════════════════════
  //  MODAL ACTIONS
  // ══════════════════════════════════════════════════════════════════

  // Kapag na-tap ang isang friend – ipakita ang options modal
  const handleFriendTap = (friend: Friend) => {
    setSelectedFriend(friend);
    setModalVisible(true);
  };

  // Option 1: View Profile
  const handleViewProfile = () => {
    if (!selectedFriend) return;
    setModalVisible(false);
    router.push({
      pathname: "/(tabs)/view-profile",
      params: { userId: selectedFriend.userId.toString() },
    });
  };

  // Option 2: Message – diretso sa chat
  const handleMessageFriend = () => {
    if (!selectedFriend) return;
    setModalVisible(false);

    // I-navigate sa chat screen na may receiver info
    router.push({
      pathname: "/(tabs)/chat",
      params: {
        userId: selectedFriend.userId.toString(),
        username: selectedFriend.username,
        fullName: selectedFriend.fullName ?? selectedFriend.username,
        picture: selectedFriend.profilePictureUrl ?? "",
      },
    });
  };

  // ── Accept / Reject / Unfriend ─────────────────────────────────────
  const handleAccept = async (friendshipId: number) => {
    try {
      await acceptFriendRequest(friendshipId);
      Alert.alert("✅", "Friend request accepted!");
      loadData();
    } catch {
      Alert.alert("Error", "Failed to accept.");
    }
  };

  const handleReject = async (friendshipId: number) => {
    try {
      await rejectFriendRequest(friendshipId);
      loadData();
    } catch {
      Alert.alert("Error", "Failed to reject.");
    }
  };

  const handleUnfriend = (id: number, name: string) => {
    Alert.alert("Unfriend", `Remove ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unfriend",
        style: "destructive",
        onPress: async () => {
          try {
            await unfriend(id);
            loadData();
          } catch {
            Alert.alert("Error", "Failed to unfriend.");
          }
        },
      },
    ]);
  };

  const handleSendRequest = async (userId: number, username: string) => {
    try {
      const msg = await sendFriendRequest(userId);
      Alert.alert("✅", msg);
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.message ?? "Failed.");
    }
  };

  // ── Avatar helper ──────────────────────────────────────────────────
  const renderAvatar = (item: {
    profilePictureUrl?: string;
    username: string;
    fullName?: string;
  }) => {
    const uri = item.profilePictureUrl
      ? `${BASE_URL}${item.profilePictureUrl}`
      : null;
    const initials = (item.fullName ?? item.username)[0].toUpperCase();
    return uri ? (
      <Avatar.Image size={50} source={{ uri }} />
    ) : (
      <Avatar.Text size={50} label={initials} />
    );
  };

  // ══════════════════════════════════════════════════════════════════
  //  RENDER ITEMS
  // ══════════════════════════════════════════════════════════════════

  // ── FRIEND CARD – tap to show options ─────────────────────────────
  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity activeOpacity={0.7} onPress={() => handleFriendTap(item)}>
      <Surface style={styles.card} elevation={1}>
        <View style={styles.cardRow}>
          {renderAvatar(item)}
          <View style={styles.cardInfo}>
            <Text variant="titleMedium" style={styles.name}>
              {item.fullName ?? item.username}
            </Text>
            <Text variant="bodySmall" style={styles.username}>
              @{item.username}
            </Text>
            {/* Hint text */}
            <Text variant="bodySmall" style={styles.tapHint}>
              Tap for options
            </Text>
          </View>

          {/* Quick action icons */}
          <View style={styles.quickIcons}>
            {/* Message icon */}
            <IconButton
              icon="message-outline"
              size={22}
              iconColor="#6200ee"
              onPress={() => {
                setSelectedFriend(item);
                handleMessageFriend();
              }}
            />
            {/* More options */}
            <IconButton
              icon="dots-vertical"
              size={22}
              iconColor="#888"
              onPress={() => handleFriendTap(item)}
            />
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );

  // ── REQUEST CARD ───────────────────────────────────────────────────
  const renderRequest = ({ item }: { item: Friend }) => (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.cardRow}>
        {renderAvatar(item)}
        <View style={styles.cardInfo}>
          <Text variant="titleMedium" style={styles.name}>
            {item.fullName ?? item.username}
          </Text>
          <Text variant="bodySmall" style={styles.username}>
            @{item.username}
          </Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <Button
          mode="contained"
          style={[styles.requestBtn, { marginRight: 8 }]}
          onPress={() => handleAccept(item.friendshipId)}
          icon="check"
        >
          Accept
        </Button>
        <Button
          mode="outlined"
          style={styles.requestBtn}
          textColor="red"
          onPress={() => handleReject(item.friendshipId)}
          icon="close"
        >
          Decline
        </Button>
      </View>
    </Surface>
  );

  // ── SEARCH RESULT CARD ─────────────────────────────────────────────
  const renderSearchResult = ({ item }: { item: UserProfile }) => (
    <Surface style={styles.card} elevation={1}>
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: "/(tabs)/view-profile",
            params: { userId: item.id.toString() },
          })
        }
        activeOpacity={0.8}
      >
        <View style={styles.cardRow}>
          {renderAvatar(item)}
          <View style={styles.cardInfo}>
            <Text variant="titleMedium" style={styles.name}>
              {item.fullName ?? item.username}
            </Text>
            <Text variant="bodySmall" style={styles.username}>
              @{item.username}
            </Text>
            {item.bio ? (
              <Text variant="bodySmall" numberOfLines={1} style={styles.bio}>
                {item.bio}
              </Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {/* Action buttons */}
      <View style={styles.searchActions}>
        <Button
          mode="outlined"
          icon="message-outline"
          compact
          style={styles.searchBtn}
          textColor="#6200ee"
          onPress={() =>
            router.push({
              pathname: "/(tabs)/chat",
              params: {
                userId: item.id.toString(),
                username: item.username,
                fullName: item.fullName ?? item.username,
                picture: item.profilePictureUrl ?? "",
              },
            })
          }
        >
          Message
        </Button>
        <Button
          mode="contained"
          compact
          icon="account-plus"
          style={styles.searchBtn}
          onPress={() => handleSendRequest(item.id, item.username)}
        >
          Add Friend
        </Button>
      </View>
    </Surface>
  );

  // ══════════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      {/* ── TAB SWITCHER ── */}
      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        style={styles.tabs}
        buttons={[
          {
            value: "friends",
            label: `Friends (${friends.length})`,
            icon: "account-group",
          },
          {
            value: "requests",
            label:
              requests.length > 0
                ? `Requests (${requests.length})`
                : "Requests",
            icon: "account-clock",
          },
          {
            value: "search",
            label: "Search",
            icon: "account-search",
          },
        ]}
      />

      {/* ── SEARCH BAR ── */}
      {tab === "search" && (
        <Searchbar
          placeholder="Search by username or name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          loading={searching}
        />
      )}

      {/* ── LOADING ── */}
      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      )}

      {/* ── FRIENDS TAB ── */}
      {tab === "friends" && !loading && (
        <FlatList
          data={friends}
          keyExtractor={(i) => i.friendshipId.toString()}
          renderItem={renderFriend}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={
            friends.length === 0 ? { flex: 1 } : { padding: 12 }
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>👥</Text>
              <Text variant="titleMedium" style={styles.emptyText}>
                No friends yet
              </Text>
              <Button
                mode="contained"
                style={{ marginTop: 16 }}
                onPress={() => setTab("search")}
                icon="account-search"
              >
                Find Friends
              </Button>
            </View>
          }
        />
      )}

      {/* ── REQUESTS TAB ── */}
      {tab === "requests" && !loading && (
        <FlatList
          data={requests}
          keyExtractor={(i) => i.friendshipId.toString()}
          renderItem={renderRequest}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={
            requests.length === 0 ? { flex: 1 } : { padding: 12 }
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text variant="titleMedium" style={styles.emptyText}>
                No pending requests
              </Text>
            </View>
          }
        />
      )}

      {/* ── SEARCH TAB ── */}
      {tab === "search" && !loading && (
        <FlatList
          data={searchResult}
          keyExtractor={(i) => i.id.toString()}
          renderItem={renderSearchResult}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={
            searchResult.length === 0 ? { flex: 1 } : { padding: 12 }
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text variant="titleMedium" style={styles.emptyText}>
                {searchQuery.length < 2
                  ? "Type 2+ characters to search"
                  : "No users found"}
              </Text>
            </View>
          }
        />
      )}

      {/* ══════════════════════════════════════════════════════════════
           ACTION MODAL – kapag nag-tap ng friend
         ══════════════════════════════════════════════════════════════ */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        {/* Backdrop – tap to close */}
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        />

        {/* Modal content */}
        <View style={styles.modalSheet}>
          {selectedFriend && (
            <>
              {/* Friend info header */}
              <View style={styles.modalHeader}>
                {renderAvatar(selectedFriend)}
                <View style={{ marginLeft: 12 }}>
                  <Text variant="titleMedium" style={styles.modalName}>
                    {selectedFriend.fullName ?? selectedFriend.username}
                  </Text>
                  <Text variant="bodySmall" style={styles.modalUsername}>
                    @{selectedFriend.username}
                  </Text>
                </View>
              </View>

              <Divider style={{ marginBottom: 12 }} />

              {/* Option 1: View Profile */}
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleViewProfile}
              >
                <View style={styles.modalOptionIcon}>
                  <Text style={styles.modalOptionEmoji}>👤</Text>
                </View>
                <View>
                  <Text variant="titleSmall" style={styles.modalOptionTitle}>
                    View Profile
                  </Text>
                  <Text variant="bodySmall" style={styles.modalOptionSub}>
                    See {selectedFriend.username}'s profile and posts
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Message */}
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleMessageFriend}
              >
                <View
                  style={[
                    styles.modalOptionIcon,
                    { backgroundColor: "#f0e8ff" },
                  ]}
                >
                  <Text style={styles.modalOptionEmoji}>💬</Text>
                </View>
                <View>
                  <Text variant="titleSmall" style={styles.modalOptionTitle}>
                    Send Message
                  </Text>
                  <Text variant="bodySmall" style={styles.modalOptionSub}>
                    Start a private conversation
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Option 3: Unfriend */}
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  setModalVisible(false);
                  handleUnfriend(
                    selectedFriend.friendshipId,
                    selectedFriend.fullName ?? selectedFriend.username,
                  );
                }}
              >
                <View
                  style={[
                    styles.modalOptionIcon,
                    { backgroundColor: "#fff0f0" },
                  ]}
                >
                  <Text style={styles.modalOptionEmoji}>❌</Text>
                </View>
                <View>
                  <Text
                    variant="titleSmall"
                    style={[styles.modalOptionTitle, { color: "#e74c3c" }]}
                  >
                    Unfriend
                  </Text>
                  <Text variant="bodySmall" style={styles.modalOptionSub}>
                    Remove from friends list
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Cancel button */}
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.cancelBtn}
              >
                Cancel
              </Button>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════════════
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
  tabs: {
    margin: 12,
  },
  searchbar: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
  },

  // ── CARDS ─────────────────────────────────────────────────────────
  card: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: "white",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  username: {
    color: "#888",
  },
  bio: {
    color: "#666",
    marginTop: 2,
  },
  tapHint: {
    color: "#bbb",
    fontSize: 11,
    marginTop: 2,
  },
  quickIcons: {
    flexDirection: "row",
    alignItems: "center",
  },

  // ── REQUEST ACTIONS ───────────────────────────────────────────────
  requestActions: {
    flexDirection: "row",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  requestBtn: {
    flex: 1,
    borderRadius: 8,
  },

  // ── SEARCH ACTIONS ────────────────────────────────────────────────
  searchActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  searchBtn: {
    flex: 1,
    borderRadius: 8,
  },

  // ── EMPTY STATE ───────────────────────────────────────────────────
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
    textAlign: "center",
  },

  // ── ACTION MODAL ──────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    backgroundColor: "white",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalName: {
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  modalUsername: {
    color: "#888",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 14,
  },
  modalOptionIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#f0f4ff",
    justifyContent: "center",
    alignItems: "center",
  },
  modalOptionEmoji: {
    fontSize: 22,
  },
  modalOptionTitle: {
    fontWeight: "600",
    color: "#1a1a2e",
  },
  modalOptionSub: {
    color: "#888",
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: 8,
    borderRadius: 12,
  },
});
