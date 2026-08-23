import { detectEmulator } from '@/utils/emulatorCatalog';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    Image,
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
    const [iconVersion, setIconVersion] = useState(0);
    const [iconError, setIconError] = useState(false);

    // Prefill bookkeeping: an auto-suggested value may be replaced by the
    // next suggestion, but anything the user typed themselves never is.
    const lastSuggestedName = useRef<string | null>(null);
    const lastSuggestedDisplayName = useRef<string | null>(null);
    const lastSuggestedTemplate = useRef<string | null>(null);

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
        lastSuggestedName.current = null;
        lastSuggestedDisplayName.current = null;
        lastSuggestedTemplate.current = null;
        setIconVersion(0);
        setIconError(false);
    }, [initialData, visible]);

    const normalizedName = name.trim().toLowerCase().replace(/\s+/g, '-');

    // Detect a known emulator from whatever is filled in so far and offer
    // its proven launch template (and name/display name when untouched).
    const detected = React.useMemo(
        () => detectEmulator(`${name} ${displayName} ${exePath}`),
        [name, displayName, exePath]
    );

    React.useEffect(() => {
        if (!detected) return;

        setName(prev => {
            const untouched = !prev.trim() || prev === lastSuggestedName.current;
            if (untouched && prev !== detected.key) {
                lastSuggestedName.current = detected.key;
                return detected.key;
            }
            return prev;
        });
        setDisplayName(prev => {
            const untouched = !prev.trim() || prev === lastSuggestedDisplayName.current;
            if (untouched && prev !== detected.displayName) {
                lastSuggestedDisplayName.current = detected.displayName;
                return detected.displayName;
            }
            return prev;
        });
        setTemplate(prev => {
            const untouched = !prev.trim()
                || prev.trim() === 'exepath game'
                || prev === lastSuggestedTemplate.current;
            if (untouched && prev !== detected.template) {
                lastSuggestedTemplate.current = detected.template;
                return detected.template;
            }
            return prev;
        });
        setIconError(false);
    }, [detected]);

    const iconQueryName = normalizedName || detected?.key || '';
    const iconUri = iconQueryName
        ? `${API_URL}/emulator-icon/${encodeURIComponent(iconQueryName)}${iconVersion ? `?v=${iconVersion}` : ''}`
        : null;

    const iconInputRef = useRef<HTMLInputElement>(null);

    const handleIconUpload = async (event: any) => {
        const file = event.target.files[0];
        if (!file || !iconQueryName) return;

        const formData = new FormData();
        formData.append('emulatorName', iconQueryName);
        formData.append('image', file);

        try {
            const response = await fetch(`${API_URL}/upload-emulator-icon`, {
                method: 'POST',
                body: formData,
            });
            const data = await response.json();
            if (data.success) {
                setIconVersion(Date.now());
                setIconError(false);
            } else {
                console.error('Icon upload failed:', data.error);
            }
        } catch (err) {
            console.error('Icon upload error:', err);
        }
    };

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

                            {/* Icon + detection */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Icon</Text>
                                <View style={styles.iconRow}>
                                    <View style={styles.iconPreview}>
                                        {iconUri && !iconError ? (
                                            <Image
                                                source={{ uri: iconUri }}
                                                style={styles.iconImage}
                                                resizeMode="contain"
                                                onError={() => setIconError(true)}
                                            />
                                        ) : (
                                            <Ionicons name="game-controller-outline" size={28} color="#475569" />
                                        )}
                                    </View>
                                    <View style={styles.iconInfo}>
                                        {detected ? (
                                            <Text style={styles.detectedText}>
                                                Detected: {detected.displayName}
                                            </Text>
                                        ) : (
                                            <Text style={styles.hint}>
                                                Known emulators are detected automatically
                                            </Text>
                                        )}
                                        <Text style={styles.hint}>
                                            {iconError ? 'No icon found — upload one below' : 'Auto-matched icon shown'}
                                        </Text>
                                    </View>
                                    <Pressable
                                        style={[styles.browseButton, !iconQueryName && styles.submitButtonDisabled]}
                                        onPress={() => {
                                            if (Platform.OS === 'web' && iconInputRef.current) {
                                                iconInputRef.current.click();
                                            }
                                        }}
                                        disabled={!iconQueryName}
                                    >
                                        <Ionicons name="image" size={20} color="#60A5FA" />
                                    </Pressable>
                                </View>
                                {Platform.OS === 'web' && (
                                    <div style={{ display: 'none' }}>
                                        <input
                                            type="file"
                                            ref={iconInputRef}
                                            accept="image/*"
                                            onChange={handleIconUpload}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                )}
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
                                    Use &lsquo;exepath&rsquo; for emulator path, &lsquo;game&rsquo; for game file
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
    iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconPreview: {
        width: 52,
        height: 52,
        borderRadius: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    iconImage: {
        width: 44,
        height: 44,
    },
    iconInfo: {
        flex: 1,
        gap: 2,
    },
    detectedText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#10B981',
    },
});
