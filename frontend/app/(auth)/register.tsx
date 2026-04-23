import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import api from '../../services/api';

export default function RegisterScreen() {
    const router = useRouter();

    // Form state
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const handleRegister = async () => {
        // Basic validation
        if (!username || !email || !password) {
            Alert.alert('Error', 'Please fill in all required fields.');
            return;
        }

        setLoading(true);
        try {
            // Call the backend register API
            const response = await api.post('/auth/register', {
                username,
                email,
                password,
                fullName,
            });

            Alert.alert('Success! 🎉', response.data.message || 'Account created successfully.', [
                // FIXED ROUTE: Alisin ang (auth) sa path
                { text: 'Login Now', onPress: () => router.replace('/login' as any) },
            ]);
        } catch (error: any) {
            // Show error from server (e.g., duplicate email o username)
            const msg = error.response?.data?.message || 'Registration failed. Check your network.';
            Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Surface style={styles.card} elevation={4}>
                {/* Title */}
                <Text variant="headlineMedium" style={styles.title}>Create Account</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>Join SocialApp today!</Text>

                {/* Full Name */}
                <TextInput
                    label="Full Name (optional)"
                    value={fullName}
                    onChangeText={setFullName}
                    mode="outlined"
                    style={styles.input}
                    left={<TextInput.Icon icon="account" />}
                />

                {/* Username */}
                <TextInput
                    label="Username *"
                    value={username}
                    onChangeText={setUsername}
                    mode="outlined"
                    style={styles.input}
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="at" />}
                />

                {/* Email */}
                <TextInput
                    label="Email *"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="email" />}
                />

                {/* Password */}
                <TextInput
                    label="Password *"
                    value={password}
                    onChangeText={setPassword}
                    mode="outlined"
                    style={styles.input}
                    secureTextEntry={!showPass}
                    left={<TextInput.Icon icon="lock" />}
                    right={
                        <TextInput.Icon
                            icon={showPass ? 'eye-off' : 'eye'}
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
                    contentStyle={styles.buttonContent}
                >
                    Create Account
                </Button>

                {/* Link to Login - FIXED ROUTE */}
                <Button mode="text" onPress={() => router.replace('/login' as any)}>
                    Already have an account? Login
                </Button>
            </Surface>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f0f2f5',
    },
    card: {
        padding: 24,
        borderRadius: 16,
        backgroundColor: 'white',
    },
    title: {
        textAlign: 'center',
        fontWeight: 'bold',
        color: '#1a1a2e',
    },
    subtitle: {
        textAlign: 'center',
        color: '#666',
        marginBottom: 24,
    },
    input: {
        marginBottom: 12,
    },
    button: {
        marginTop: 8,
        marginBottom: 8,
        borderRadius: 8,
    },
    buttonContent: {
        paddingVertical: 6,
    },
});