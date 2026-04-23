import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
    const segments = useSegments();
    const router = useRouter();

    useEffect(() => {
        const checkAuth = async () => {
            // Kunin ang token mula sa storage
            const token = await AsyncStorage.getItem('token');

            // I-check kung nasa loob tayo ng (auth) folder
            const inAuthGroup = segments[0] === '(auth)';

            if (!token && !inAuthGroup) {
                // 1. Kapag WALANG token at WALA sa login/register, itapon sa Login
                router.replace('/login' as any);
            } else if (token && inAuthGroup) {
                // 2. Kapag MAY token at nasa login/register pa rin, itapon sa Home
                router.replace('/');
            }
        };

        checkAuth();
    }, [segments]); // Tatakbo ito tuwing magbabago ang screen

    return (
        <PaperProvider>
            <Stack screenOptions={{ headerShown: false }}>
                {/* Dito naka-lista ang mga folder groups mo */}
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
            </Stack>
        </PaperProvider>
    );
}