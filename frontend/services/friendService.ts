import api from './api';
import { UserProfile } from './userService';

// TypeScript type para sa Friend record
export interface Friend {
    friendshipId: number;
    userId: number;
    username: string;
    fullName?: string;
    profilePictureUrl?: string;
    status: string;
    isRequester: boolean;
    createdAt: string;
}

// ── SEND FRIEND REQUEST ────────────────────────────────────────────────
export const sendFriendRequest = async (addresseeId: number): Promise<string> => {
    const res = await api.post(`/friend/request/${addresseeId}`);
    return res.data.message;
};

// ── ACCEPT REQUEST ─────────────────────────────────────────────────────
export const acceptFriendRequest = async (friendshipId: number): Promise<string> => {
    const res = await api.put(`/friend/accept/${friendshipId}`);
    return res.data.message;
};

// ── REJECT REQUEST ─────────────────────────────────────────────────────
export const rejectFriendRequest = async (friendshipId: number): Promise<string> => {
    const res = await api.put(`/friend/reject/${friendshipId}`);
    return res.data.message;
};

// ── UNFRIEND ───────────────────────────────────────────────────────────
export const unfriend = async (friendshipId: number): Promise<string> => {
    const res = await api.delete(`/friend/${friendshipId}`);
    return res.data.message;
};

// ── GET FRIENDS LIST ───────────────────────────────────────────────────
export const getFriends = async (): Promise<Friend[]> => {
    const res = await api.get('/friend/list');
    return res.data;
};

// ── GET PENDING REQUESTS ───────────────────────────────────────────────
export const getPendingRequests = async (): Promise<Friend[]> => {
    const res = await api.get('/friend/requests');
    return res.data;
};

// ── GET FRIENDSHIP STATUS ──────────────────────────────────────────────
export const getFriendshipStatus = async (
    otherUserId: number
): Promise<{ status: string; friendshipId: number | null }> => {
    const res = await api.get(`/friend/status/${otherUserId}`);
    return res.data;
};

// ── SEARCH USERS ───────────────────────────────────────────────────────
export const searchUsers = async (query: string): Promise<UserProfile[]> => {
    const res = await api.get(`/friend/search?query=${query}`);
    return res.data;
};