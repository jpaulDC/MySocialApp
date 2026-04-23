import api from './api';

// TypeScript type para sa Post
export interface Post {
    id: number;
    content?: string;
    imageUrl?: string;
    videoUrl?: string;
    type: string;        // "Text" | "Image" | "Video"
    userId: number;
    username: string;
    fullName?: string;
    profilePicture?: string;
    likeCount: number;
    commentCount: number;
    isLikedByMe: boolean;
    createdAt: string;
}

// ── CREATE POST ────────────────────────────────────────────────────────
export const createPost = async (
    content?: string,
    imageUri?: string
): Promise<Post> => {
    const formData = new FormData();

    if (content) formData.append('content', content);

    // Attach image if provided
    if (imageUri) {
        formData.append('image', {
            uri: imageUri,
            type: 'image/jpeg',
            name: 'post.jpg',
        } as any);
    }

    const res = await api.post('/post', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });

    return res.data.post;
};

// ── GET FEED ───────────────────────────────────────────────────────────
export const getFeed = async (page: number = 1): Promise<Post[]> => {
    const res = await api.get(`/post/feed?page=${page}`);
    return res.data;
};

export const getPostById = async (id: number): Promise<Post> => {
    const response = await api.get(`/post/${id}`);
    return response.data;
};

// ── GET USER POSTS ─────────────────────────────────────────────────────
export const getUserPosts = async (userId: number): Promise<Post[]> => {
    const res = await api.get(`/post/user/${userId}`);
    return res.data;
};

// ── DELETE POST ────────────────────────────────────────────────────────
export const deletePost = async (postId: number): Promise<void> => {
    await api.delete(`/post/${postId}`);
};