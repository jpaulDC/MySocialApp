import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Button, Surface, Text, TextInput } from "react-native-paper";
import api from "../../services/api";

// ── THEME CONSTANTS ────────────────────────────────────────────────────
const THEME = {
  bg: "#000000",
  card: "#1A222E",
  primary: "#2563EB",
  accent: "#00F5FF",
  text: "#FFFFFF",
  muted: "#94A3B8",
};

export default function LoginScreen() {
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/login", { email, password });
      const { token } = response.data;

      if (token) {
        await AsyncStorage.setItem("token", token);
        router.replace("/");
      } else {
        Alert.alert("Login Failed", "No token received from server.");
      }
    } catch (error: any) {
      console.error(error);
      const msg =
        error.response?.data?.message || "Login failed. Check your connection.";
      Alert.alert("Login Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      bounces={false}
      keyboardShouldPersistTaps="handled" // Importante para sa mobile/web clicks
    >
      <View style={styles.wrapper}>
        <Surface style={styles.card} elevation={5}>
          {/* Neon Side Accent - Inilipat para hindi humarang */}
          <View style={styles.sideAccent} pointerEvents="none" />

          {/* Logo / Title */}
          <Text style={styles.logoEmoji}>🛡️</Text>
          <Text style={styles.title}>SOCIAL_METAS</Text>
          <Text style={styles.subtitle}>AUTHENTICATION_REQUIRED</Text>

          <View style={styles.form}>
            <TextInput
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              outlineColor={THEME.card}
              activeOutlineColor={THEME.accent}
              textColor={THEME.text}
              theme={{ colors: { onSurfaceVariant: THEME.muted } }}
              left={<TextInput.Icon icon="email" color={THEME.muted} />}
            />

            <TextInput
              label="Security Password"
              value={password}
              onChangeText={setPassword}
              mode="outlined"
              style={styles.input}
              secureTextEntry={!showPass}
              outlineColor={THEME.card}
              activeOutlineColor={THEME.accent}
              textColor={THEME.text}
              theme={{ colors: { onSurfaceVariant: THEME.muted } }}
              left={<TextInput.Icon icon="lock" color={THEME.muted} />}
              right={
                <TextInput.Icon
                  icon={showPass ? "eye-off" : "eye"}
                  color={THEME.accent}
                  onPress={() => setShowPass(!showPass)}
                />
              }
            />

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
              buttonColor={THEME.accent}
              textColor="#000"
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              {loading ? "INITIALIZING..." : "LOGIN_SECURELY"}
            </Button>

            <Button
              mode="text"
              onPress={() => router.replace("/register" as any)}
              textColor={THEME.muted}
              style={styles.registerBtn}
            >
              NEW_USER?{" "}
              <Text style={{ color: THEME.accent, fontWeight: "bold" }}>
                REGISTER_HERE
              </Text>
            </Button>
          </View>
        </Surface>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    backgroundColor: THEME.bg,
  },
  wrapper: {
    width: "100%",
    maxWidth: Platform.OS === "web" ? 450 : "100%", // Limit width sa PC para hindi stretch
    alignSelf: "center",
    padding: 24,
  },
  card: {
    padding: 30,
    borderRadius: 25,
    backgroundColor: THEME.card,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    zIndex: 1, // Siniguradong nasa taas ang card
  },
  sideAccent: {
    position: "absolute",
    left: 0,
    top: 40,
    bottom: 40,
    width: 4,
    backgroundColor: THEME.accent,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  logoEmoji: {
    fontSize: 50,
    textAlign: "center",
    marginBottom: 10,
  },
  title: {
    textAlign: "center",
    fontWeight: "900",
    color: THEME.text,
    fontSize: 24,
    letterSpacing: 3,
  },
  subtitle: {
    textAlign: "center",
    color: THEME.accent,
    fontSize: 10,
    fontWeight: "bold",
    letterSpacing: 1.5,
    marginBottom: 35,
    opacity: 0.8,
  },
  form: {
    width: "100%",
    zIndex: 10, // Siniguradong ang form contents ang nasa pinakataas
  },
  input: {
    marginBottom: 16,
    backgroundColor: "#0F172A",
  },
  button: {
    marginTop: 10,
    borderRadius: 12,
    height: 55,
    justifyContent: "center",
    elevation: 8,
  },
  buttonContent: {
    height: 55,
  },
  buttonLabel: {
    fontWeight: "900",
    letterSpacing: 1,
    fontSize: 15,
  },
  registerBtn: {
    marginTop: 15,
  },
});
