
import React, { useEffect, useState } from 'react';
import {
    View, StyleSheet, ScrollView,
    Alert, TouchableOpacity
} from 'react-native';
import {
    TextInput, Button, Text,
    Surface, Avatar, ActivityIndicator
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
    getMyProfile, updateProfile,
    uploadProfilePicture, UserProfile
} from '../../services/userService';

const BASE_URL = 'http://192.168.1.105:5261';

export default function EditProfileScreen() {
    const router = useRouter();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [fullName, setFullName] = useState('');
    const [bio, setBio] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Load current profile data into form
    useEffect(() => {
        const load = async () => {
            try {
                const data = await getMyProfile();
                setProfile(data);
                setFullName(data.fullName ?? '');
                setBio(data.bio ?? '');
            } catch {
                Alert.alert('Error', 'Failed to load profile.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    // Save text changes (fullName, bio)
    const handleSave = async () => {
        setSaving(true);
        try {
            await updateProfile({ fullName, bio });
            Alert.alert('Success! ✅', 'Profile updated.', [
                { text: 'OK', onPress: () => router.back() },
            ]);
        } catch {
            Alert.alert('Error', 'Failed to update profile.');
        } finally {
            setSaving(false);
        }
    };

    // 2. I-update ang handlePickImage function
    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            // Subukan ang string literal na 'images'
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (result.canceled) return;

        // Kunin ang URI mula sa unang asset
        const imageUri = result.assets[0].uri;
        setUploading(true);

        try {
            const newUrl = await uploadProfilePicture(imageUri);

            // Agarang update sa UI gamit ang bagong URL mula sa server
            setProfile(prev => prev ? { ...prev, profilePictureUrl: newUrl } : prev);
            Alert.alert('Success! 🖼️', 'Profile picture updated!');
        } catch (err) {
            console.error("Upload Error:", err);
            Alert.alert('Error', 'Failed to upload picture.');
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    const avatarUri = profile?.profilePictureUrl
        ? `${BASE_URL}${profile.profilePictureUrl}`
        : null;
    const initials = fullName
        ? fullName.split(' ').map(n => n[0]).join('').toUpperCase()
        : profile?.username?.[0]?.toUpperCase() ?? '?';

    return (
        <ScrollView style={styles.container}>
            <Surface style={styles.card} elevation={2}>
                <Text variant="headlineSmall" style={styles.title}>Edit Profile</Text>

                {/* ── TAP TO CHANGE PROFILE PICTURE ── */}
                <TouchableOpacity
                    onPress={handlePickImage}
                    style={styles.avatarWrapper}
                    disabled={uploading}
                >
                    {avatarUri ? (
                        <Avatar.Image size={100} source={{ uri: avatarUri }} />
                    ) : (
                        <Avatar.Text size={100} label={initials} />
                    )}
                    {/* Overlay icon */}
                    <View style={styles.cameraOverlay}>
                        <Text style={styles.cameraIcon}>
                            {uploading ? '⏳' : '📷'}
                        </Text>
                    </View>
                </TouchableOpacity>

                <Text variant="bodySmall" style={styles.tapHint}>
                    Tap to change photo
                </Text>

                {/* ── USERNAME (read-only) ── */}
                <TextInput
                    label="Username"
                    value={profile?.username ?? ''}
                    mode="outlined"
                    style={styles.input}
                    disabled // Username cannot be changed
                    left={<TextInput.Icon icon="at" />}
                />

                {/* ── FULL NAME ── */}
                <TextInput
                    label="Full Name"
                    value={fullName}
                    onChangeText={setFullName}
                    mode="outlined"
                    style={styles.input}
                    left={<TextInput.Icon icon="account" />}
                />

                {/* ── BIO ── */}
                <TextInput
                    label="Bio"
                    value={bio}
                    onChangeText={setBio}
                    mode="outlined"
                    style={styles.input}
                    multiline
                    numberOfLines={3}
                    maxLength={150}         // Limit bio length
                    left={<TextInput.Icon icon="text" />}
                />
                <Text variant="bodySmall" style={styles.charCount}>
                    {bio.length}/150
                </Text>

                {/* ── SAVE BUTTON ── */}
                <Button
                    mode="contained"
                    onPress={handleSave}
                    loading={saving}
                    disabled={saving || uploading}
                    style={styles.button}
                    contentStyle={styles.buttonContent}
                    icon="content-save"
                >
                    Save Changes
                </Button>

                {/* ── CANCEL ── */}
                <Button
                    mode="text"
                    onPress={() => router.back()}
                    disabled={saving}
                >
                    Cancel
                </Button>
            </Surface>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    card: {
        margin: 16,
        padding: 24,
        borderRadius: 16,
        backgroundColor: 'white',
        alignItems: 'center',
    },
    title: {
        fontWeight: 'bold',
        color: '#1a1a2e',
        marginBottom: 20,
    },
    avatarWrapper: {
        position: 'relative',
        marginBottom: 4,
    },
    cameraOverlay: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 4,
        elevation: 2,
    },
    cameraIcon: {
        fontSize: 20,
    },
    tapHint: {
        color: '#888',
        marginBottom: 20,
    },
    input: {
        width: '100%',
        marginBottom: 12,
    },
    charCount: {
        alignSelf: 'flex-end',
        color: '#aaa',
        marginTop: -8,
        marginBottom: 12,
    },
    button: {
        width: '100%',
        borderRadius: 8,
        marginTop: 8,
        marginBottom: 8,
    },
    buttonContent: {
        paddingVertical: 6,
    },
});