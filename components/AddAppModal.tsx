import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

interface AddAppModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (name: string, icon: string, command: string) => void;
}

// Backend API URL
const API_URL = 'http://localhost:3001';

export function AddAppModal({ visible, onClose, onAdd }: AddAppModalProps) {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('');
    const [command, setCommand] = useState('');

    const handleSubmit = () => {
        if (name.trim() && command.trim()) {
            onAdd(name.trim(), icon.trim(), command.trim());
            setName('');
            setIcon('');
            setCommand('');
            onClose();
        }
    };

    const handleBrowseFile = async () => {
        try {
            const response = await fetch(`${API_URL}/pick-file`, { method: 'POST' });
            const data = await response.json();

            if (data.success && data.path) {
                setCommand(data.path);
            }
        } catch (err) {
            console.error('File picker error:', err);
            alert('Failed to open file picker. Make sure the backend is running.');
        }
    };

    const isValid = name.trim() && command.trim();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <Pressable style={styles.backdrop} onPress={onClose} />

                <View style={styles.modal}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add Application</Text>
                        <Pressable onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#94A3B8" />
                        </Pressable>
                    </View>

                    <View style={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Name *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Visual Studio Code"
                                placeholderTextColor="#64748B"
                                value={name}
                                onChangeText={setName}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Icon URL (optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="https://example.com/icon.png"
                                placeholderTextColor="#64748B"
                                value={icon}
                                onChangeText={setIcon}
                                autoCapitalize="none"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Command / Path *</Text>
                            <View style={styles.inputWithButton}>
                                <TextInput
                                    style={[styles.input, styles.inputFlex]}
                                    placeholder="e.g., /Applications/VSCode.app"
                                    placeholderTextColor="#64748B"
                                    value={command}
                                    onChangeText={setCommand}
                                    autoCapitalize="none"
                                />
                                <Pressable style={styles.browseButton} onPress={handleBrowseFile}>
                                    <Ionicons name="folder-open" size={20} color="#60A5FA" />
                                </Pressable>
                            </View>
                            <Text style={styles.hint}>
                                Windows: C:\Program Files\app.exe{'\n'}
                                macOS: /Applications/App.app{'\n'}
                                Linux: /usr/bin/app or app-name
                            </Text>
                        </View>
                    </View>

                    <Pressable
                        style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
                        onPress={handleSubmit}
                        disabled={!isValid}
                    >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>Add App</Text>
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modal: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#1E293B',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#F8FAFC',
    },
    closeButton: {
        padding: 4,
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
    },
    input: {
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#F8FAFC',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputWithButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    inputFlex: {
        flex: 1,
    },
    browseButton: {
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    hint: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 18,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#3B82F6',
        borderRadius: 12,
        padding: 16,
        marginTop: 24,
    },
    submitButtonDisabled: {
        backgroundColor: '#1E3A5F',
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});
