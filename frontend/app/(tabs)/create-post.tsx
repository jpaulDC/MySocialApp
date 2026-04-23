import React, { useState } from 'react';
import {
    View, StyleSheet, ScrollView,
    Alert, Image, TouchableOpacity
} from 'react-native';
import {
    Text, TextInput, Button,
    Surface, IconButton
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createPost } from '../../services/postService';

export default function CreatePostScreen() {
    const router = useRouter();

    const [content, setContent] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [posting, setPosting] = useState(false);

    // Pick image from gallery
    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please allow access to your photo library.');
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

    // Remove selected image
    const handleRemoveImage = () => setImageUri(null);

    // Submit the post
    const handlePost = async () => {
        if (!content.trim() && !imageUri) {
            Alert.alert('Empty Post', 'Please write something or attach an image.');
            return;
        }

        setPosting(true);
        try {
            await createPost(content.trim() || undefined, imageUri ?? undefined);
            Alert.alert('Posted! 🎉', 'Your post has been shared.', [
                // Go back to feed after posting
                { text: 'OK', onPress: () => router.replace('/(tabs)/home') }
            ]);
        } catch {
            Alert.alert('Error', 'Failed to create post. Please try again.');
        } finally {
            setPosting(false);
        }
    };

    const canPost = (content.trim().length > 0 || imageUri !== null) && !posting;

    return (
        <ScrollView style={styles.container}>
            <Surface style={styles.card} elevation={2}>

                {/* ── HEADER ── */}
                <View style={styles.header}>
                    <IconButton
                        icon="arrow-left"
                        onPress={() => router.back()}
                    />
                    <Text variant="titleLarge" style={styles.title}>
                        Create Post
                    </Text>
                    {/* Post button in header */}
                    <Button
                        mode="contained"
                        onPress={handlePost}
                        loading={posting}
                        disabled={!canPost}
                        style={styles.postBtn}
                        compact
                    >
                        Post
                    </Button>
                </View>

                {/* ── TEXT INPUT ── */}
                <TextInput
                    placeholder="What's on your mind?"
                    value={content}
                    onChangeText={setContent}
                    mode="flat"
                    multiline
                    numberOfLines={6}
                    maxLength={500}
                    style={styles.textInput}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                />

                {/* Character count */}
                <Text style={styles.charCount}>{content.length}/500</Text>

                {/* ── SELECTED IMAGE PREVIEW ── */}
                {imageUri && (
                    <View style={styles.imagePreviewContainer}>
                        <Image
                            source={{ uri: imageUri }}
                            style={styles.imagePreview}
                            resizeMode="cover"
                        />
                        {/* Remove image button */}
                        <IconButton
                            icon="close-circle"
                            size={28}
                            iconColor="white"
                            style={styles.removeImageBtn}
                            onPress={handleRemoveImage}
                        />
                    </View>
                )}

                {/* ── ATTACHMENT OPTIONS ── */}
                <View style={styles.attachments}>
                    <Text variant="bodySmall" style={styles.attachLabel}>Add to post:</Text>
                    <TouchableOpacity
                        style={styles.attachBtn}
                        onPress={handlePickImage}
                    >
                        <IconButton icon="image" size={24} iconColor="#4CAF50" />
                        <Text style={styles.attachBtnText}>Photo</Text>
                    </TouchableOpacity>
                </View>

            </Surface>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    card: {
        margin: 12,
        borderRadius: 16,
        backgroundColor: 'white',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    title: {
        flex: 1,
        fontWeight: 'bold',
        color: '#1a1a2e',
    },
    postBtn: {
        borderRadius: 8,
    },
    textInput: {
        backgroundColor: 'white',
        fontSize: 16,
        minHeight: 140,
        paddingHorizontal: 16,
        paddingTop: 12,
        textAlignVertical: 'top',
    },
    charCount: {
        textAlign: 'right',
        paddingRight: 16,
        color: '#aaa',
        fontSize: 12,
        marginBottom: 8,
    },
    imagePreviewContainer: {
        position: 'relative',
        marginHorizontal: 12,
        marginBottom: 12,
    },
    imagePreview: {
        width: '100%',
        height: 220,
        borderRadius: 12,
    },
    removeImageBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    attachments: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
    },
    attachLabel: {
        color: '#888',
        marginRight: 8,
    },
    attachBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f0f9f0',
        borderRadius: 20,
        paddingRight: 12,
    },
    attachBtnText: {
        color: '#4CAF50',
        fontWeight: '600',
    },
});