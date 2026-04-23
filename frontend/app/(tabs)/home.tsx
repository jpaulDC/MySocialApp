import React, { useState, useEffect, useCallback, memo } from 'react';
import {
    View, StyleSheet, FlatList,
    RefreshControl, Alert, TouchableOpacity, Image
} from 'react-native';
import {
    Text, Avatar, Surface, IconButton,
    ActivityIndicator, FAB, Divider, Button
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

// Iyong mga Custom Services
import { getFeed, deletePost, Post } from '../../services/postService';
import { toggleLike } from '../../services/likeCommentService';

// PALITAN MO ITO NG IP NA GAMIT MO SA LOGIN (e.g., 192.168.1.15)
const BASE_URL = 'http://192.168.1.105:5261'; 

// Helper function para sa oras
function timeAgo(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

// ── SEPARATE COMPONENT FOR POST ITEM ──────────────────────────────────
const PostItem = memo(function PostItemBase({ item, myUserId, handleDelete, router }: any) {
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
            likeCount: likeCount
        };
        // FIX: Tinitiyak na ang path ay tugma sa folder structure mo
        router.push({
            pathname: '/(tabs)/post-detail',
            params: {
                postId: item.id.toString(), // Importante ito para sa refresh
                post: JSON.stringify(item)
            }
        });
    };

    return (
        <Surface style={styles.postCard} elevation={1}>
            <View style={styles.postHeader}>
                {avatarUri
                    ? <Avatar.Image size={42} source={{ uri: avatarUri }} />
                    : <Avatar.Text size={42} label={initials} />
                }
                <View style={styles.postHeaderInfo}>
                    <Text variant="titleSmall" style={styles.postName}>{displayName}</Text>
                    <Text variant="bodySmall" style={styles.postTime}>
                        @{item.username} · {timeAgo(item.createdAt)}
                    </Text>
                </View>
                {isMyPost && (
                    <IconButton
                        icon="delete-outline"
                        size={20}
                        iconColor="#e74c3c"
                        onPress={() => handleDelete(item.id)}
                    />
                )}
            </View>

            <TouchableOpacity onPress={goToDetail} activeOpacity={0.9}>
                {item.content ? <Text variant="bodyMedium" style={styles.postContent}>{item.content}</Text> : null}
                {item.imageUrl ? (
                    <Image
                        source={{ uri: `${BASE_URL}${item.imageUrl}` }}
                        style={styles.postImage}
                        resizeMode="cover"
                    />
                ) : null}
            </TouchableOpacity>

            <Divider style={{ marginVertical: 8 }} />

            <View style={styles.postActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                    <IconButton
                        icon={liked ? 'heart' : 'heart-outline'}
                        size={22}
                        iconColor={liked ? '#e74c3c' : '#666'}
                    />
                    <Text style={[styles.actionCount, liked && { color: '#e74c3c' }]}>{likeCount}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={goToDetail}>
                    <IconButton icon="comment-outline" size={22} iconColor="#666" />
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

    // Pinagsama ang initialization logic
    useEffect(() => {
        const init = async () => {
            const token = await AsyncStorage.getItem('token');
            if (token) {
                try {
                    const decoded: any = jwtDecode(token);
                    // Standard JWT claim for User ID
                    const id = decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
                    setMyUserId(Number(id));
                } catch (e) { 
                    console.log("Token decode error", e); 
                }
            }
            loadFeed(1, true); // Initial load ng posts
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
                setPosts(prev => [...prev, ...data]);
            }
            // Pag mas mababa sa 10 ang bumalik, wala na itong kasunod
            setHasMore(data.length >= 10);
        } catch (err) {
            console.error("Feed error:", err);
            if (pageNum === 1) Alert.alert('Error', 'Failed to load feed. Check your connection.');
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
        Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deletePost(postId);
                        setPosts(prev => prev.filter(p => p.id !== postId));
                    } catch {
                        Alert.alert('Error', 'Failed to delete post.');
                    }
                }
            }
        ]);
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#6200ee" />
                <Text style={{ marginTop: 12 }}>Loading feed...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Surface style={styles.appBar} elevation={2}>
                <Text variant="headlineSmall" style={styles.appBarTitle}>📱 SocialApp</Text>
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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6200ee']} />}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 16 }} /> : <View style={{ height: 80 }} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text variant="titleMedium" style={styles.emptyText}>Your feed is empty</Text>
                        <Text variant="bodySmall" style={styles.emptySubtext}>Be the first to post something!</Text>
                        <Button 
                            mode="contained" 
                            style={{ marginTop: 16 }} 
                            icon="plus" 
                            onPress={() => router.push('/(tabs)/create-post')}
                        >
                            Create Post
                        </Button>
                    </View>
                }
                contentContainerStyle={posts.length === 0 ? { flex: 1 } : { padding: 12 }}
            />

            <FAB 
                icon="plus" 
                style={styles.fab} 
                onPress={() => router.push('/(tabs)/create-post')} 
                label="Post" 
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    appBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white' },
    appBarTitle: { fontWeight: 'bold', color: '#1a1a2e' },
    postCard: { borderRadius: 12, padding: 12, backgroundColor: 'white', marginBottom: 12 },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    postHeaderInfo: { flex: 1, marginLeft: 10 },
    postName: { fontWeight: 'bold', color: '#1a1a2e' },
    postTime: { color: '#888' },
    postContent: { color: '#333', lineHeight: 22, marginBottom: 8, paddingHorizontal: 4 },
    postImage: { width: '100%', height: 250, borderRadius: 10, marginBottom: 4 },
    postActions: { flexDirection: 'row', alignItems: 'center' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
    actionCount: { color: '#666', fontSize: 14, marginLeft: -8 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    emptyIcon: { fontSize: 56, marginBottom: 12 },
    emptyText: { fontWeight: 'bold', color: '#1a1a2e', textAlign: 'center' },
    emptySubtext: { color: '#888', textAlign: 'center', marginTop: 8 },
    fab: { position: 'absolute', bottom: 16, right: 16, borderRadius: 16, backgroundColor: '#6200ee' },
});