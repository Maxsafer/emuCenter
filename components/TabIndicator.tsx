import { GameFilterMode } from '@/types';
import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

interface TabIndicatorProps {
    currentTab: GameFilterMode;
    tabs: { key: GameFilterMode; label: string }[];
}

export function TabIndicator({ currentTab, tabs, onTabSelect }: TabIndicatorProps & { onTabSelect: (tab: GameFilterMode) => void }) {
    const { width } = useWindowDimensions();

    // Dynamic Sizing
    // Scale minWidth from 80 (small) to 180 (desktop)
    const minTabWidth = Math.max(80, Math.min(180, width * 0.1));
    const tabFontSize = Math.max(12, Math.min(16, width * 0.01));
    const tabPaddingV = Math.max(8, Math.min(15, width * 0.01));

    return (
        <View style={styles.container}>
            {/* Left hint */}
            <View style={styles.hint}>
                <Text style={styles.hintText}>LB ◄</Text>
            </View>

            {/* Tab labels */}
            {tabs.map((tab) => {
                const isActive = tab.key === currentTab;
                return (
                    <Pressable
                        key={tab.key}
                        onPress={() => onTabSelect(tab.key)}
                        style={[
                            styles.tab,
                            isActive && styles.tabActive,
                            {
                                minWidth: minTabWidth,
                                paddingVertical: tabPaddingV
                            }
                        ]}
                    >
                        <Text style={[
                            styles.tabText,
                            isActive && styles.tabTextActive,
                            { fontSize: tabFontSize }
                        ]}>
                            {tab.label}
                        </Text>
                    </Pressable>
                );
            })}

            {/* Right hint */}
            <View style={styles.hint}>
                <Text style={styles.hintText}>► RB</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        // backgroundColor: 'rgba(15, 12, 41, 0.7)',
        // borderRadius: 22,
        // borderWidth: 1,
        // borderColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 10,
        paddingHorizontal: 14,
        gap: 8,
        // shadowColor: '#00FFFF',
        // shadowOffset: { width: 0, height: 0 },
        // shadowOpacity: 0.3,
        // shadowRadius: 15,
        elevation: 5,
    },
    hint: {
        // backgroundColor: 'rgba(255, 255, 255, 0.08)',
        // borderRadius: 18,
        // borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    hintText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '600',
    },
    tab: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 15,
        paddingHorizontal: 14,
        minWidth: 180,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        borderColor: 'rgba(0, 250, 255, 0.9)',
        shadowColor: '#00FFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 3,
    },
    tabText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.7)',
        fontWeight: '600',
    },
    tabTextActive: {
        color: '#00FAFF',
        fontWeight: '700',
    },
});
