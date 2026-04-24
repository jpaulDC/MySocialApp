import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import {
    ActivityIndicator,
    Avatar,
    Button,
    IconButton,
    Surface,
    Text,
    TextInput,
} from "react-native-paper";
import {
    getMyProfile,
    updateProfile,
    uploadProfilePicture,
    UserProfile,
} from "../../services/userService";

const BASE_URL = "http://192.168.1.105:5261";

// THEME COLORS
const THEME = {
  bg: "#0A0A0A",
  surface: "#1E293B",
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#E2E8F0",
  muted: "#94A3B8",
  error: "#FF4B4B",
};

export default function EditProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Load current profile data into form - LOGIC INTACT
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyProfile();
        setProfile(data);
        setFullName(data.fullName ?? "");
        setBio(data.bio ?? "");
      } catch {
        Alert.alert("Error", "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Save text changes - LOGIC INTACT
  const handleSave = async () => {
    setSaving(true);
    try {
      await updateProfile({ fullName, bio });
      Alert.alert("Success! ✅", "Profile updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  // Pick image function - LOGIC INTACT
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photo library.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled) return;

    const imageUri = result.assets[0].uri;
    setUploading(true);

    try {
      const newUrl = await uploadProfilePicture(imageUri);
      setProfile((prev) =>
        prev ? { ...prev, profilePictureUrl: newUrl } : prev,
      );
      Alert.alert("Success! 🖼️", "Profile picture updated!");
    } catch (err) {
      console.error("Upload Error:", err);
      Alert.alert("Error", "Failed to upload picture.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: THEME.bg }]}>
        <ActivityIndicator size="large" color={THEME.accent} />
      </View>
    );
  }

  const avatarUri = profile?.profilePictureUrl
    ? `${BASE_URL}${profile.profilePictureUrl}`
    : null;
  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : (profile?.username?.[0]?.toUpperCase() ?? "?");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <IconButton
          icon="chevron-left"
          iconColor={THEME.text}
          size={30}
          onPress={() => router.back()}
        />
        <Text variant="titleLarge" style={styles.headerTitle}>
          EDIT <Text style={{ color: THEME.accent }}>IDENTITY</Text>
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <Surface style={styles.card} elevation={2}>
        {/* ── TAP TO CHANGE PROFILE PICTURE ── */}
        <TouchableOpacity
          onPress={handlePickImage}
          style={styles.avatarWrapper}
          disabled={uploading}
        >
          <View style={styles.avatarGlow}>
            {avatarUri ? (
              <Avatar.Image
                size={120}
                source={{ uri: avatarUri }}
                style={styles.avatarImg}
              />
            ) : (
              <Avatar.Text
                size={120}
                label={initials}
                style={styles.avatarImg}
                labelStyle={{ color: THEME.accent }}
              />
            )}
          </View>

          <Surface style={styles.cameraOverlay} elevation={4}>
            {uploading ? (
              <ActivityIndicator size={20} color={THEME.bg} />
            ) : (
              <IconButton icon="camera-flip" size={20} iconColor={THEME.bg} />
            )}
          </Surface>
        </TouchableOpacity>

        <Text variant="bodySmall" style={styles.tapHint}>
          TAP TO SYNC NEW AVATAR
        </Text>

        {/* ── FORM FIELDS ── */}
        <View style={styles.form}>
          <TextInput
            label="System Username"
            value={profile?.username ?? ""}
            mode="outlined"
            style={styles.input}
            disabled
            textColor={THEME.muted}
            outlineColor="rgba(255, 255, 255, 0.1)"
            left={<TextInput.Icon icon="shield-check" color={THEME.muted} />}
          />

          <TextInput
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            mode="outlined"
            style={styles.input}
            textColor={THEME.text}
            activeOutlineColor={THEME.accent}
            outlineColor="rgba(255, 255, 255, 0.2)"
            left={
              <TextInput.Icon
                icon="account-circle-outline"
                color={THEME.accent}
              />
            }
          />

          <TextInput
            label="Data Bio"
            value={bio}
            onChangeText={setBio}
            mode="outlined"
            style={[styles.input, { height: 100 }]}
            multiline
            numberOfLines={3}
            maxLength={150}
            textColor={THEME.text}
            activeOutlineColor={THEME.accent}
            outlineColor="rgba(255, 255, 255, 0.2)"
            left={
              <TextInput.Icon icon="script-text-outline" color={THEME.accent} />
            }
          />
          <Text style={styles.charCount}>{bio.length}/150 UNITS</Text>

          {/* ── ACTIONS ── */}
          <Button
            mode="contained"
            onPress={handleSave}
            loading={saving}
            disabled={saving || uploading}
            style={styles.button}
            labelStyle={styles.buttonLabel}
            icon="content-save-check"
          >
            COMMIT CHANGES
          </Button>

          <Button
            mode="text"
            onPress={() => router.back()}
            disabled={saving}
            textColor={THEME.error}
            style={{ marginTop: 8 }}
          >
            ABORT
          </Button>
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingHorizontal: 8,
    backgroundColor: THEME.bg,
  },
  headerTitle: {
    color: THEME.text,
    fontWeight: "900",
    letterSpacing: 2,
  },
  card: {
    margin: 20,
    padding: 24,
    borderRadius: 24,
    backgroundColor: THEME.surface,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  avatarWrapper: {
    position: "relative",
    marginTop: 10,
    marginBottom: 10,
  },
  avatarGlow: {
    borderRadius: 65,
    padding: 4,
    backgroundColor: THEME.bg,
    borderWidth: 2,
    borderColor: THEME.accent,
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  avatarImg: {
    backgroundColor: THEME.bg,
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: THEME.accent,
    borderRadius: 25,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  tapHint: {
    color: THEME.accent,
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
    marginBottom: 25,
  },
  form: {
    width: "100%",
  },
  input: {
    width: "100%",
    marginBottom: 16,
    backgroundColor: THEME.bg,
  },
  charCount: {
    textAlign: "right",
    color: THEME.muted,
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: -10,
    marginBottom: 20,
  },
  button: {
    width: "100%",
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: THEME.accent,
  },
  buttonLabel: {
    color: THEME.bg,
    fontWeight: "900",
    paddingVertical: 4,
  },
});
