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
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Loading profile...</Text>
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
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Surface style={styles.header} elevation={2}>
        <View style={styles.avatarContainer}>
          {avatarUri ? (
            <Avatar.Image size={100} source={{ uri: avatarUri }} />
          ) : (
            <Avatar.Text size={100} label={initials} />
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
            No bio yet.
          </Text>
        )}

        <Chip icon="calendar" style={styles.chip}>
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
        >
          Edit Profile
        </Button>
        <Button
          mode="outlined"
          icon="logout"
          onPress={handleLogout}
          style={[styles.actionBtn, { flex: 1 }]}
          textColor="red"
        >
          Logout
        </Button>
      </View>

      <Divider style={{ marginVertical: 16 }} />

      <Surface style={styles.statsRow} elevation={1}>
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNumber}>
            0
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Posts
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNumber}>
            0
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Friends
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text variant="titleLarge" style={styles.statNumber}>
            0
          </Text>
          <Text variant="bodySmall" style={styles.statLabel}>
            Likes
          </Text>
        </View>
      </Surface>
    </ScrollView>
  );
}

// ── DITO NAGKA-RED LINE DAHIL NAWALA ITONG PART NA ITO ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f2f5",
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
    borderRadius: 16,
    backgroundColor: "white",
  },
  avatarContainer: {
    marginBottom: 12,
  },
  fullName: {
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  username: {
    color: "#666",
    marginBottom: 8,
  },
  bio: {
    textAlign: "center",
    color: "#444",
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  noBio: {
    color: "#aaa",
    fontStyle: "italic",
    marginVertical: 8,
  },
  chip: {
    marginTop: 8,
    backgroundColor: "#e8f4ff",
  },
  actions: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  actionBtn: {
    borderRadius: 8,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "white",
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontWeight: "bold",
    color: "#1a1a2e",
  },
  statLabel: {
    color: "#888",
  },
  statDivider: {
    width: 1,
    backgroundColor: "#eee",
  },
});
