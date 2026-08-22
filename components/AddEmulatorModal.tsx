import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { DEFAULT_API_URL, Emulator } from '../types';

interface AddEmulatorModalProps {
    visible: boolean;
    onClose: () => void;
    onAdd: (
        name: string,
        displayName: string,
        exePath: string,
        gamesPaths: string[],
        template: string,
        excludedExtensions: string[]
    ) => Promise<void>;
    onScan: (emulator: Emulator) => Promise<any>;
    initialData?: Emulator | null;
}

const API_URL = DEFAULT_API_URL;

export function AddEmulatorModal({ visible, onClose, onAdd, onScan, initialData }: AddEmulatorModalProps) {
    const [name, setName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [exePath, setExePath] = useState('');
    const [gamesPaths, setGamesPaths] = useState<string[]>(['']); // Array of paths
    const [template, setTemplate] = useState('exepath game');
    const [excludedExt, setExcludedExt] = useState('.bin,.sav,.txt,.srm,.DS_Store');

    // Populate form when initialData changes (Edit Mode)
    React.useEffect(() => {
        if (initialData) {
            setName(initialData.name);
            setDisplayName(initialData.displayName);
            setExePath(initialData.exePath);
            // Handle legacy single path vs new array
            setGamesPaths(initialData.gamesPaths?.length ? initialData.gamesPaths : [initialData.gamesPath || '']);
            setTemplate(initialData.template);
            setExcludedExt(initialData.excludedExtensions.join(','));
        } else {
            // Reset for Add Mode
            setName('');
            setDisplayName('');
            setExePath('');
            setGamesPaths(['']);
            setTemplate('exepath game');
            setExcludedExt('.bin,.sav,.txt,.srm,.DS_Store');
        }
    }, [initialData, visible]);

    const handleBrowseFile = async () => {
        try {
            const response = await fetch(`${API_URL}/pick-file`, { method: 'POST' });
            const data = await response.json();

            if (data.success && data.path) {
                setExePath(data.path);
            }
        } catch (err) {
            console.error('File picker error:', err);
            alert('Failed to open file picker. Make sure the backend is running.');
        }
    };

    const handleBrowseFolder = async (index: number) => {
        try {
            const response = await fetch(`${API_URL}/pick-directory`, { method: 'POST' });
            const data = await response.json();

            if (data.success && data.path) {
                updateGamesPath(index, data.path);
            }
        } catch (err) {
            console.error('Folder picker error:', err);
            alert('Failed to open folder picker. Make sure the backend is running.');
        }
    };

    const updateGamesPath = (index: number, text: string) => {
        const newPaths = [...gamesPaths];
        newPaths[index] = text;
        setGamesPaths(newPaths);
    };

    const addGamesPath = () => {
        setGamesPaths([...gamesPaths, '']);
    };

    const removeGamesPath = (index: number) => {
        const newPaths = gamesPaths.filter((_, i) => i !== index);
        setGamesPaths(newPaths.length ? newPaths : ['']); // Keep at least one
    };

    const handleSubmit = () => {
        // Filter empty paths
        const validGamesPaths = gamesPaths.map(p => p.trim()).filter(Boolean);

        if (name.trim() && displayName.trim() && exePath.trim() && validGamesPaths.length > 0) {
            const extensions = excludedExt.split(',').map(e => e.trim()).filter(Boolean);
            const normalizedName = name.trim().toLowerCase().replace(/\s+/g, '-');

            onAdd(
                normalizedName,
                displayName.trim(),
                exePath.trim(),
                validGamesPaths,
                template.trim(),
                extensions
            );
            onClose();
        }
    };

    const isValid = name.trim() && displayName.trim() && exePath.trim() && gamesPaths.some(p => p.trim());
    const isEditMode = !!initialData;

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
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <View style={styles.header}>
                            <Text style={styles.title}>{isEditMode ? 'Edit Emulator' : 'Add Emulator'}</Text>
                            <Pressable onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#94A3B8" />
                            </Pressable>
                        </View>

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Name (ID) *</Text>
                                <TextInput
                                    style={[styles.input, isEditMode && styles.inputDisabled]}
                                    placeholder="e.g., dolphin, ppsspp"
                                    placeholderTextColor="#64748B"
                                    value={name}
                                    onChangeText={setName}
                                    autoCapitalize="none"
                                    editable={!isEditMode} // ID cannot be changed in edit mode
                                />
                                <Text style={styles.hint}>Internal identifier{isEditMode ? ' (read-only)' : ' (auto-formatted)'}</Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Display Name *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g., Dolphin (GameCube/Wii)"
                                    placeholderTextColor="#64748B"
                                    value={displayName}
                                    onChangeText={setDisplayName}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Emulator Path *</Text>
                                <View style={styles.inputWithButton}>
                                    <TextInput
                                        style={[styles.input, styles.inputFlex]}
                                        placeholder="/Applications/Dolphin.app"
                                        placeholderTextColor="#64748B"
                                        value={exePath}
                                        onChangeText={setExePath}
                                        autoCapitalize="none"
                                    />
                                    <Pressable style={styles.browseButton} onPress={handleBrowseFile}>
                                        <Ionicons name="folder-open" size={20} color="#60A5FA" />
                                    </Pressable>
                                </View>
                                <Text style={styles.hint}>Path to emulator executable</Text>
                            </View>

                            {/* Multiple Games Paths */}
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Text style={styles.label}>Games Directories *</Text>
                                    <Pressable onPress={addGamesPath} style={styles.addPathButton}>
                                        <Ionicons name="add-circle" size={20} color="#3B82F6" />
                                    </Pressable>
                                </View>

                                {gamesPaths.map((path, index) => (
                                    <View key={index} style={styles.pathRow}>
                                        <View style={[styles.inputWithButton, styles.inputFlex]}>
                                            <TextInput
                                                style={[styles.input, styles.inputFlex]}
                                                placeholder="e.g., /Users/you/Games/GameCube"
                                                placeholderTextColor="#64748B"
                                                value={path}
                                                onChangeText={(text) => updateGamesPath(index, text)}
                                                autoCapitalize="none"
                                            />
                                            <Pressable style={styles.browseButton} onPress={() => handleBrowseFolder(index)}>
                                                <Ionicons name="folder-open" size={20} color="#60A5FA" />
                                            </Pressable>
                                        </View>

                                        {gamesPaths.length > 1 && (
                                            <Pressable
                                                style={styles.removePathButton}
                                                onPress={() => removeGamesPath(index)}
                                            >
                                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                            </Pressable>
                                        )}
                                    </View>
                                ))}
                                <Text style={styles.hint}>Directories containing game files</Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Command Template</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="exepath game"
                                    placeholderTextColor="#64748B"
                                    value={template}
                                    onChangeText={setTemplate}
                                    autoCapitalize="none"
                                />
                                <Text style={styles.hint}>
                                    Use 'exepath' for emulator path, 'game' for game file
                                </Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Excluded Extensions</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder=".bin,.sav,.txt,.srm,.DS_Store"
                                    placeholderTextColor="#64748B"
                                    value={excludedExt}
                                    onChangeText={setExcludedExt}
                                    autoCapitalize="none"
                                />
                                <Text style={styles.hint}>Comma-separated list</Text>
                            </View>
                        </View>

                        <Pressable
                            style={[styles.submitButton, !isValid && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={!isValid}
                        >
                            <Ionicons name={isEditMode ? "save" : "add"} size={20} color="#FFFFFF" />
                            <Text style={styles.submitButtonText}>{isEditMode ? 'Save Changes' : 'Add Emulator'}</Text>
                        </Pressable>
                    </ScrollView>
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
        maxWidth: 500,
        maxHeight: '85%',
        backgroundColor: '#1E293B',
        borderRadius: 16,
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
    labelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    input: {
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderRadius: 16,
        padding: 14,
        fontSize: 16,
        color: '#F8FAFC',
        borderWidth: 1,
        margin: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    inputDisabled: {
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        borderColor: 'rgba(255, 255, 255, 0.05)',
        color: '#64748B',
    },
    hint: {
        fontSize: 12,
        color: '#64748B',
        lineHeight: 18,
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
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.4)',
    },
    addPathButton: {
        padding: 4,
    },
    pathRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    removePathButton: {
        padding: 14,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#3B82F6',
        borderRadius: 16,
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
