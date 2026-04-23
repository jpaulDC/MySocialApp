import api from './api';

// ── TYPES ──────────────────────────────────────────────────────────────
export interface Comment {
    id: number;
    content: string;
    postId: number;
    userId: number;
    username: string;
    fullName?: string;
    profilePicture?: string;
    isMyComment: boolean;
    createdAt: string;
}

export interface LikeResponse {
    action: string;    // "liked" | "unliked"
    likeCount: number;
    isLiked: boolean;
}

// ── TOGGLE LIKE ────────────────────────────────────────────────────────
export const toggleLike = async (postId: number) => {
    try {
        // Siguraduhin na ang URL ay tumutugma sa [Route("api/[controller]")] ng PostController
        const response = await api.post(`/api/post/${postId}/like`);
        return response.data; // Dapat magbalik ito ng { isLiked: boolean, likeCount: number }
    } catch (error) {
        console.error("Toggle Like Error:", error);
        throw error;
    }
};

// ── GET USERS WHO LIKED ────────────────────────────────────────────────
export const getLikes = async (postId: number) => {
    const res = await api.get(`/likecomment/likes/${postId}`);
    return res.data;
};

// ── ADD COMMENT ────────────────────────────────────────────────────────
export const addComment = async (
    postId: number,
    content: string
): Promise<Comment> => {
    const res = await api.post(`/likecomment/comment/${postId}`, { content });
    return res.data.comment;
};

// ── GET COMMENTS ───────────────────────────────────────────────────────
export const getComments = async (postId: number): Promise<Comment[]> => {
    const res = await api.get(`/likecomment/comments/${postId}`);
    return res.data;
};

// ── DELETE COMMENT ─────────────────────────────────────────────────────
export const deleteComment = async (commentId: number): Promise<void> => {
    await api.delete(`/likecomment/comment/${commentId}`);
};