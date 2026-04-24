import api from "./api";

export interface Reel {
  id: number;
  videoUrl: string;
  thumbnailUrl?: string;
  caption?: string;
  duration: number;
  userId: number;
  username: string;
  fullName?: string;
  profilePicture?: string;
  likeCount: number;
  commentCount: number;
  isLikedByMe: boolean;
  createdAt: string;
}

export interface ReelComment {
  id: number;
  content: string;
  reelId: number;
  userId: number;
  username: string;
  fullName?: string;
  profilePicture?: string;
  isMyComment: boolean;
  createdAt: string;
}

// ── UPLOAD REEL ────────────────────────────────────────────────────────
export const uploadReel = async (
  videoUri: string,
  caption?: string,
): Promise<Reel> => {
  const formData = new FormData();
  formData.append("video", {
    uri: videoUri,
    type: "video/mp4",
    name: "reel.mp4",
  } as any);
  if (caption) formData.append("caption", caption);

  const res = await api.post("/reel/upload", formData, {
    // ← FIXED
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.reel;
};

// ── GET REELS FEED ─────────────────────────────────────────────────────
export const getReels = async (page: number = 1): Promise<Reel[]> => {
  const res = await api.get(`/reel?page=${page}`); // ← FIXED
  return res.data;
};

// ── TOGGLE REEL LIKE ───────────────────────────────────────────────────
export const toggleReelLike = async (reelId: number) => {
  const res = await api.post(`/reel/${reelId}/like`); // ← FIXED
  return res.data;
};

// ── GET REEL COMMENTS ──────────────────────────────────────────────────
export const getReelComments = async (
  reelId: number,
): Promise<ReelComment[]> => {
  const res = await api.get(`/reel/${reelId}/comments`); // ← FIXED
  return res.data;
};

// ── ADD REEL COMMENT ───────────────────────────────────────────────────
export const addReelComment = async (
  reelId: number,
  content: string,
): Promise<ReelComment> => {
  const res = await api.post(
    `/reel/${reelId}/comment`,
    JSON.stringify(content),
    {
      // ← FIXED
      headers: { "Content-Type": "application/json" },
    },
  );
  return res.data.comment;
};

// ── DELETE REEL ────────────────────────────────────────────────────────
export const deleteReel = async (reelId: number): Promise<void> => {
  await api.delete(`/reel/${reelId}`);
};
