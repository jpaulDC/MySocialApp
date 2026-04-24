import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  ActivityIndicator,
  Avatar,
  Button,
  Chip,
  Divider,
  Surface,
  Text,
} from "react-native-paper";
import { getMyProfile, UserProfile } from "../../services/userService";

// Gamitin ang tamang IP at Port para sa Profile Pictures
const BASE_URL = "http://192.168.1.105:5261";

// THEME CONSTANTS (Para madaling i-adjust)
const COLORS = {
  background: "#0A0A0A",
  primary: "#2563EB",
  accent: "#00F5FF",
  secondary: "#1E293B",
  textMain: "#E2E8F0",
  textMuted: "#94A3B8",
};

export default function ProfileScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      const data = await getMyProfile();
      setProfile(data);
    } catch (error) {
      if (Platform.OS !== "web") {
        Alert.alert("Error", "Failed to load profile.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    const performLogout = async () => {
      await AsyncStorage.removeItem("token");
      if (Platform.OS === "web") {
        localStorage.removeItem("token");
      }
      router.replace("/(auth)/login");
    };

    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to logout?")) {
        await performLogout();
      }
    } else {
      Alert.alert("Logout", "Are you sure you want to logout?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: performLogout,
        },
      ]);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.accent }}>
          Loading profile...
        </Text>
      </View>
    );
  }

  const avatarUri = profile?.profilePictureUrl
    ? `${BASE_URL}${profile.profilePictureUrl}`
    : null;

  const initials = profile?.fullName
    ? profile.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : (profile?.username?.[0]?.toUpperCase() ?? "?");

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.accent}
          colors={[COLORS.accent]}
        />
      }
    >
      <Surface style={styles.header} elevation={4}>
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Avatar.Image
              size={100}
              source={{ uri: avatarUri }}
              style={styles.avatarBorder}
            />
          ) : (
            <Avatar.Text
              size={100}
              label={initials}
              style={{ backgroundColor: COLORS.primary }}
              labelStyle={{ color: COLORS.accent }}
            />
          )}
        </View>

        <Text variant="headlineSmall" style={styles.fullName}>
          {profile?.fullName ?? profile?.username}
        </Text>
        <Text variant="bodyMedium" style={styles.username}>
          @{profile?.username}
        </Text>

        {profile?.bio ? (
          <Text variant="bodyMedium" style={styles.bio}>
            {profile.bio}
          </Text>
        ) : (
          <Text variant="bodySmall" style={styles.noBio}>
            // system: no bio found
          </Text>
        )}

        <Chip
          icon="calendar"
          style={styles.chip}
          textStyle={{ color: COLORS.accent }}
        >
          Joined{" "}
          {profile?.createdAt
            ? new Date(profile.createdAt).toLocaleDateString()
            : "N/A"}
        </Chip>
      </Surface>

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="account-edit"
          onPress={() => router.push("/(tabs)/edit-profile")}
          style={[styles.actionBtn, { flex: 1, marginRight: 8 }]}
          buttonColor={COLORS.primary}
          textColor="white"
        >
          Edit Profile
        </Button>
        <Button
          mode="outlined"
          icon="logout"
          onPress={handleLogout}
          style={[styles.actionBtn, { flex: 1, borderColor: "#FF4B4B" }]}
          textColor="#FF4B4B"
        >
          Logout
        </Button>
      </View>

      <Divider style={styles.divider} />

      <Surface style={styles.statsRow} elevation={2}>
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNumber}>
            0
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            POSTS
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNumber}>
            0
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            FRIENDS
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNumber}>
            0
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            LIKES
          </Text>
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    padding: 24,
    margin: 16,
    borderRadius: 20,
    backgroundColor: COLORS.secondary,
    borderWidth: 1,
    borderColor: "rgba(0, 245, 255, 0.1)",
  },
  avatarContainer: {
    marginBottom: 12,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  avatarBorder: {
    borderWidth: 2,
    borderColor: COLORS.accent,
    backgroundColor: COLORS.background,
  },
  fullName: {
    fontWeight: "bold",
    color: COLORS.textMain,
    letterSpacing: 1,
  },
  username: {
    color: COLORS.accent,
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  bio: {
    textAlign: "center",
    color: COLORS.textMuted,
    marginVertical: 8,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  noBio: {
    color: "#4A5568",
    fontStyle: "italic",
    marginVertical: 8,
  },
  chip: {
    marginTop: 8,
    backgroundColor: "rgba(0, 245, 255, 0.05)",
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  actionBtn: {
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
  },
  divider: {
    marginVertical: 16,
    backgroundColor: "rgba(226, 232, 240, 0.1)",
    marginHorizontal: 20,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    backgroundColor: COLORS.secondary,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.05)",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontWeight: "bold",
    color: COLORS.textMain,
  },
  statLabel: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(226, 232, 240, 0.1)",
    height: "100%",
  },
});
