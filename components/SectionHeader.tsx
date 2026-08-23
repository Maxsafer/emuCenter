import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface SectionHeaderProps {
    title: string;
    count?: number;
    icon?: keyof typeof Ionicons.glyphMap;
    /** Emulator icon image URL - preferred over `icon` when it loads */
    iconUri?: string;
    /** When provided, the header is pressable and shows a collapse chevron */
    onToggle?: () => void;
    collapsed?: boolean;
}

export function SectionHeader({ title, count, icon, iconUri, onToggle, collapsed = false }: SectionHeaderProps) {
    const { width } = useWindowDimensions();
    const scale = Math.min(1.5, Math.max(1, width / 1200)); // Base scale on 1200px width

    const titleSize = 16 * scale; // Base 16
    const iconSize = 24 * scale;
    const countSize = 11 * scale;
    const imageSize = 30 * scale;

    const [imageFailed, setImageFailed] = React.useState(false);
    React.useEffect(() => {
        setImageFailed(false);
    }, [iconUri]);

    const showImage = !!iconUri && !imageFailed;

    return (
        <Pressable style={styles.container} onPress={onToggle} disabled={!onToggle}>
            <View style={styles.content}>
                {showImage && (
                    <Image
                        source={{ uri: iconUri }}
                        style={[styles.iconImage, { width: imageSize, height: imageSize }]}
                        resizeMode="contain"
                        onError={() => setImageFailed(true)}
                    />
                )}
                {!showImage && icon && <Ionicons name={icon} size={iconSize} color="#60A5FA" style={styles.icon} />}
                <Text style={[styles.title, { fontSize: titleSize }]}>{title}</Text>
                {count !== undefined && (
                    <View style={styles.badge}>
                        <Text style={[styles.count, { fontSize: countSize }]}>{count}</Text>
                    </View>
                )}
                {onToggle && (
                    <Ionicons
                        name={collapsed ? 'chevron-forward' : 'chevron-down'}
                        size={iconSize * 0.8}
                        color="#64748B"
                        style={styles.chevron}
                    />
                )}
            </View>
            <View style={styles.line} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingHorizontal: 20, // Was 16
        paddingTop: 32, // Was 24
        paddingBottom: 16, // Was 12
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16, // Was 12
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12, // Was 8
    },
    icon: {
        opacity: 0.9,
        // Size is controlled by props, make sure to update call site or default if needed
    },
    iconImage: {
        opacity: 0.95,
    },
    chevron: {
        marginLeft: 4,
        opacity: 0.9,
    },
    title: {
        fontSize: 22, // Was 16
        fontWeight: '700',
        color: '#F8FAFC',
        letterSpacing: 0.5,
    },
    badge: {
        backgroundColor: 'rgba(96, 165, 250, 0.2)',
        paddingHorizontal: 10, // Was 8
        paddingVertical: 4, // Was 2
        borderRadius: 10, // Was 8
        borderWidth: 1,
        borderColor: 'rgba(96, 165, 250, 0.3)',
    },
    count: {
        fontSize: 14, // Was 11
        fontWeight: '700',
        color: '#60A5FA',
    },
    line: {
        flex: 1,
        height: 1, // Maybe 2px looks better scaled?
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
});
