import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import {
    Button,
    IconButton,
    Surface,
    Text,
    TextInput,
} from "react-native-paper";
import { createPost } from "../../services/postService";

// THEME COLORS (Consistent sa previous screens)
const THEME = {
  bg: "#0A0A0A",
  surface: "#1E293B",
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#E2E8F0",
  muted: "#94A3B8",
  error: "#FF4B4B",
  success: "#00FF94",
};

export default function CreatePostScreen() {
  const router = useRouter();

  const [content, setContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  // Pick image from gallery - LOGIC INTACT
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  // Remove selected image - LOGIC INTACT
  const handleRemoveImage = () => setImageUri(null);

  // Submit the post - LOGIC INTACT
  const handlePost = async () => {
    if (!content.trim() && !imageUri) {
      Alert.alert("Empty Post", "Please write something or attach an image.");
      return;
    }

    setPosting(true);
    try {
      await createPost(content.trim() || undefined, imageUri ?? undefined);
      Alert.alert("Posted! 🎉", "Your post has been shared.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/home") },
      ]);
    } catch {
      Alert.alert("Error", "Failed to create post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  const canPost = (content.trim().length > 0 || imageUri !== null) && !posting;

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <Surface style={styles.header} elevation={4}>
        <IconButton
          icon="close"
          iconColor={THEME.text}
          onPress={() => router.back()}
        />
        <Text variant="titleMedium" style={styles.headerTitle}>
          NEW <Text style={{ color: THEME.accent }}>BROADCAST</Text>
        </Text>
        <Button
          mode="contained"
          onPress={handlePost}
          loading={posting}
          disabled={!canPost}
          style={[styles.postBtn, canPost && { backgroundColor: THEME.accent }]}
          labelStyle={{ color: THEME.bg, fontWeight: "900" }}
          compact
        >
          POST
        </Button>
      </Surface>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <Surface style={styles.inputSection} elevation={1}>
          {/* ── TEXT INPUT ── */}
          <TextInput
            placeholder="What's on your mind, explorer?"
            placeholderTextColor={THEME.muted}
            value={content}
            onChangeText={setContent}
            mode="flat"
            multiline
            numberOfLines={8}
            maxLength={500}
            style={styles.textInput}
            textColor={THEME.text}
            underlineColor="transparent"
            activeUnderlineColor="transparent"
          />

          {/* Character count */}
          <Text
            style={[
              styles.charCount,
              content.length >= 500 && { color: THEME.error },
            ]}
          >
            {content.length}/500
          </Text>

          {/* ── SELECTED IMAGE PREVIEW ── */}
          {imageUri && (
            <View style={styles.imagePreviewContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
              <IconButton
                icon="close-circle"
                size={28}
                iconColor={THEME.error}
                style={styles.removeImageBtn}
                onPress={handleRemoveImage}
              />
            </View>
          )}
        </Surface>
      </ScrollView>

      {/* ── ATTACHMENT BAR (Floating at bottom) ── */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={100}
      >
        <Surface style={styles.footerBar} elevation={5}>
          <Text variant="bodySmall" style={styles.attachLabel}>
            ATTACH DATA:
          </Text>
          <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
            <IconButton icon="image-plus" size={24} iconColor={THEME.accent} />
            <Text style={styles.attachBtnText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.attachBtn, { marginLeft: 10 }]}
            onPress={() => {}} // Placeholder for camera logic if needed
          >
            <IconButton icon="camera" size={24} iconColor={THEME.muted} />
            <Text style={[styles.attachBtnText, { color: THEME.muted }]}>
              Camera
            </Text>
          </TouchableOpacity>
        </Surface>
      </KeyboardAvoidingView>
    </View>
  );
}

import { KeyboardAvoidingView } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 16,
    paddingTop: Platform.OS === "ios" ? 50 : 40,
    paddingBottom: 12,
    backgroundColor: THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 245, 255, 0.1)",
  },
  headerTitle: {
    flex: 1,
    fontWeight: "900",
    color: THEME.text,
    letterSpacing: 1.5,
    textAlign: "center",
    fontSize: 16,
  },
  postBtn: {
    borderRadius: 4,
    minWidth: 80,
  },
  inputSection: {
    margin: 16,
    borderRadius: 12,
    backgroundColor: THEME.surface,
    padding: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  textInput: {
    backgroundColor: "transparent",
    fontSize: 18,
    minHeight: 200,
    textAlignVertical: "top",
  },
  charCount: {
    textAlign: "right",
    paddingRight: 16,
    color: THEME.muted,
    fontSize: 12,
    marginBottom: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  imagePreviewContainer: {
    position: "relative",
    margin: 12,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0, 245, 255, 0.3)",
  },
  imagePreview: {
    width: "100%",
    height: 250,
  },
  removeImageBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  footerBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: THEME.surface,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 245, 255, 0.1)",
    paddingBottom: Platform.OS === "ios" ? 30 : 12,
  },
  attachLabel: {
    color: THEME.muted,
    marginRight: 12,
    fontWeight: "bold",
  },
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 245, 255, 0.05)",
    borderRadius: 8,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 245, 255, 0.1)",
  },
  attachBtnText: {
    color: THEME.accent,
    fontWeight: "bold",
    fontSize: 12,
  },
});
