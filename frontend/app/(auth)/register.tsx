import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
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

export default function RegisterScreen() {
  const router = useRouter();

  // Form state (Logic Intact)
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleRegister = async () => {
    if (!username || !email || !password) {
      Alert.alert("Error", "Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post("/auth/register", {
        username,
        email,
        password,
        fullName,
      });

      Alert.alert(
        "Success! 🎉",
        response.data.message || "Account created successfully.",
        [{ text: "Login Now", onPress: () => router.replace("/login" as any) }],
      );
    } catch (error: any) {
      const msg =
        error.response?.data?.message ||
        "Registration failed. Check your network.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} bounces={false}>
      <Surface style={styles.card} elevation={5}>
        {/* Neon Side Accent */}
        <View style={styles.sideAccent} />

        {/* Title Section */}
        <Text style={styles.title}>NEW_ACCOUNT</Text>
        <Text style={styles.subtitle}>JOIN_THE_METAS</Text>

        <View style={styles.form}>
          {/* Full Name */}
          <TextInput
            label="Full Name (optional)"
            value={fullName}
            onChangeText={setFullName}
            mode="outlined"
            style={styles.input}
            outlineColor={THEME.card}
            activeOutlineColor={THEME.accent}
            textColor={THEME.text}
            theme={{ colors: { onSurfaceVariant: THEME.muted } }}
            left={<TextInput.Icon icon="account" color={THEME.muted} />}
          />

          {/* Username */}
          <TextInput
            label="Username *"
            value={username}
            onChangeText={setUsername}
            mode="outlined"
            style={styles.input}
            autoCapitalize="none"
            outlineColor={THEME.card}
            activeOutlineColor={THEME.accent}
            textColor={THEME.text}
            theme={{ colors: { onSurfaceVariant: THEME.muted } }}
            left={<TextInput.Icon icon="at" color={THEME.muted} />}
          />

          {/* Email */}
          <TextInput
            label="Email Address *"
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

          {/* Password */}
          <TextInput
            label="Security Password *"
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

          {/* Register Button */}
          <Button
            mode="contained"
            onPress={handleRegister}
            loading={loading}
            disabled={loading}
            style={styles.button}
            buttonColor={THEME.accent}
            textColor="#000"
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            {loading ? "PROCESSING..." : "INITIALIZE_ACCOUNT"}
          </Button>

          <Button
            mode="text"
            onPress={() => router.replace("/login" as any)}
            textColor={THEME.muted}
            style={styles.loginBtn}
          >
            ALREADY_REGISTERED?{" "}
            <Text style={{ color: THEME.accent, fontWeight: "bold" }}>
              LOGIN_NOW
            </Text>
          </Button>
        </View>
      </Surface>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: THEME.bg,
  },
  card: {
    padding: 30,
    borderRadius: 25,
    backgroundColor: THEME.card,
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
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
  loginBtn: {
    marginTop: 15,
  },
});
