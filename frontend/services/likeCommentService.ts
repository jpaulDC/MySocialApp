import api from "./api";

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
  action: string; // "liked" | "unliked"
  likeCount: number;
  isLiked: boolean;
}

// ── TOGGLE LIKE ────────────────────────────────────────────────────────
export const toggleLike = async (postId: number): Promise<LikeResponse> => {
  try {
    const response = await api.post(`/LikeComment/like/${postId}`);
    return response.data;
  } catch (error) {
    console.error("Toggle Like Error:", error);
    throw error;
  }
};

// ── GET USERS WHO LIKED ────────────────────────────────────────────────
export const getLikes = async (postId: number) => {
  const res = await api.get(`/LikeComment/likes/${postId}`);
  return res.data;
};

// ── ADD COMMENT ────────────────────────────────────────────────────────
export const addComment = async (
  postId: number,
  content: string,
): Promise<Comment> => {
  const res = await api.post(`/LikeComment/comment/${postId}`, { content });
  return res.data;
};

// ── GET COMMENTS ───────────────────────────────────────────────────────
export const getComments = async (postId: number): Promise<Comment[]> => {
  const res = await api.get(`/LikeComment/comments/${postId}`);
  return res.data;
};

// ── DELETE COMMENT ─────────────────────────────────────────────────────
export const deleteComment = async (commentId: number): Promise<void> => {
  await api.delete(`/LikeComment/comment/${commentId}`);
};
