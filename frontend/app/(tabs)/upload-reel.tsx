import React, { useState } from 'react';
import {
    View, StyleSheet, Alert,
    TouchableOpacity
} from 'react-native';
import {
    Text, TextInput, Button,
    Surface, IconButton, ActivityIndicator
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { uploadReel } from '../../services/reelService';

export default function UploadReelScreen() {
    const router = useRouter();

    const [videoUri, setVideoUri] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [uploading, setUploading] = useState(false);

    // Pick video from gallery
    const handlePickVideo = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your media library.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            videoMaxDuration: 60,   // Max 60 seconds
            quality: 1,
        });

        if (!result.canceled) {
            setVideoUri(result.assets[0].uri);
        }
    };

    // Upload the reel
    const handleUpload = async () => {
        if (!videoUri) {
            Alert.alert('No video', 'Please select a video first.');
            return;
        }

        setUploading(true);
        try {
            await uploadReel(videoUri, caption.trim() || undefined);
            Alert.alert('🎬 Reel Uploaded!', 'Your reel has been posted.', [
                { text: 'View Reels', onPress: () => router.replace('/(tabs)/reels') }
            ]);
        } catch {
            Alert.alert('Error', 'Failed to upload reel. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <View style={styles.container}>

            {/* ── HEADER ── */}
            <Surface style={styles.header} elevation={2}>
                <IconButton icon="arrow-left" onPress={() => router.back()} />
                <Text variant="titleLarge" style={styles.headerTitle}>
                    Upload Reel
                </Text>
                <View style={{ width: 48 }} />
            </Surface>

            <View style={styles.body}>

                {/* ── VIDEO PICKER / PREVIEW ── */}
                <TouchableOpacity
                    style={styles.videoPicker}
                    onPress={handlePickVideo}
                    disabled={uploading}
                >
                    {videoUri ? (
                        // Preview the selected video
                        <Video
                            source={{ uri: videoUri }}
                            style={styles.videoPreview}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay
                            isLooping
                            isMuted
                        />
                    ) : (
                        // Placeholder
                        <View style={styles.videoPlaceholder}>
                            <Text style={styles.videoPlaceholderIcon}>🎬</Text>
                            <Text style={styles.videoPlaceholderText}>
                                Tap to select a video
                            </Text>
                            <Text style={styles.videoPlaceholderSub}>
                                MP4, MOV · Max 60 seconds · Max 100MB
                            </Text>
                        </View>
                    )}

                    {/* Change video overlay if already selected */}
                    {videoUri && (
                        <View style={styles.changeVideoOverlay}>
                            <Text style={styles.changeVideoText}>📷 Change Video</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {/* ── CAPTION INPUT ── */}
                <TextInput
                    label="Caption (optional)"
                    value={caption}
                    onChangeText={setCaption}
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    maxLength={200}
                    style={styles.captionInput}
                    placeholder="Write a caption..."
                    left={<TextInput.Icon icon="text" />}
                />
                <Text style={styles.charCount}>{caption.length}/200</Text>

                {/* ── UPLOAD BUTTON ── */}
                <Button
                    mode="contained"
                    onPress={handleUpload}
                    disabled={!videoUri || uploading}
                    style={styles.uploadBtn}
                    contentStyle={styles.uploadBtnContent}
                    icon="upload"
                >
                    {uploading ? 'Uploading...' : 'Post Reel'}
                </Button>

                {uploading && (
                    <View style={styles.uploadingIndicator}>
                        <ActivityIndicator size="large" />
                        <Text style={styles.uploadingText}>
                            Uploading your reel...
                        </Text>
                    </View>
                )}

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        paddingVertical: 4,
    },
    headerTitle: {
        fontWeight: 'bold',
        color: '#1a1a2e',
    },
    body: {
        flex: 1,
        padding: 16,
    },
    videoPicker: {
        width: '100%',
        height: 320,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: '#1a1a2e',
        marginBottom: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoPreview: {
        width: '100%',
        height: '100%',
    },
    videoPlaceholder: {
        alignItems: 'center',
        padding: 24,
    },
    videoPlaceholderIcon: {
        fontSize: 56,
        marginBottom: 12,
    },
    videoPlaceholderText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    videoPlaceholderSub: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 13,
        textAlign: 'center',
    },
    changeVideoOverlay: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    changeVideoText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 13,
    },
    captionInput: {
        backgroundColor: 'white',
        marginBottom: 4,
    },
    charCount: {
        textAlign: 'right',
        color: '#aaa',
        fontSize: 12,
        marginBottom: 16,
    },
    uploadBtn: {
        borderRadius: 12,
    },
    uploadBtnContent: {
        paddingVertical: 8,
    },
    uploadingIndicator: {
        alignItems: 'center',
        marginTop: 24,
        gap: 12,
    },
    uploadingText: {
        color: '#666',
        fontSize: 15,
    },
});