import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import {
    ActivityIndicator,
    Button,
    IconButton,
    Surface,
    Text,
    TextInput,
} from "react-native-paper";
import { uploadReel } from "../../services/reelService";

// ── THEME CONSTANTS ────────────────────────────────────────────────────
const THEME = {
  bg: "#000000",
  card: "#1A222E",
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#FFFFFF",
  muted: "#94A3B8",
};

export default function UploadReelScreen() {
  const router = useRouter();

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  // PICK VIDEO LOGIC (Unchanged)
  const handlePickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your media library.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 60,
      quality: 1,
    });

    if (!result.canceled) {
      setVideoUri(result.assets[0].uri);
    }
  };

  // UPLOAD LOGIC (Unchanged)
  const handleUpload = async () => {
    if (!videoUri) {
      Alert.alert("No video", "Please select a video first.");
      return;
    }

    setUploading(true);
    try {
      await uploadReel(videoUri, caption.trim() || undefined);
      Alert.alert("🎬 Reel Uploaded!", "Your reel has been posted.", [
        { text: "View Reels", onPress: () => router.replace("/(tabs)/reels") },
      ]);
    } catch {
      Alert.alert("Error", "Failed to upload reel. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── HEADER (Cyber Style) ── */}
      <Surface style={styles.header} elevation={4}>
        <IconButton
          icon="arrow-left"
          iconColor={THEME.text}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>UPLOAD_REEL</Text>
        <View style={{ width: 48 }} />
      </Surface>

      <View style={styles.body}>
        {/* ── VIDEO PICKER BOX (Consistent Box Style) ── */}
        <TouchableOpacity
          style={styles.videoPicker}
          onPress={handlePickVideo}
          disabled={uploading}
          activeOpacity={0.8}
        >
          <View style={styles.sideIndicator} />
          {videoUri ? (
            <Video
              source={{ uri: videoUri }}
              style={styles.videoPreview}
              resizeMode={ResizeMode.COVER}
              shouldPlay
              isLooping
              isMuted
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoPlaceholderIcon}>🎬</Text>
              <Text style={styles.videoPlaceholderText}>SELECT_VIDEO_FILE</Text>
              <Text style={styles.videoPlaceholderSub}>
                MP4, MOV • Max 60s • Max 100MB
              </Text>
            </View>
          )}

          {videoUri && (
            <View style={styles.changeVideoOverlay}>
              <Text style={styles.changeVideoText}>📷 RE-SELECT VIDEO</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── CAPTION INPUT BOX ── */}
        <View style={styles.inputWrapper}>
          <TextInput
            label="Add Caption (optional)"
            value={caption}
            onChangeText={setCaption}
            mode="outlined"
            multiline
            numberOfLines={3}
            maxLength={200}
            outlineColor={THEME.card}
            activeOutlineColor={THEME.accent}
            textColor={THEME.text}
            style={styles.captionInput}
            placeholder="Write something cool..."
            placeholderTextColor={THEME.muted}
            theme={{ colors: { onSurfaceVariant: THEME.muted } }}
          />
          <Text style={styles.charCount}>{caption.length}/200</Text>
        </View>

        {/* ── UPLOAD BUTTON (Neon Glow Style) ── */}
        <Button
          mode="contained"
          onPress={handleUpload}
          disabled={!videoUri || uploading}
          style={[styles.uploadBtn, !videoUri && { opacity: 0.5 }]}
          buttonColor={THEME.accent}
          textColor="#000"
          labelStyle={styles.uploadBtnLabel}
          icon="upload"
        >
          {uploading ? "UPLOADING..." : "POST_REEL"}
        </Button>

        {uploading && (
          <View style={styles.uploadingIndicator}>
            <ActivityIndicator size="large" color={THEME.accent} />
            <Text style={styles.uploadingText}>Syncing with server...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: THEME.bg,
    paddingTop: Platform.OS === "ios" ? 40 : 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1A222E",
  },
  headerTitle: {
    fontWeight: "bold",
    color: THEME.text,
    fontSize: 18,
    letterSpacing: 2,
  },
  body: {
    flex: 1,
    padding: 20,
  },
  videoPicker: {
    width: "100%",
    height: 350,
    borderRadius: 25,
    overflow: "hidden",
    backgroundColor: THEME.card,
    marginBottom: 20,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  sideIndicator: {
    position: "absolute",
    left: 0,
    top: 20,
    bottom: 20,
    width: 4,
    backgroundColor: THEME.accent,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    zIndex: 10,
  },
  videoPreview: {
    width: "100%",
    height: "100%",
  },
  videoPlaceholder: {
    alignItems: "center",
    padding: 24,
  },
  videoPlaceholderIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  videoPlaceholderText: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  videoPlaceholderSub: {
    color: THEME.muted,
    fontSize: 13,
    textAlign: "center",
  },
  changeVideoOverlay: {
    position: "absolute",
    bottom: 15,
    right: 15,
    backgroundColor: "rgba(0, 245, 255, 0.2)",
    borderWidth: 1,
    borderColor: THEME.accent,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  changeVideoText: {
    color: THEME.accent,
    fontWeight: "bold",
    fontSize: 12,
  },
  inputWrapper: {
    marginBottom: 10,
  },
  captionInput: {
    backgroundColor: THEME.card,
    fontSize: 15,
  },
  charCount: {
    textAlign: "right",
    color: THEME.muted,
    fontSize: 12,
    marginTop: 5,
    fontWeight: "bold",
  },
  uploadBtn: {
    borderRadius: 15,
    marginTop: 10,
    height: 55,
    justifyContent: "center",
    shadowColor: THEME.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  uploadBtnLabel: {
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  uploadingIndicator: {
    alignItems: "center",
    marginTop: 30,
    gap: 15,
  },
  uploadingText: {
    color: THEME.accent,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
});
