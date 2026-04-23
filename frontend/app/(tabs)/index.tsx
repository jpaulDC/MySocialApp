import React from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Card, Avatar, Button, IconButton } from 'react-native-paper';

export default function HomeScreen() {
    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text variant="headlineMedium" style={styles.title}>Social Feed</Text>
                <IconButton icon="bell-outline" size={24} onPress={() => { }} />
            </View>

            {/* Sample Post 1 */}
            <Card style={styles.card}>
                <Card.Title
                    title="Elvin"
                    subtitle="Just now"
                    left={(props) => <Avatar.Text {...props} label="E" />}
                    right={(props) => <IconButton {...props} icon="dots-vertical" onPress={() => { }} />}
                />
                <Card.Content>
                    <Text variant="bodyLarge">
                        Setting up my modern Social Media app for my thesis! 🚀 #CodingLife #ReactNativeeey
                    </Text>
                </Card.Content>
                <Card.Actions>
                    <Button icon="heart-outline">Like</Button>
                    <Button icon="comment-outline">Comment</Button>
                    <Button icon="share-variant">Share</Button>
                </Card.Actions>
            </Card>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        paddingTop: 50,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    title: {
        fontWeight: 'bold',
        color: '#1a1a1a',
    },
    card: {
        marginHorizontal: 15,
        marginBottom: 15,
        borderRadius: 15,
        backgroundColor: '#ffffff',
    },
});