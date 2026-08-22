import { DEFAULT_API_URL, Game } from '@/types';
import { getGameImageUrl } from '@/utils/imageMatching';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    Layout,
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';

interface GameCardProps {
    game: Game;
    onLaunch: (game: Game) => void;
    onToggleFavorite: (id: string) => void;
    simplifiedUI?: boolean;
    apiUrl?: string;
}

export function GameCard({ game, onLaunch, onToggleFavorite, simplifiedUI = false, apiUrl = DEFAULT_API_URL }: GameCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [imageError, setImageError] = useState(false);
    const scale = useSharedValue(1);
    const { width } = useWindowDimensions();

    // Dynamic font sizing
    // Base size 10, scales up with screen width (approx 12px at 1200px width, 16px at 1600px)
    const dynamicTitleSize = Math.max(10, Math.min(18, width * 0.01));
    const dynamicSubTextSize = Math.max(9, Math.min(14, width * 0.008));
    const dynamicLineHeight = dynamicTitleSize * 1.2;

    // Always try to load image dynamically from backend
    const imageUrl = getGameImageUrl(game.name, apiUrl);
    const showImage = !simplifiedUI && !imageError;

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.97, { damping: 15 });
        setIsHovered(true);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15 });
        setIsHovered(false);
    };

    const handleUpload = async (event: any) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        // Append non-file fields FIRST so multer can read them before the file
        formData.append('gameName', game.name);
        formData.append('image', file);

        try {
            const response = await fetch(`${apiUrl}/upload-image`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.success) {
                // Force image refresh by appending timestamp
                setImageError(false);
                // We might need a way to trigger a re-render of the image. 
                // Since getGameImageUrl returns a URL, we might need to force an update.
                // For now, let's just reload the window or rely on state update if we had the URL in state.
                // A simple way is to reload the page or trigger a parent refresh, but for this component:
                window.location.reload();
            } else {
                console.error('Upload failed:', data.error);
                alert('Upload failed: ' + data.error);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Upload error');
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete the custom image?')) return;

        try {
            const response = await fetch(`${apiUrl}/delete-image`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ gameName: game.name }),
            });

            const data = await response.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert('Delete failed: ' + data.message);
            }
        } catch (error) {
            console.error('Delete error:', error);
        }
    };

    const fileInputRef = useRef<HTMLInputElement>(null);

    const onUploadClick = (e: any) => {
        // Stop propagation immediately
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (Platform.OS === 'web' && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    return (
        <Animated.View
            entering={FadeIn.duration(400)}
            exiting={FadeOut}
            layout={Layout.springify()}
            style={[styles.container, animatedStyle]}
            // @ts-ignore - React Native Web supports mouse events
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Card Container */}
            <View
                style={styles.card}
            >
                {/* Background Layer */}
                {showImage ? (
                    <>
                        <Image
                            source={{ uri: imageUrl }}
                            style={styles.coverImage}
                            resizeMode="cover"
                            onError={() => setImageError(true)}
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
                            style={styles.gradient}
                        />
                    </>
                ) : (
                    <LinearGradient
                        colors={['#1E293B', '#334155', '#1E293B']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />
                )}

                {/* Main Launch Interaction Layer - Absolute Fill */}
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={() => onLaunch(game)}
                    onLongPress={() => onToggleFavorite(game.id)}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                />

                {/* Content Layer - Pointer events pass through to Launch layer unless intercepted */}
                <View style={styles.content} pointerEvents="box-none">
                    {/* Top Bar: Emulator Badge + Actions */}
                    <View style={styles.topBar} pointerEvents="box-none">
                        <View style={styles.emulatorBadge}>
                            <Text style={styles.emulatorText}>{game.emulator.toUpperCase()}</Text>
                        </View>

                        <View style={styles.actionsContainer} pointerEvents="box-none">
                            {/* Edit/Upload Button */}
                            {isHovered && !simplifiedUI && (
                                <>
                                    <Pressable
                                        onPress={onUploadClick}
                                        style={styles.actionButton}
                                    >
                                        <View style={styles.actionIconContainer}>
                                            <Ionicons name="create" size={14} color="#fff" />
                                        </View>
                                    </Pressable>

                                    <Pressable
                                        onPress={(e) => {
                                            e.stopPropagation();
                                            handleDelete();
                                        }}
                                        style={[styles.actionButton, { marginLeft: 6 }]}
                                    >
                                        <View style={[styles.actionIconContainer, { backgroundColor: 'rgba(239, 68, 68, 0.9)' }]}>
                                            <Ionicons name="trash" size={14} color="#fff" />
                                        </View>
                                    </Pressable>
                                </>
                            )}

                            {/* Clickable Favorite Button */}
                            <Pressable
                                onPress={(e) => {
                                    e.stopPropagation();
                                    onToggleFavorite(game.id);
                                }}
                                style={[styles.favoriteButton, { marginLeft: 6 }]}
                            >
                                {game.isFavorite ? (
                                    <LinearGradient
                                        colors={['#FFD700', '#FFA500']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.favoriteGradient}
                                    >
                                        <Ionicons name="star" size={16} color="#000" />
                                    </LinearGradient>
                                ) : (
                                    <View style={styles.favoriteEmpty}>
                                        <Ionicons name="star-outline" size={16} color="#94A3B8" />
                                    </View>
                                )}
                            </Pressable>
                        </View>
                    </View>

                    {/* Hidden File Input for Web */}
                    {Platform.OS === 'web' && (
                        <div style={{ display: 'none' }}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept="image/*"
                                onChange={handleUpload}
                                onClick={(e) => e.stopPropagation()} // Prevent input click from bubbling
                            />
                        </div>
                    )}

                    {/* Bottom: Game Title */}
                    <View style={styles.titleContainer} pointerEvents="none">
                        <Text
                            style={[
                                styles.gameTitle,
                                { fontSize: dynamicTitleSize, lineHeight: dynamicLineHeight }
                            ]}
                            numberOfLines={2}
                        >
                            {game.cleanName.toLowerCase().replace(/(?:^|[\s\-\_\.])\w/g, (match) => match.toUpperCase())}
                        </Text>
                        {game.playCount > 0 && (
                            <Text style={[styles.playCount, { fontSize: dynamicSubTextSize }]}>
                                {game.playCount} play{game.playCount !== 1 ? 's' : ''}
                            </Text>
                        )}
                    </View>
                </View>

                {/* Glow Effect Border */}
                <View style={[
                    styles.glowBorder,
                    game.isFavorite && styles.glowBorderFavorite,
                    isHovered && styles.glowBorderHover
                ]} pointerEvents="none" />
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '16.666%', // Keep 6 columns, just content scales
        padding: 6, // Was 4
    },
    card: {
        aspectRatio: 3 / 4,
        borderRadius: 16, // Was 12
        overflow: 'hidden',
        backgroundColor: '#0F172A',
        position: 'relative',
    },
    coverImage: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '60%', // Larger gradient for bigger text visibility
    },
    hoverOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    playIndicator: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
    },
    content: {
        flex: 1,
        padding: 12, // Was 8
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 10, // Ensure content is above launch pressable
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    emulatorBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 8, // Was 6
        paddingVertical: 4, // Was 3
        borderRadius: 8, // Was 6
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    emulatorText: {
        fontSize: 10, // Was 8
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 20, // Ensure actions are clickable
    },
    actionButton: {
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: 30, // Individual button z-index
        cursor: 'pointer', // Web cursor
    },
    actionIconContainer: {
        padding: 8, // Increased padding for larger touch target
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    favoriteIcon: {
        borderRadius: 8,
        overflow: 'hidden',
    },
    favoriteButton: {
        borderRadius: 8,
        overflow: 'hidden',
        zIndex: 30,
        cursor: 'pointer',
    },
    favoriteGradient: {
        padding: 7, // Increased padding
        borderRadius: 8,
    },
    favoriteEmpty: {
        padding: 7, // Increased padding
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    titleContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 10, // Was 8
        padding: 10, // Was 8
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    gameTitle: {
        fontSize: 10,
        fontWeight: '700',
        color: '#F8FAFC',
        lineHeight: 12,
        marginBottom: 1,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    playCount: {
        fontSize: 10, // Was 8
        fontWeight: '500',
        color: '#64748B',
        marginTop: 2,
    },
    glowBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        zIndex: 5, // Below content
    },
    glowBorderFavorite: {
        borderColor: 'rgba(255, 215, 0, 0.4)',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
    },
    glowBorderHover: {
        borderColor: 'rgba(59, 130, 246, 0.6)',
        borderWidth: 2.5, // Thicker hover
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 16,
    },
});
