import React, { useEffect, useState, useCallback } from 'react';
import {
    View, StyleSheet, FlatList,
    Alert, RefreshControl
} from 'react-native';
import {
    Text, Searchbar, Avatar, Surface,
    Button, Chip, ActivityIndicator,
    SegmentedButtons, Divider
} from 'react-native-paper';
import {
    getFriends, getPendingRequests,
    acceptFriendRequest, rejectFriendRequest,
    unfriend, searchUsers, sendFriendRequest,
    Friend
} from '../../services/friendService';
import { UserProfile } from '../../services/userService';

const BASE_URL = 'http://192.168.1.XXX:5000';

export default function FriendsScreen() {
    // Tab state: "friends" | "requests" | "search"
    const [tab, setTab] = useState('friends');
    const [friends, setFriends] = useState<Friend[]>([]);
    const [requests, setRequests] = useState<Friend[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [searching, setSearching] = useState(false);

    // Load friends and pending requests
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [f, r] = await Promise.all([getFriends(), getPendingRequests()]);
            setFriends(f);
            setRequests(r);
        } catch {
            Alert.alert('Error', 'Failed to load friends data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { loadData(); }, []);

    // Search users as user types (debounce effect)
    useEffect(() => {
        if (tab !== 'search') return;

        const timer = setTimeout(async () => {
            if (searchQuery.length < 2) {
                setSearchResult([]);
                return;
            }
            setSearching(true);
            try {
                const results = await searchUsers(searchQuery);
                setSearchResult(results);
            } catch {
                Alert.alert('Error', 'Search failed.');
            } finally {
                setSearching(false);
            }
        }, 500); // Wait 500ms after user stops typing

        return () => clearTimeout(timer);
    }, [searchQuery, tab]);

    // ── ACCEPT REQUEST ─────────────────────────────────────────────────
    const handleAccept = async (friendshipId: number) => {
        try {
            await acceptFriendRequest(friendshipId);
            Alert.alert('✅ Accepted!', 'You are now friends!');
            loadData(); // Refresh lists
        } catch {
            Alert.alert('Error', 'Failed to accept request.');
        }
    };

    // ── REJECT REQUEST ─────────────────────────────────────────────────
    const handleReject = async (friendshipId: number) => {
        try {
            await rejectFriendRequest(friendshipId);
            loadData();
        } catch {
            Alert.alert('Error', 'Failed to reject request.');
        }
    };

    // ── UNFRIEND ───────────────────────────────────────────────────────
    const handleUnfriend = (friendshipId: number, name: string) => {
        Alert.alert(
            'Unfriend',
            `Remove ${name} from your friends?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unfriend',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await unfriend(friendshipId);
                            loadData();
                        } catch {
                            Alert.alert('Error', 'Failed to unfriend.');
                        }
                    }
                }
            ]
        );
    };

    // ── SEND FRIEND REQUEST (from search) ─────────────────────────────
    const handleSendRequest = async (userId: number, username: string) => {
        try {
            const message = await sendFriendRequest(userId);
            Alert.alert('✅ Sent!', message);
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to send request.';
            Alert.alert('Error', msg);
        }
    };

    // ── AVATAR HELPER ──────────────────────────────────────────────────
    const renderAvatar = (item: { profilePictureUrl?: string; username: string; fullName?: string }) => {
        const uri = item.profilePictureUrl
            ? `${BASE_URL}${item.profilePictureUrl}`
            : null;
        const initials = (item.fullName ?? item.username)[0].toUpperCase();

        return uri
            ? <Avatar.Image size={50} source={{ uri }} />
            : <Avatar.Text size={50} label={initials} />;
    };

    // ── RENDER: FRIENDS LIST ───────────────────────────────────────────
    const renderFriend = ({ item }: { item: Friend }) => (
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
                <Button
                    mode="outlined"
                    compact
                    textColor="red"
                    onPress={() =>
                        handleUnfriend(item.friendshipId, item.fullName ?? item.username)
                    }
                >
                    Unfriend
                </Button>
            </View>
        </Surface>
    );

    // ── RENDER: PENDING REQUESTS ───────────────────────────────────────
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
            {/* Accept / Reject buttons */}
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

    // ── RENDER: SEARCH RESULTS ─────────────────────────────────────────
    const renderSearchResult = ({ item }: { item: UserProfile }) => (
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
                    {item.bio ? (
                        <Text variant="bodySmall" numberOfLines={1} style={styles.bio}>
                            {item.bio}
                        </Text>
                    ) : null}
                </View>
                <Button
                    mode="contained"
                    compact
                    icon="account-plus"
                    onPress={() => handleSendRequest(item.id, item.username)}
                >
                    Add
                </Button>
            </View>
        </Surface>
    );

    return (
        <View style={styles.container}>

            {/* ── TAB SWITCHER ── */}
            <SegmentedButtons
                value={tab}
                onValueChange={setTab}
                style={styles.tabs}
                buttons={[
                    {
                        value: 'friends',
                        label: `Friends (${friends.length})`,
                        icon: 'account-group'
                    },
                    {
                        value: 'requests',
                        label: `Requests${requests.length > 0 ? ` (${requests.length})` : ''}`,
                        icon: 'account-clock'
                    },
                    {
                        value: 'search',
                        label: 'Search',
                        icon: 'account-search'
                    },
                ]}
            />

            {/* ── SEARCH BAR (only for Search tab) ── */}
            {tab === 'search' && (
                <Searchbar
                    placeholder="Search by username or name..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchbar}
                    loading={searching}
                />
            )}

            {/* ── LOADING INDICATOR ── */}
            {loading && (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" />
                </View>
            )}

            {/* ── FRIENDS TAB ── */}
            {tab === 'friends' && !loading && (
                <FlatList
                    data={friends}
                    keyExtractor={item => item.friendshipId.toString()}
                    renderItem={renderFriend}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => {
                            setRefreshing(true);
                            loadData();
                        }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>👥</Text>
                            <Text variant="titleMedium" style={styles.emptyText}>
                                No friends yet
                            </Text>
                            <Text variant="bodySmall" style={styles.emptySubtext}>
                                Search for people to add as friends!
                            </Text>
                            <Button
                                mode="contained"
                                style={{ marginTop: 16 }}
                                onPress={() => setTab('search')}
                                icon="account-search"
                            >
                                Find Friends
                            </Button>
                        </View>
                    }
                    contentContainerStyle={
                        friends.length === 0 ? { flex: 1 } : { padding: 12 }
                    }
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                />
            )}

            {/* ── REQUESTS TAB ── */}
            {tab === 'requests' && !loading && (
                <FlatList
                    data={requests}
                    keyExtractor={item => item.friendshipId.toString()}
                    renderItem={renderRequest}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => {
                            setRefreshing(true);
                            loadData();
                        }} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>📭</Text>
                            <Text variant="titleMedium" style={styles.emptyText}>
                                No pending requests
                            </Text>
                            <Text variant="bodySmall" style={styles.emptySubtext}>
                                When someone sends you a friend request, it will appear here.
                            </Text>
                        </View>
                    }
                    contentContainerStyle={
                        requests.length === 0 ? { flex: 1 } : { padding: 12 }
                    }
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                />
            )}

            {/* ── SEARCH TAB ── */}
            {tab === 'search' && !loading && (
                <FlatList
                    data={searchResult}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderSearchResult}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>🔍</Text>
                            <Text variant="titleMedium" style={styles.emptyText}>
                                {searchQuery.length < 2
                                    ? 'Type at least 2 characters to search'
                                    : 'No users found'}
                            </Text>
                        </View>
                    }
                    contentContainerStyle={
                        searchResult.length === 0 ? { flex: 1 } : { padding: 12 }
                    }
                    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    tabs: {
        margin: 12,
    },
    searchbar: {
        marginHorizontal: 12,
        marginBottom: 8,
        borderRadius: 12,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        borderRadius: 12,
        padding: 12,
        backgroundColor: 'white',
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardInfo: {
        flex: 1,
        marginLeft: 12,
    },
    name: {
        fontWeight: 'bold',
        color: '#1a1a2e',
    },
    username: {
        color: '#888',
    },
    bio: {
        color: '#666',
        marginTop: 2,
    },
    requestActions: {
        flexDirection: 'row',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    requestBtn: {
        flex: 1,
        borderRadius: 8,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyIcon: {
        fontSize: 56,
        marginBottom: 12,
    },
    emptyText: {
        fontWeight: 'bold',
        color: '#1a1a2e',
        textAlign: 'center',
    },
    emptySubtext: {
        color: '#888',
        textAlign: 'center',
        marginTop: 8,
    },
});