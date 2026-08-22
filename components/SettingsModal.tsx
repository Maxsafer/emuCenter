import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Alert,
    Linking,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from 'react-native';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
    simplifiedUI: boolean;
    onToggleSimplifiedUI: (value: boolean) => void;
    sortBy: 'alphabetical' | 'emulator';
    onToggleSort: () => void;
    emulatorCount: number;
    gameCount: number;
    onManageEmulators: () => void;
    onSyncAll: () => Promise<{ totalAdded: number; totalUpdated: number }>;
    apiUrl: string;
}

export function SettingsModal({
    visible,
    onClose,
    simplifiedUI,
    onToggleSimplifiedUI,
    sortBy,
    onToggleSort,
    emulatorCount,
    gameCount,
    onManageEmulators,
    onSyncAll,
    apiUrl,
}: SettingsModalProps) {
    const [syncing, setSyncing] = React.useState(false);
    const [igdbClientId, setIgdbClientId] = React.useState('');
    const [igdbClientSecret, setIgdbClientSecret] = React.useState('');
    const [igdbExpanded, setIgdbExpanded] = React.useState(false);

    // Load IGDB config on open
    React.useEffect(() => {
        if (visible) {
            fetch(`${apiUrl}/config/igdb`)
                .then(res => res.json())
                .then(json => {
                    if (json.success && json.data) {
                        setIgdbClientId(json.data.clientId || '');
                        setIgdbClientSecret(json.data.clientSecret || '');
                    }
                })
                .catch(err => console.error('Failed to load IGDB config', err));
        }
    }, [visible, apiUrl]);

    const handleSaveIgdb = async () => {
        try {
            const response = await fetch(`${apiUrl}/config/igdb`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data: {
                        clientId: igdbClientId.trim(),
                        clientSecret: igdbClientSecret.trim()
                    }
                })
            });
            const result = await response.json();
            if (result.success) {
                Alert.alert('Success', 'IGDB credentials saved!');
            } else {
                Alert.alert('Error', 'Failed to save credentials.');
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to save credentials.');
        }
    };

    const handleSyncAll = async () => {
        setSyncing(true);
        await onSyncAll();
        setSyncing(false);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose} />

            <View style={styles.modal}>
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Settings</Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#94A3B8" />
                        </Pressable>
                    </View>

                    {/* Stats */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Library</Text>
                        <View style={styles.statsRow}>
                            <View style={styles.stat}>
                                <Ionicons name="game-controller" size={24} color="#3B82F6" />
                                <Text style={styles.statValue}>{gameCount}</Text>
                                <Text style={styles.statLabel}>Games</Text>
                            </View>
                            <View style={styles.stat}>
                                <Ionicons name="apps" size={24} color="#10B981" />
                                <Text style={styles.statValue}>{emulatorCount}</Text>
                                <Text style={styles.statLabel}>Emulators</Text>
                            </View>
                        </View>
                    </View>

                    {/* Emulator Management */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Emulators</Text>
                        <Pressable style={styles.button} onPress={onManageEmulators}>
                            <Ionicons name="add-circle-outline" size={20} color="#F8FAFC" />
                            <Text style={styles.buttonText}>Manage Emulators</Text>
                            <Ionicons name="chevron-forward" size={20} color="#64748B" />
                        </Pressable>

                        <Pressable
                            style={[styles.button, styles.syncButton, syncing && styles.syncButtonDisabled]}
                            onPress={handleSyncAll}
                            disabled={syncing}
                        >
                            <Ionicons name="sync" size={20} color="#10B981" />
                            <Text style={[styles.buttonText, styles.syncButtonText]}>
                                {syncing ? 'Syncing...' : 'Sync All Emulators'}
                            </Text>
                            {!syncing && <Ionicons name="chevron-forward" size={20} color="#64748B" />}
                        </Pressable>
                    </View>

                    {/* Display Settings */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Display</Text>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Sort by</Text>
                                <Text style={styles.settingDescription}>
                                    {sortBy === 'alphabetical' ? 'Alphabetical (A-Z)' : 'By Emulator'}
                                </Text>
                            </View>
                            <Pressable style={styles.sortButton} onPress={onToggleSort}>
                                <Ionicons name="swap-horizontal" size={20} color="#F8FAFC" />
                            </Pressable>
                        </View>

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Simplified UI</Text>
                                <Text style={styles.settingDescription}>
                                    Disable cover images for better performance
                                </Text>
                            </View>
                            <Switch
                                value={simplifiedUI}
                                onValueChange={onToggleSimplifiedUI}
                                trackColor={{ false: '#334155', true: '#3B82F6' }}
                                thumbColor={simplifiedUI ? '#F8FAFC' : '#94A3B8'}
                            />
                        </View>
                    </View>

                    {/* IGDB Configuration */}
                    <View style={styles.section}>
                        <Pressable
                            style={styles.collapsibleHeader}
                            onPress={() => setIgdbExpanded(!igdbExpanded)}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.sectionTitle}>IGDB Integration</Text>
                                <Text style={styles.settingDescription}>
                                    Required to automatically download game covers.
                                </Text>
                            </View>
                            <Ionicons
                                name={igdbExpanded ? "chevron-up" : "chevron-down"}
                                size={20}
                                color="#94A3B8"
                            />
                        </Pressable>

                        {igdbExpanded && (
                            <View style={styles.collapsibleContent}>
                                <Pressable
                                    onPress={() => Linking.openURL('https://api-docs.igdb.com/#getting-started')}
                                    style={{ marginBottom: 16, marginTop: 4 }}
                                >
                                    <Text style={styles.linkText}>
                                        Get your credentials here (IGDB Docs)
                                    </Text>
                                </Pressable>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Client ID</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={igdbClientId}
                                        onChangeText={setIgdbClientId}
                                        placeholder="Enter Client ID"
                                        placeholderTextColor="#64748B"
                                        secureTextEntry
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Client Secret</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={igdbClientSecret}
                                        onChangeText={setIgdbClientSecret}
                                        placeholder="Enter Client Secret"
                                        placeholderTextColor="#64748B"
                                        secureTextEntry
                                    />
                                </View>

                                <Pressable style={styles.saveButton} onPress={handleSaveIgdb}>
                                    <Text style={styles.saveButtonText}>Save Credentials</Text>
                                </Pressable>
                            </View>
                        )}
                    </View>

                    {/* About */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>About</Text>
                        <View style={styles.aboutBox}>
                            <Text style={styles.aboutTitle}>EmuCenter</Text>
                            <Text style={styles.aboutVersion}>Version 2.1.0</Text>
                            <Text style={styles.aboutDescription}>
                                A comprehensive game and emulator launcher
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modal: {
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        width: '85%',
        maxWidth: 400,
        backgroundColor: '#1E293B',
        padding: 24,
        borderLeftWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#F8FAFC',
    },
    closeButton: {
        padding: 4,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#94A3B8',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    collapsibleHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start', // Use flex-start to align with title (since description wrapper wraps)
        justifyContent: 'space-between',
    },
    collapsibleContent: {
        marginTop: 16,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    stat: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#F8FAFC',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 4,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 8,
    },
    syncButton: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    syncButtonDisabled: {
        opacity: 0.5,
    },
    syncButtonText: {
        color: '#10B981',
    },
    buttonText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#F8FAFC',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    settingInfo: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#F8FAFC',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 14,
        color: '#64748B',
    },
    sortButton: {
        padding: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
    },
    aboutBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    aboutTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#F8FAFC',
        marginBottom: 4,
    },
    aboutVersion: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3B82F6',
        marginBottom: 8,
    },
    aboutDescription: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
    },
    inputGroup: {
        marginBottom: 12,
        gap: 6,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    input: {
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        color: '#F8FAFC',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    linkText: {
        color: '#3B82F6',
        fontSize: 14,
        textDecorationLine: 'underline',
    },
    saveButton: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    saveButtonText: {
        color: '#60A5FA',
        fontWeight: '600',
        fontSize: 14,
    },
});
