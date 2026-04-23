import React, { useEffect, useState, useRef } from 'react';
import {
    View, StyleSheet, FlatList, Image,
    Alert, KeyboardAvoidingView, Platform,
    TouchableOpacity
} from 'react-native';
import {
    Text, Avatar, Surface, IconButton,
    TextInput, Divider,
    ActivityIndicator, Button
} from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
    getComments, addComment,
    deleteComment, Comment,
    toggleLike
} from '../../services/likeCommentService';
import { Post, getPostById } from '../../services/postService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://192.168.1.105:5261';

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

export default function PostDetailScreen() {
    const router = useRouter();
    const { postId, post: postParam } = useLocalSearchParams();

    const [post, setPost] = useState<Post | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    // FIX: Load Data Logic - Inalis ang mapanganib na Timeout
    useEffect(() => {
        const fetchPostData = async () => {
            try {
                setLoading(true);
                let currentPost: Post | null = null;

                // 1. Navigation load: Subukang i-parse ang post object mula sa params
                if (postParam) {
                    try {
                        currentPost = typeof postParam === 'string' ? JSON.parse(postParam) : postParam;
                    } catch (e) {
                        console.log("Post param parse error, fetching via ID instead.");
                    }
                }

                // 2. Refresh/Deep link load: Kung walang object, i-fetch gamit ang ID
                if (!currentPost && postId) {
                    console.log("Fetching fresh data for Post ID:", postId);
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

        // Optimistic UI Update
        setLiked(!wasLiked);
        setLikeCount(wasLiked ? likeCount - 1 : likeCount + 1);

        try {
            const res = await toggleLike(post.id);
            setLiked(res.isLiked);
            setLikeCount(res.likeCount);
        } catch {
            setLiked(wasLiked);
            setLikeCount(prevCount);
            Alert.alert('Error', 'Failed to update like.');
        }
    };

    const handleSubmitComment = async () => {
        if (!post) {
            Alert.alert('Error', 'Post data not found. Please refresh.');
            return;
        }

        const text = newComment.trim();
        if (!text) return;

        setSubmitting(true);
        try {
            const comment = await addComment(post.id, text);
            setComments(prev => [...prev, comment]);
            setNewComment('');

            // Scroll to bottom para makita ang bagong comment
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 300);
        } catch (error) {
            console.error("Comment Error:", error);
            Alert.alert('Error', 'Failed to post comment.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteComment = (commentId: number) => {
        Alert.alert('Delete Comment', 'Remove this comment?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteComment(commentId);
                        setComments(prev => prev.filter(c => c.id !== commentId));
                    } catch {
                        Alert.alert('Error', 'Failed to delete comment.');
                    }
                }
            }
        ]);
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#6200ee" />
                <Text style={{ marginTop: 12 }}>Loading post details...</Text>
            </View>
        );
    }

    if (!post) {
        return (
            <View style={styles.centered}>
                <Text variant="headlineSmall" style={{ color: '#e74c3c', fontWeight: 'bold' }}>Data Lost</Text>
                <Text style={{ textAlign: 'center', marginHorizontal: 40, marginTop: 10, color: '#666' }}>
                    Hindi mahanap ang post data. Pakibalik sa Home at i-click muli ang post.
                </Text>
                <Button mode="contained" onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: 20 }}>
                    Bumalik sa Home
                </Button>
            </View>
        );
    }

    const PostHeader = () => {
        const avatarUri = post.profilePicture ? `${BASE_URL}${post.profilePicture}` : null;
        const displayName = post.fullName ?? post.username ?? 'User';
        const initials = displayName[0]?.toUpperCase() ?? "?";

        return (
            <Surface style={styles.postCard} elevation={1}>
                <View style={styles.postHeader}>
                    {avatarUri
                        ? <Avatar.Image size={46} source={{ uri: avatarUri }} />
                        : <Avatar.Text size={46} label={initials} />
                    }
                    <View style={styles.postHeaderInfo}>
                        <Text variant="titleSmall" style={styles.postName}>{displayName}</Text>
                        <Text variant="bodySmall" style={styles.postTime}>
                            @{post.username} · {timeAgo(post.createdAt)}
                        </Text>
                    </View>
                </View>

                {post.content ? <Text variant="bodyLarge" style={styles.postContent}>{post.content}</Text> : null}

                {post.imageUrl ? (
                    <Image
                        source={{ uri: `${BASE_URL}${post.imageUrl}` }}
                        style={styles.postImage}
                        resizeMode="cover"
                    />
                ) : null}

                <Divider style={{ marginVertical: 10 }} />

                <View style={styles.countsRow}>
                    <Text variant="bodySmall" style={styles.countText}>
                        ❤️ {likeCount} {likeCount === 1 ? 'like' : 'likes'}
                    </Text>
                    <Text variant="bodySmall" style={styles.countText}>
                        💬 {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                    </Text>
                </View>

                <Divider style={{ marginVertical: 8 }} />

                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                        <IconButton
                            icon={liked ? 'heart' : 'heart-outline'}
                            size={22}
                            iconColor={liked ? '#e74c3c' : '#555'}
                        />
                        <Text style={[styles.actionLabel, liked && { color: '#e74c3c', fontWeight: 'bold' }]}>
                            {liked ? 'Liked' : 'Like'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn}>
                        <IconButton icon="comment-outline" size={22} iconColor="#555" />
                        <Text style={styles.actionLabel}>Comment</Text>
                    </TouchableOpacity>
                </View>

                <Divider />
                <Text variant="titleSmall" style={styles.commentsLabel}>💬 Comments</Text>
            </Surface>
        );
    };

    const renderComment = ({ item }: { item: Comment }) => {
        const commentAvatar = item.profilePicture ? `${BASE_URL}${item.profilePicture}` : null;
        const commentName = item.fullName ?? item.username ?? 'User';
        const commentInitials = commentName[0]?.toUpperCase() ?? "?";

        return (
            <View style={styles.commentCard}>
                {commentAvatar
                    ? <Avatar.Image size={36} source={{ uri: commentAvatar }} />
                    : <Avatar.Text size={36} label={commentInitials} style={styles.commentAvatar} />
                }
                <View style={styles.commentBubble}>
                    <View style={styles.commentHeader}>
                        <Text variant="labelMedium" style={styles.commentName}>{commentName}</Text>
                        <Text variant="bodySmall" style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
                    </View>
                    <Text variant="bodyMedium" style={styles.commentText}>{item.content}</Text>
                </View>
                {item.isMyComment && (
                    <IconButton
                        icon="delete-outline"
                        size={18}
                        iconColor="#e74c3c"
                        onPress={() => handleDeleteComment(item.id)}
                    />
                )}
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <Surface style={styles.header} elevation={2}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Text variant="titleLarge" style={styles.headerTitle}>Post</Text>
                <View style={{ width: 48 }} />
            </Surface>

            <FlatList
                ref={flatListRef}
                data={comments}
                keyExtractor={item => item.id.toString()}
                renderItem={renderComment}
                ListHeaderComponent={<PostHeader />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.noComments}>
                            <Text style={styles.noCommentsIcon}>💬</Text>
                            <Text variant="bodyMedium" style={styles.noCommentsText}>
                                No comments yet. Be the first!
                            </Text>
                        </View>
                    ) : (
                        <ActivityIndicator style={{ marginTop: 20 }} color="#6200ee" />
                    )
                }
                contentContainerStyle={styles.listContent}
            />

            <Surface style={styles.inputBar} elevation={4}>
                <TextInput
                    placeholder="Write a comment..."
                    value={newComment}
                    onChangeText={setNewComment}
                    mode="outlined"
                    style={styles.commentInput}
                    multiline
                    maxLength={500}
                    dense
                    right={
                        <TextInput.Icon
                            icon="send"
                            disabled={!newComment.trim() || submitting}
                            color={newComment.trim() ? '#6200ee' : '#ccc'}
                            onPress={handleSubmitComment}
                        />
                    }
                />
            </Surface>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f0f2f5' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', paddingVertical: 4 },
    headerTitle: { fontWeight: 'bold', color: '#1a1a2e' },
    postCard: { backgroundColor: 'white', padding: 16, marginBottom: 8 },
    postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    postHeaderInfo: { flex: 1, marginLeft: 12 },
    postName: { fontWeight: 'bold', color: '#1a1a2e' },
    postTime: { color: '#888' },
    postContent: { color: '#222', lineHeight: 24, marginBottom: 12 },
    postImage: { width: '100%', height: 260, borderRadius: 10, marginBottom: 8 },
    countsRow: { flexDirection: 'row', gap: 16, paddingVertical: 4 },
    countText: { color: '#555' },
    actionsRow: { flexDirection: 'row', marginBottom: 4 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
    actionLabel: { color: '#555', fontWeight: '600', marginLeft: -6 },
    commentsLabel: { fontWeight: 'bold', color: '#1a1a2e', paddingTop: 8 },
    listContent: { paddingBottom: 10 },
    commentCard: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 6 },
    commentAvatar: { marginTop: 2 },
    commentBubble: { flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 10, marginLeft: 8 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    commentName: { fontWeight: 'bold', color: '#1a1a2e' },
    commentTime: { color: '#aaa', fontSize: 11 },
    commentText: { color: '#333', lineHeight: 20 },
    noComments: { alignItems: 'center', paddingVertical: 40 },
    noCommentsIcon: { fontSize: 40, marginBottom: 8 },
    noCommentsText: { color: '#888' },
    inputBar: { padding: 10, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#eee' },
    commentInput: { backgroundColor: 'white', fontSize: 14, maxHeight: 100 },
});