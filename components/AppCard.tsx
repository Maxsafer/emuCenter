import { App } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

interface AppCardProps {
    app: App;
    onLaunch: (app: App) => void;
    onRemove: (id: string) => void;
}

export function AppCard({ app, onLaunch, onRemove }: AppCardProps) {
    const hasValidIcon = app.icon && app.icon.startsWith('http');

    return (
        <Animated.View
            entering={FadeIn}
            exiting={FadeOut}
            layout={Layout.springify()}
            style={styles.container}
        >
            <Pressable
                style={({ pressed }) => [
                    styles.card,
                    pressed && styles.cardPressed,
                ]}
                onPress={() => onLaunch(app)}
                onLongPress={() => onRemove(app.id)}
            >
                <View style={styles.iconContainer}>
                    {hasValidIcon ? (
                        <Image source={{ uri: app.icon }} style={styles.icon} />
                    ) : (
                        <View style={styles.placeholderIcon}>
                            <Ionicons name="apps" size={32} color="#64748B" />
                        </View>
                    )}
                </View>
                <Text style={styles.name} numberOfLines={2}>
                    {app.name}
                </Text>
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '33.33%',
        padding: 8,
    },
    card: {
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    cardPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        transform: [{ scale: 0.95 }],
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 12,
    },
    icon: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    placeholderIcon: {
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
    },
    name: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F8FAFC',
        textAlign: 'center',
    },
});
