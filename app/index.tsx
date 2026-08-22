import { AddEmulatorModal } from '@/components/AddEmulatorModal';
import { GameCard } from '@/components/GameCard';
import { ManageEmulatorsModal } from '@/components/ManageEmulatorsModal';
import { SectionHeader } from '@/components/SectionHeader';
import { SettingsModal } from '@/components/SettingsModal';
import { TabIndicator } from '@/components/TabIndicator';
import { useEmulators } from '@/hooks/useEmulators';
import { useGames } from '@/hooks/useGames';
import { useSettings } from '@/hooks/useSettings';
import { Game, GameFilterMode } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  PanResponder,
  PanResponderGestureState,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_CONFIG = [
  { key: 'all' as GameFilterMode, label: 'ALL' },
  { key: 'favorites' as GameFilterMode, label: 'FAVORITES' },
  { key: 'recents' as GameFilterMode, label: 'RECENT' },
];

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { settings, setSortBy, setSimplifiedUI } = useSettings();
  const { emulators, addEmulator, removeEmulator } = useEmulators();
  const {
    games,
    toggleFavorite,
    launchGame,
    getRecentGames,
    getFavoriteGames,
    scanGamesFromEmulator,
    removeGamesByEmulator,
    cleanupOrphanedGames,
  } = useGames(settings.apiUrl);

  // Cleanup orphaned games whenever emulators change
  React.useEffect(() => {
    // We must run cleanup even if emulators list is empty (to remove all games)
    if (emulators === undefined) return;
    cleanupOrphanedGames(emulators);
  }, [emulators, cleanupOrphanedGames]);

  const [currentTab, setCurrentTab] = useState<GameFilterMode>('all');
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [addEmulatorVisible, setAddEmulatorVisible] = useState(false);
  const [manageEmulatorsVisible, setManageEmulatorsVisible] = useState(false);

  const [editingEmulator, setEditingEmulator] = useState<any | null>(null);

  const HEADER_HEIGHT = 60 + insets.top; // Approximate height including padding
  const headerTranslateY = useSharedValue(0);
  const lastScrollY = useSharedValue(0);

  const updateScrollOffset = (offset: number) => {
    scrollOffset.current = offset;
  };

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentY = event.contentOffset.y;
      const diff = currentY - lastScrollY.value;

      // Update JS ref for PanResponder
      runOnJS(updateScrollOffset)(currentY);

      // If scrolling down and past the header, hide it
      if (diff > 0 && currentY > HEADER_HEIGHT) {
        headerTranslateY.value = withTiming(-HEADER_HEIGHT, { duration: 300 });
      }
      // If scrolling up, show it
      else if (diff < -5 || currentY < HEADER_HEIGHT) {
        headerTranslateY.value = withTiming(0, { duration: 300 });
      }

      lastScrollY.value = currentY;
    },
  });

  const animatedHeaderStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: headerTranslateY.value }],
    };
  });
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  // Drag to scroll logic (Web)
  const scrollRef = React.useRef<FlatList>(null);
  const scrollOffset = React.useRef(0);
  const startScrollOffset = React.useRef(0);
  const isDragging = React.useRef(false);

  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState: PanResponderGestureState) => {
        // Only enable on Web to simulate touch drag
        if (Platform.OS !== 'web') return false;
        const { dx, dy } = gestureState;
        // Capture if vertical drag is dominant and significant
        return Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx);
      },
      onPanResponderGrant: () => {
        isDragging.current = true;
        startScrollOffset.current = scrollOffset.current;
      },
      onPanResponderMove: (_, gestureState: PanResponderGestureState) => {
        if (scrollRef.current) {
          scrollRef.current.scrollToOffset({
            offset: Math.max(0, startScrollOffset.current - gestureState.dy),
            animated: false,
          });
        }
      },
      onPanResponderRelease: () => {
        // Delay resetting isDragging to block clicks that happen immediately after release
        setTimeout(() => {
          isDragging.current = false;
        }, 100);
      },
    })
  ).current;

  // Filter games based on current tab
  const filteredGames = useMemo(() => {
    switch (currentTab) {
      case 'favorites':
        return getFavoriteGames();
      case 'recents':
        return getRecentGames();
      default:
        return games;
    }
  }, [currentTab, games, getFavoriteGames, getRecentGames]);

  const handleLaunch = async (game: Game) => {
    if (isDragging.current) return;

    const result = await launchGame(game);
    if (!result.success) {
      console.error('Launch failed:', result.error);
    } else {
      console.log('Game launched successfully');
    }
  };

  const handleAddEmulator = async (
    name: string,
    displayName: string,
    exePath: string,
    gamesPaths: string[],
    template: string,
    excludedExtensions: string[]
  ) => {
    const emulator = await addEmulator(name, displayName, exePath, gamesPaths, template, excludedExtensions);

    // Automatically scan for games after adding/updating emulator
    console.log('[App] Scanning for games after adding/updating emulator...');
    const result = await scanGamesFromEmulator(emulator);
    console.log(`[App] Scan complete. Added ${result.count} games.`);

    if (result.errors && result.errors.length > 0) {
      console.error('[App] Scan errors:', result.errors);
    }

    setEditingEmulator(null); // Clear edit state
  };

  const handleScanGames = async (emulator: typeof emulators[0]) => {
    console.log(`[App] Manual scan requested for: ${emulator.displayName}`);
    const result = await scanGamesFromEmulator(emulator);
    console.log(`[App] Scan complete. Added ${result.count} new games, updated ${(result as any).updated || 0} existing games.`);

    if (result.errors && result.errors.length > 0) {
      console.error('[App] Scan errors:', result.errors);
    }
  };

  const handleEditEmulator = (emulator: typeof emulators[0]) => {
    setEditingEmulator(emulator);
    setManageEmulatorsVisible(false);
    setAddEmulatorVisible(true);
  };

  const syncAllEmulators = async () => {
    // ... (implementation same as before)
    console.log('[App] Syncing all emulators...');
    let totalAdded = 0;
    let totalUpdated = 0;

    for (const emulator of emulators) {
      const result = await scanGamesFromEmulator(emulator);
      totalAdded += result.count;
      totalUpdated += (result as any).updated || 0;
    }

    console.log(`[App] Sync complete. Added ${totalAdded} new games, updated ${totalUpdated} existing games across ${emulators.length} emulators.`);
    return { totalAdded, totalUpdated };
  };

  // Auto-sync on startup once emulators are loaded
  React.useEffect(() => {
    if (!initialSyncDone && emulators.length > 0) {
      console.log('[App] Initial auto-sync triggered');
      syncAllEmulators();
      setInitialSyncDone(true);
    }
  }, [emulators, initialSyncDone]);

  const handleRemoveEmulator = (emulatorId: string) => {
    // ... (implementation same as before)
    console.log(`[App] Removing emulator and associated games: ${emulatorId}`);
    removeGamesByEmulator(emulatorId);
    removeEmulator(emulatorId);
    console.log('[App] Emulator and games removed');
  };

  const toggleSort = () => {
    setSortBy(settings.sortBy === 'alphabetical' ? 'emulator' : 'alphabetical');
  };

  const cycleTab = (direction: 'left' | 'right') => {
    const currentIndex = TAB_CONFIG.findIndex(t => t.key === currentTab);
    let newIndex;

    if (direction === 'left') {
      newIndex = currentIndex - 1;
      if (newIndex < 0) newIndex = TAB_CONFIG.length - 1;
    } else {
      newIndex = currentIndex + 1;
      if (newIndex >= TAB_CONFIG.length) newIndex = 0;
    }

    setCurrentTab(TAB_CONFIG[newIndex].key);
  };

  // Group games by sections
  const sections = React.useMemo(() => {
    const groups: { title: string; data: typeof filteredGames }[] = [];

    if (settings.sortBy === 'alphabetical') {
      const grouped = filteredGames.reduce((acc, game) => {
        const firstLetter = game.cleanName[0].toUpperCase();
        if (!acc[firstLetter]) acc[firstLetter] = [];
        acc[firstLetter].push(game);
        return acc;
      }, {} as Record<string, typeof filteredGames>);

      Object.keys(grouped).sort().forEach(key => {
        // Sort games within this group
        const sortedGames = grouped[key].sort((a, b) =>
          a.cleanName.localeCompare(b.cleanName)
        );
        groups.push({ title: key, data: sortedGames });
      });
    } else {
      const grouped = filteredGames.reduce((acc, game) => {
        if (!acc[game.emulator]) acc[game.emulator] = [];
        acc[game.emulator].push(game);
        return acc;
      }, {} as Record<string, typeof filteredGames>);

      Object.keys(grouped).sort().forEach(key => {
        // Sort games within this group
        const sortedGames = grouped[key].sort((a, b) =>
          a.cleanName.localeCompare(b.cleanName)
        );
        groups.push({ title: key, data: sortedGames });
      });
    }
    return groups;
  }, [filteredGames, settings.sortBy]);

  const renderSection = ({ item }: { item: { title: string; data: typeof filteredGames } }) => {
    // Determine icon based on sort mode
    const icon = settings.sortBy === 'emulator' ? 'game-controller' : undefined;

    return (
      <View style={styles.sectionContainer}>
        <SectionHeader title={item.title} count={item.data.length} icon={icon} />
        <View style={styles.gamesGrid}>
          {item.data.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onLaunch={handleLaunch}
              onToggleFavorite={toggleFavorite}
              simplifiedUI={settings.simplifiedUI}
              apiUrl={settings.apiUrl}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Game Grid - Now takes up full screen behind header */}
      <View
        style={[{ flex: 1 }, Platform.OS === 'web' && ({ userSelect: 'none' } as any)]}
        {...panResponder.panHandlers}
      >
        <Animated.FlatList
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          data={sections}
          renderItem={renderSection}
          keyExtractor={(item) => item.title}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: insets.top + HEADER_HEIGHT + 10, // Header height + some extra padding
              paddingBottom: insets.bottom + 100 // Space for FAB
            }
          ]}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          windowSize={5}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="game-controller-outline" size={64} color="#334155" />
              <Text style={styles.emptyText}>No games found</Text>
              <Text style={styles.emptySubtext}>
                Add emulators and scan for games to get started
              </Text>
            </View>
          }
        />
      </View>

      {/* Floating Header */}
      <Animated.View style={[styles.headerContainer, { paddingTop: insets.top }, animatedHeaderStyle]}>
        <View style={styles.header}>
          {/* Side Elements (Left/Right) in Flex Row */}
          <View style={styles.headerContentRow} pointerEvents="box-none">
            <View style={styles.headerLeft}>
              <Pressable onPress={() => { router.replace('/') }}>
                <View style={styles.headerTitleContainer}>
                  <Image source={require('../backend/images/logo.png')} style={styles.logo} />
                </View>
              </Pressable>
            </View>

            <View style={styles.headerRight}>
              <Pressable
                style={styles.iconButton}
                onPress={toggleSort}
              >
                <Ionicons
                  name={settings.sortBy === 'alphabetical' ? 'list' : 'game-controller'}
                  size={24}
                  color="#94A3B8"
                />
              </Pressable>
              <Pressable
                style={styles.iconButton}
                onPress={() => setSettingsVisible(true)}
              >
                <Ionicons name="settings-outline" size={24} color="#94A3B8" />
              </Pressable>
            </View>
          </View>

          {/* Centered Element (Absolute Overlay) */}
          <View style={styles.headerCenterOverlay} pointerEvents="box-none">
            <TabIndicator currentTab={currentTab} tabs={TAB_CONFIG} onTabSelect={setCurrentTab} />
          </View>
        </View>
      </Animated.View>

      {/* FAB for adding games/emulators */}
      <Pressable
        style={[styles.fab, { bottom: 32 + insets.bottom }]}
        onPress={() => {
          setEditingEmulator(null);
          setAddEmulatorVisible(true);
        }}
      >
        <Ionicons name="add" size={40} color="#FFFFFF" />
      </Pressable>

      <AddEmulatorModal
        visible={addEmulatorVisible}
        onClose={() => {
          setAddEmulatorVisible(false);
          setEditingEmulator(null);
        }}
        onAdd={handleAddEmulator}
        onScan={handleScanGames}
        initialData={editingEmulator}
      />

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        apiUrl={settings.apiUrl}
        simplifiedUI={settings.simplifiedUI}
        onToggleSimplifiedUI={setSimplifiedUI}
        sortBy={settings.sortBy}
        onToggleSort={toggleSort}
        emulatorCount={emulators.length}
        gameCount={games.length}
        onManageEmulators={() => {
          setSettingsVisible(false);
          setManageEmulatorsVisible(true);
        }}
        onSyncAll={syncAllEmulators}
      />

      <ManageEmulatorsModal
        visible={manageEmulatorsVisible}
        onClose={() => setManageEmulatorsVisible(false)}
        emulators={emulators}
        onRemove={handleRemoveEmulator}
        onAdd={() => {
          setManageEmulatorsVisible(false);
          setEditingEmulator(null);
          setAddEmulatorVisible(true);
        }}
        onScanGames={handleScanGames}
        onEdit={handleEditEmulator}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 1)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.95)', // Slightly transparent background
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  header: {
    // Container for the whole header area
    justifyContent: 'center', // Center content vertically
  },
  headerContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 5,
    zIndex: 10,
  },
  headerCenterOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  headerLeft: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerCenter: {
    // Removed/Deprecated
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  title: {
    fontSize: 42, // Was 28
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18, // Was 14
    color: '#64748B',
    marginTop: 6,
  },
  logo: {
    width: 66,
    height: 58,
  },
  iconButton: {
    width: 56, // Was 44
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  grid: {
    paddingHorizontal: 16,
    paddingBottom: 120, // More scrolling room
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 16,
  },
  emptyText: {
    fontSize: 24, // Was 20
    fontWeight: '600',
    color: '#F8FAFC',
  },
  emptySubtext: {
    fontSize: 16, // Was 14
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  listContent: {
    paddingBottom: 140, // Increased bottom padding for FAB
    paddingHorizontal: 12,
  },
  sectionContainer: {
    marginBottom: 12,
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6, // Adjusted for larger card padding
  },
  fab: {
    position: 'absolute',
    right: 32, // Further form edge
    bottom: 32,
    width: 72, // Was 56
    height: 72,
    borderRadius: 36,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 6 }, // Deeper shadow
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabPressed: {
    backgroundColor: '#2563EB',
    transform: [{ scale: 0.95 }],
  },
});
