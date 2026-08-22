import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface ConfirmExitModalProps {
    visible: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

/**
 * "Are you sure?" before quitting the packaged app. Console-style
 * bindings while open: A confirms, B cancels (handled by the input
 * layer in the home screen); both buttons are also clickable.
 */
export function ConfirmExitModal({ visible, onCancel, onConfirm }: ConfirmExitModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <Pressable style={styles.backdrop} onPress={onCancel} />
            <View style={styles.center} pointerEvents="box-none">
                <View style={styles.card}>
                    <Ionicons name="power" size={40} color="#F87171" />
                    <Text style={styles.title}>Exit EmuCenter?</Text>

                    <View style={styles.row}>
                        <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
                            <View style={[styles.hintBadge, styles.hintB]}>
                                <Text style={styles.hintText}>B</Text>
                            </View>
                            <Text style={styles.buttonText}>Cancel</Text>
                        </Pressable>

                        <Pressable style={[styles.button, styles.exitButton]} onPress={onConfirm}>
                            <View style={[styles.hintBadge, styles.hintA]}>
                                <Text style={styles.hintText}>A</Text>
                            </View>
                            <Text style={[styles.buttonText, styles.exitText]}>Exit</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
    },
    center: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        backgroundColor: '#1E293B',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingVertical: 28,
        paddingHorizontal: 36,
        alignItems: 'center',
        gap: 16,
        minWidth: 320,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#F8FAFC',
    },
    row: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
    },
    cancelButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    exitButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: 'rgba(239, 68, 68, 0.4)',
    },
    hintBadge: {
        width: 22,
        height: 22,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hintA: {
        backgroundColor: 'rgba(16, 185, 129, 0.9)',
    },
    hintB: {
        backgroundColor: 'rgba(239, 68, 68, 0.9)',
    },
    hintText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A',
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#F8FAFC',
    },
    exitText: {
        color: '#F87171',
    },
});
