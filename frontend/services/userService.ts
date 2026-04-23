import api from "./api";

// TypeScript type para sa User Profile
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  bio?: string;
  profilePictureUrl?: string;
  createdAt: string;
}

// ── GET MY PROFILE ─────────────────────────────────────────────────────
export const getMyProfile = async (): Promise<UserProfile> => {
  const response = await api.get("/user/me");
  return response.data;
};

// ── GET PROFILE BY ID ──────────────────────────────────────────────────
export const getProfileById = async (id: number): Promise<UserProfile> => {
  const response = await api.get(`/user/${id}`);
  return response.data;
};

// ── UPDATE PROFILE ─────────────────────────────────────────────────────
export const updateProfile = async (data: {
  fullName?: string;
  bio?: string;
}): Promise<void> => {
  await api.put("/user/me", data);
};

// ── UPLOAD PROFILE PICTURE ─────────────────────────────────────────────
export const uploadProfilePicture = async (
  imageUri: string,
): Promise<string> => {
  const formData = new FormData();

  // Siguraduhin na 'file' ang key kung iyon ang nasa Controller mo
  formData.append("file", {
    uri: imageUri,
    type: "image/jpeg",
    name: "profile-picture.jpg",
  } as any);

  const response = await api.post("/user/me/picture", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  // Ibinabalik nito ang path (e.g., /uploads/profiles/xyz.jpg)
  return response.data.profilePictureUrl;
};
