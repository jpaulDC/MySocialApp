import React, { useState } from 'react';
import { View, StyleSheet, Alert, ScrollView } from 'react-native';
import { TextInput, Button, Text, Surface } from 'react-native-paper';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';

export default function LoginScreen() {
    const router = useRouter();

    // Form state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter your email and password.');
            return;
        }

        setLoading(true);
        try {
            // Siguraduhin na ang /auth/login ay tumutugma sa .NET Controller mo
            const response = await api.post('/auth/login', { email, password });
            const { token } = response.data;

            // I-save ang JWT token (Nilagyan ng check para sa AsyncStorage)
            if (token) {
                await AsyncStorage.setItem('token', token);
                // FIXED ROUTE: Dahil nasa (tabs) folder ang index, gamitin ang "/" o "/(tabs)"
                router.replace('/');
            } else {
                Alert.alert('Login Failed', 'No token received from server.');
            }

        } catch (error: any) {
            console.error(error);
            const msg = error.response?.data?.message || 'Login failed. Check your connection.';
            Alert.alert('Login Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Surface style={styles.card} elevation={4}>
                {/* Logo / Title */}
                <Text variant="displaySmall" style={styles.logo}>📱</Text>
                <Text variant="headlineMedium" style={styles.title}>Social Metas App</Text>
                <Text variant="bodyMedium" style={styles.subtitle}>Welcome back!</Text>

                {/* Email Input */}
                <TextInput
                    label="Email"
                    value={email}
                    onChangeText={setEmail}
                    mode="outlined"
                    style={styles.input}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    left={<TextInput.Icon icon="email" />}
                />

                {/* Password Input */}
                <TextInput
                    label="Password"
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

                {/* Login Button */}
                <Button
                    mode="contained"
                    onPress={handleLogin}
                    loading={loading}
                    disabled={loading}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                >
                    Login
                </Button>

                {/* FIXED ROUTE: Alisin ang (auth) sa path */}
                <Button mode="text" onPress={() => router.replace('/register' as any)}>
                    Dont have an account? Register
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
    logo: {
        textAlign: 'center',
        marginBottom: 4,
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