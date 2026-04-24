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

// THEME CONSTANTS
const THEME = {
  bg: "#0A0A0A",
  surface: "#1E293B",
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#E2E8F0",
  muted: "#94A3B8",
  error: "#FF4B4B",
  success: "#10B981",
};

export default function FriendsScreen() {
  const router = useRouter();

  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([getFriends(), getPendingRequests()]);
      setFriends(f);
      setRequests(r);
    } catch {
      Alert.alert(
        "System Error",
        "Failed to bridge connection with the network.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        Alert.alert("Network Error", "User search sequence failed.");
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, tab]);

  const handleFriendTap = (friend: Friend) => {
    setSelectedFriend(friend);
    setModalVisible(true);
  };

  const handleViewProfile = () => {
    if (!selectedFriend) return;
    setModalVisible(false);
    router.push({
      pathname: "/(tabs)/view-profile",
      params: { userId: selectedFriend.userId.toString() },
    });
  };

  const handleMessageFriend = () => {
    if (!selectedFriend) return;
    setModalVisible(false);
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

  const handleAccept = async (friendshipId: number) => {
    try {
      await acceptFriendRequest(friendshipId);
      Alert.alert("CONNECTED", "User has been added to your network!");
      loadData();
    } catch {
      Alert.alert("Error", "Protocol failed to accept request.");
    }
  };

  const handleReject = async (friendshipId: number) => {
    try {
      await rejectFriendRequest(friendshipId);
      loadData();
    } catch {
      Alert.alert("Error", "Failed to terminate request.");
    }
  };

  const handleUnfriend = (id: number, name: string) => {
    Alert.alert("TERMINATE LINK", `Sever connection with ${name}?`, [
      { text: "Abort", style: "cancel" },
      {
        text: "Terminate",
        style: "destructive",
        onPress: async () => {
          try {
            await unfriend(id);
            loadData();
          } catch {
            Alert.alert("Error", "Failed to sever link.");
          }
        },
      },
    ]);
  };

  const handleSendRequest = async (userId: number, username: string) => {
    try {
      await sendFriendRequest(userId);
      Alert.alert("TRANSMITTED", "Friend request sent to " + username);
    } catch (e: any) {
      Alert.alert("Blocked", e.response?.data?.message ?? "Link failed.");
    }
  };

  const renderAvatar = (item: any) => {
    const uri = item.profilePictureUrl
      ? `${BASE_URL}${item.profilePictureUrl}`
      : null;
    const initials = (item.fullName ?? item.username ?? "?")[0].toUpperCase();
    return (
      <View style={styles.avatarBorder}>
        {uri ? (
          <Avatar.Image
            size={50}
            source={{ uri }}
            style={{ backgroundColor: THEME.bg }}
          />
        ) : (
          <Avatar.Text
            size={50}
            label={initials}
            style={{ backgroundColor: THEME.bg }}
            labelStyle={{ color: THEME.accent }}
          />
        )}
      </View>
    );
  };

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
              ID: {item.username}
            </Text>
          </View>
          <View style={styles.quickIcons}>
            <IconButton
              icon="comment-text-outline"
              size={22}
              iconColor={THEME.accent}
              onPress={() => {
                setSelectedFriend(item);
                // We directly trigger the message push
                router.push({
                  pathname: "/(tabs)/chat",
                  params: {
                    userId: item.userId.toString(),
                    username: item.username,
                    fullName: item.fullName ?? item.username,
                    picture: item.profilePictureUrl ?? "",
                  },
                });
              }}
            />
            <IconButton
              icon="dots-vertical"
              size={22}
              iconColor={THEME.muted}
              onPress={() => handleFriendTap(item)}
            />
          </View>
        </View>
      </Surface>
    </TouchableOpacity>
  );

  const renderRequest = ({ item }: { item: Friend }) => (
    <Surface style={styles.card} elevation={1}>
      <View style={styles.cardRow}>
        {renderAvatar(item)}
        <View style={styles.cardInfo}>
          <Text variant="titleMedium" style={styles.name}>
            {item.fullName ?? item.username}
          </Text>
          <Text variant="bodySmall" style={styles.username}>
            INCOMING SIGNAL
          </Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <Button
          mode="contained"
          style={[styles.requestBtn, { backgroundColor: THEME.success }]}
          onPress={() => handleAccept(item.friendshipId)}
          icon="check-bold"
        >
          ACCEPT
        </Button>
        <Button
          mode="outlined"
          style={styles.requestBtn}
          textColor={THEME.error}
          onPress={() => handleReject(item.friendshipId)}
          icon="close-thick"
        >
          REJECT
        </Button>
      </View>
    </Surface>
  );

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
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.searchActions}>
        <Button
          mode="outlined"
          icon="message"
          compact
          style={styles.searchBtn}
          textColor={THEME.accent}
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
          MESSAGE
        </Button>
        <Button
          mode="contained"
          compact
          icon="account-plus"
          style={[styles.searchBtn, { backgroundColor: THEME.primary }]}
          onPress={() => handleSendRequest(item.id, item.username)}
        >
          ADD LINK
        </Button>
      </View>
    </Surface>
  );

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={tab}
        onValueChange={setTab}
        style={styles.tabs}
        theme={{ colors: { secondaryContainer: THEME.primary } }}
        buttons={[
          {
            value: "friends",
            label: `NET (${friends.length})`,
            icon: "account-group",
            checkedColor: "#fff",
            uncheckedColor: THEME.muted,
          },
          {
            value: "requests",
            label: requests.length > 0 ? `REQS (${requests.length})` : "REQS",
            icon: "bell-outline",
            checkedColor: "#fff",
            uncheckedColor: THEME.muted,
          },
          {
            value: "search",
            label: "SEARCH",
            icon: "magnify",
            checkedColor: "#fff",
            uncheckedColor: THEME.muted,
          },
        ]}
      />

      {tab === "search" && (
        <Searchbar
          placeholder="Scan user database..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={{ color: THEME.text }}
          iconColor={THEME.accent}
          placeholderTextColor={THEME.muted}
          loading={searching}
        />
      )}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={THEME.accent} />
        </View>
      ) : (
        <FlatList
          data={
            (tab === "friends"
              ? friends
              : tab === "requests"
                ? requests
                : searchResult) as any[]
          }
          keyExtractor={(item: any) =>
            (item.friendshipId || item.id || item.userId).toString()
          }
          renderItem={({ item }: { item: any }) => {
            if (tab === "friends") return renderFriend({ item });
            if (tab === "requests") return renderRequest({ item });
            return renderSearchResult({ item });
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={THEME.accent}
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>
                {tab === "friends" ? "🛰️" : tab === "requests" ? "📡" : "🔍"}
              </Text>
              <Text variant="titleMedium" style={styles.emptyText}>
                {tab === "friends"
                  ? "No network connections found."
                  : tab === "requests"
                    ? "No incoming signals."
                    : "Awaiting scan parameters."}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          {selectedFriend && (
            <>
              <View style={styles.modalHeader}>
                {renderAvatar(selectedFriend)}
                <View style={{ marginLeft: 15 }}>
                  <Text variant="headlineSmall" style={styles.modalName}>
                    {selectedFriend.fullName ?? selectedFriend.username}
                  </Text>
                  <Text variant="bodyMedium" style={{ color: THEME.accent }}>
                    ACTIVE_CONNECTION
                  </Text>
                </View>
              </View>
              <Divider
                style={{
                  backgroundColor: "rgba(255,255,255,0.1)",
                  marginBottom: 15,
                }}
              />
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleViewProfile}
              >
                <IconButton
                  icon="account-details"
                  iconColor={THEME.accent}
                  containerColor={THEME.bg}
                />
                <View>
                  <Text style={styles.modalOptionTitle}>View Profile</Text>
                  <Text style={styles.modalOptionSub}>
                    Access user data logs
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleMessageFriend}
              >
                <IconButton
                  icon="chat-processing"
                  iconColor={THEME.accent}
                  containerColor={THEME.bg}
                />
                <View>
                  <Text style={styles.modalOptionTitle}>Direct Message</Text>
                  <Text style={styles.modalOptionSub}>
                    Open secure comms channel
                  </Text>
                </View>
              </TouchableOpacity>
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
                <IconButton
                  icon="link-off"
                  iconColor={THEME.error}
                  containerColor={THEME.bg}
                />
                <View>
                  <Text
                    style={[styles.modalOptionTitle, { color: THEME.error }]}
                  >
                    Sever Connection
                  </Text>
                  <Text style={styles.modalOptionSub}>Remove from network</Text>
                </View>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  tabs: { margin: 16, backgroundColor: THEME.surface, borderRadius: 12 },
  searchbar: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: THEME.surface,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: THEME.surface,
    borderLeftWidth: 4,
    borderLeftColor: THEME.primary,
  },
  cardRow: { flexDirection: "row", alignItems: "center" },
  cardInfo: { flex: 1, marginLeft: 16 },
  avatarBorder: {
    borderRadius: 30,
    padding: 2,
    borderWidth: 1,
    borderColor: THEME.accent,
  },
  name: { fontWeight: "bold", color: THEME.text },
  username: { color: THEME.muted, fontSize: 12 },
  quickIcons: { flexDirection: "row" },
  requestActions: { flexDirection: "row", marginTop: 15, gap: 10 },
  requestBtn: { flex: 1, borderRadius: 8 },
  searchActions: { flexDirection: "row", gap: 10, marginTop: 15 },
  searchBtn: { flex: 1, borderRadius: 8 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyIcon: { fontSize: 60, marginBottom: 20 },
  emptyText: { color: THEME.muted, textAlign: "center", letterSpacing: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)" },
  modalSheet: {
    backgroundColor: THEME.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    borderTopWidth: 2,
    borderTopColor: THEME.accent,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: THEME.muted,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  modalName: { fontWeight: "bold", color: THEME.text },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 10,
  },
  modalOptionTitle: { fontWeight: "bold", color: THEME.text, fontSize: 16 },
  modalOptionSub: { color: THEME.muted, fontSize: 12 },
});
