import { Emulator } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

interface ManageEmulatorsModalProps {
    visible: boolean;
    onClose: () => void;
    emulators: Emulator[];
    onRemove: (id: string) => void;
    onAdd: () => void;
    onScanGames: (emulator: Emulator) => void;
    onEdit: (emulator: Emulator) => void;
}

export function ManageEmulatorsModal({
    visible,
    onClose,
    emulators,
    onRemove,
    onAdd,
    onScanGames,
    onEdit,
}: ManageEmulatorsModalProps) {
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
                        <Text style={styles.title}>Manage Emulators</Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#94A3B8" />
                        </Pressable>
                    </View>

                    {/* Add Emulator Button */}
                    <Pressable style={styles.addButton} onPress={onAdd}>
                        <Ionicons name="add-circle" size={24} color="#3B82F6" />
                        <Text style={styles.addButtonText}>Add New Emulator</Text>
                    </Pressable>

                    {/* Emulator List */}
                    {emulators.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Ionicons name="apps-outline" size={48} color="#334155" />
                            <Text style={styles.emptyText}>No emulators configured</Text>
                            <Text style={styles.emptySubtext}>
                                Add an emulator to start discovering games
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.list}>
                            {emulators.map((emulator) => (
                                <View key={emulator.id} style={styles.emulatorCard}>
                                    <View style={styles.emulatorInfo}>
                                        <Text style={styles.emulatorName}>{emulator.displayName}</Text>
                                        <Text style={styles.emulatorPath} numberOfLines={1}>
                                            {emulator.exePath}
                                        </Text>
                                        <Text style={styles.emulatorGamesPath} numberOfLines={1}>
                                            Games: {emulator.gamesPaths?.join(', ') || emulator.gamesPath}
                                        </Text>
                                    </View>

                                    <View style={styles.actions}>
                                        <Pressable
                                            style={styles.actionButton}
                                            onPress={() => onEdit(emulator)}
                                        >
                                            <Ionicons name="create-outline" size={20} color="#3B82F6" />
                                            <Text style={styles.actionText}>Edit</Text>
                                        </Pressable>

                                        <Pressable
                                            style={styles.actionButton}
                                            onPress={() => onScanGames(emulator)}
                                        >
                                            <Ionicons name="refresh" size={20} color="#3B82F6" />
                                            <Text style={styles.actionText}>Scan</Text>
                                        </Pressable>

                                        <Pressable
                                            style={[styles.actionButton, styles.deleteButton]}
                                            onPress={() => onRemove(emulator.id)}
                                        >
                                            <Ionicons name="trash" size={20} color="#EF4444" />
                                            <Text style={[styles.actionText, styles.deleteText]}>Remove</Text>
                                        </Pressable>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
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
        maxWidth: 500,
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
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
        marginBottom: 24,
    },
    addButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#3B82F6',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#F8FAFC',
    },
    emptySubtext: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    list: {
        gap: 12,
    },
    emulatorCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    emulatorInfo: {
        marginBottom: 12,
    },
    emulatorName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F8FAFC',
        marginBottom: 6,
    },
    emulatorPath: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 2,
    },
    emulatorGamesPath: {
        fontSize: 12,
        color: '#64748B',
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    deleteButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    actionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#3B82F6',
    },
    deleteText: {
        color: '#EF4444',
    },
});
