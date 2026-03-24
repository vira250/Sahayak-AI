import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Modal,
  Image,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { ChatBackend, ChatRoom } from '../services/ChatBackendBridge';
import { BottomNav } from '../components';
import { useToast } from '../services/ToastService';

type HistoryScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'History'>;
};

const PINNED_ROOMS_KEY = '@history_pinned_rooms_v1';
const RENAMED_ROOMS_KEY = '@history_renamed_rooms_v1';

const timeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pinnedRoomIds, setPinnedRoomIds] = useState<string[]>([]);
  const [renamedRooms, setRenamedRooms] = useState<Record<string, string>>({});
  const [actionRoom, setActionRoom] = useState<ChatRoom | null>(null);
  const [renameState, setRenameState] = useState<{ roomId: string; title: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{ type: 'clear-all' | 'delete-room'; roomId?: string } | null>(null);
  const { showToast } = useToast();
  const genericHistoryError = 'Something went wrong. Please try again.';

  const filteredPinnedRooms = useMemo(() => {
    const pinnedSet = new Set(pinnedRoomIds);
    const query = searchQuery.trim().toLowerCase();
    const pinnedOnly = rooms.filter(room => pinnedSet.has(room.id));
    if (!query) return pinnedOnly;
    return pinnedOnly.filter(room => (room.title || 'Untitled Chat').toLowerCase().includes(query));
  }, [pinnedRoomIds, rooms, searchQuery]);

  const filteredRooms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rooms;
    return rooms.filter(room => (room.title || 'Untitled Chat').toLowerCase().includes(query));
  }, [rooms, searchQuery]);

  const renderRoomCard = (room: ChatRoom, showPinnedBadge = true) => (
    <TouchableOpacity
      key={room.id}
      style={styles.roomCard}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('Chat', { roomId: room.id })}
      onLongPress={() => setActionRoom(room)}
    >
      <View style={styles.roomIconContainer}>
        <MaterialCommunityIcons
          name={room.context ? 'file-document-outline' : 'message-text-outline'}
          size={24}
          color="#1B3A5C"
        />
      </View>
      <View style={styles.roomTextContainer}>
        <Text style={styles.roomTitle} numberOfLines={1}>
          {room.title || 'Untitled Chat'}
        </Text>
        <Text style={styles.roomSubtitle}>
          {timeAgo(room.lastUpdatedAt)} • {room.context ? 'Document' : 'Chat'}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD5E1" />
    </TouchableOpacity>
  );

  useFocusEffect(
    useCallback(() => {
      const loadRooms = async () => {
        try {
          const [allRooms, savedPinned, savedRenamed] = await Promise.all([
            ChatBackend.getAllRooms(),
            AsyncStorage.getItem(PINNED_ROOMS_KEY),
            AsyncStorage.getItem(RENAMED_ROOMS_KEY),
          ]);

          const pinned = savedPinned ? (JSON.parse(savedPinned) as string[]) : [];
          const renamed = savedRenamed ? (JSON.parse(savedRenamed) as Record<string, string>) : {};

          const withOverrides = allRooms.map(room => (
            renamed[room.id]
              ? { ...room, title: renamed[room.id] }
              : room
          ));

          setRooms(withOverrides);
          setPinnedRoomIds(pinned);
          setRenamedRooms(renamed);
        } catch (error) {
          console.error('Failed to load history rooms:', error);
          showToast(genericHistoryError, 'error', 'bottom');
        }
      };

      loadRooms();
    }, [showToast])
  );

  const handleClearAll = () => {
    if (rooms.length === 0) {
      showToast('No chat history to clear', 'info', 'bottom');
      return;
    }
    setConfirmState({ type: 'clear-all' });
  };

  const handleDeleteRoom = (roomId: string) => {
    setConfirmState({ type: 'delete-room', roomId });
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    try {
      if (confirmState.type === 'clear-all') {
        for (const room of rooms) {
          await ChatBackend.deleteRoom(room.id);
        }
        setRooms([]);
        setPinnedRoomIds([]);
        setRenamedRooms({});
        await AsyncStorage.removeItem(PINNED_ROOMS_KEY);
        await AsyncStorage.removeItem(RENAMED_ROOMS_KEY);
        showToast('All chat history deleted', 'success', 'bottom');
        setConfirmState(null);
        return;
      }

      if (confirmState.roomId) {
        await ChatBackend.deleteRoom(confirmState.roomId);
        setRooms(prev => prev.filter(r => r.id !== confirmState.roomId));
        const nextPinned = pinnedRoomIds.filter(id => id !== confirmState.roomId);
        setPinnedRoomIds(nextPinned);
        await AsyncStorage.setItem(PINNED_ROOMS_KEY, JSON.stringify(nextPinned));

        const { [confirmState.roomId]: _removed, ...restRenamed } = renamedRooms;
        setRenamedRooms(restRenamed);
        await AsyncStorage.setItem(RENAMED_ROOMS_KEY, JSON.stringify(restRenamed));
        showToast('Conversation deleted', 'success', 'bottom');
      }
      setConfirmState(null);
    } catch (error) {
      console.error('Failed to update history:', error);
      showToast(genericHistoryError, 'error', 'bottom');
    }
  };

  const togglePinRoom = async (room: ChatRoom) => {
    try {
      const isPinned = pinnedRoomIds.includes(room.id);
      const next = isPinned
        ? pinnedRoomIds.filter(id => id !== room.id)
        : [room.id, ...pinnedRoomIds.filter(id => id !== room.id)];

      setPinnedRoomIds(next);
      await AsyncStorage.setItem(PINNED_ROOMS_KEY, JSON.stringify(next));
      setActionRoom(null);
      showToast(isPinned ? 'Chat unpinned' : 'Chat pinned', 'success', 'bottom');
    } catch (error) {
      console.error('Failed to update pin state:', error);
      showToast(genericHistoryError, 'error', 'bottom');
    }
  };

  const openRename = () => {
    if (!actionRoom) return;
    setRenameState({ roomId: actionRoom.id, title: actionRoom.title || '' });
    setActionRoom(null);
  };

  const submitRename = async () => {
    if (!renameState) return;
    const nextTitle = renameState.title.trim();
    if (!nextTitle) {
      showToast('Chat name cannot be empty', 'info', 'bottom');
      return;
    }

    try {
      await ChatBackend.renameRoom(renameState.roomId, nextTitle);
      setRooms(prev => prev.map(room => (
        room.id === renameState.roomId
          ? { ...room, title: nextTitle, lastUpdatedAt: Date.now() }
          : room
      )));

      const nextRenamed = { ...renamedRooms, [renameState.roomId]: nextTitle };
      setRenamedRooms(nextRenamed);
      await AsyncStorage.setItem(RENAMED_ROOMS_KEY, JSON.stringify(nextRenamed));

      setRenameState(null);
      showToast('Chat renamed', 'success', 'bottom');
    } catch (error) {
      const isUnavailable = String(error).includes('rename operation unavailable');
      if (isUnavailable) {
        try {
          const nextRenamed = { ...renamedRooms, [renameState.roomId]: nextTitle };
          setRenamedRooms(nextRenamed);
          await AsyncStorage.setItem(RENAMED_ROOMS_KEY, JSON.stringify(nextRenamed));

          setRooms(prev => prev.map(room => (
            room.id === renameState.roomId
              ? { ...room, title: nextTitle }
              : room
          )));

          setRenameState(null);
          showToast('Chat renamed (local)', 'success', 'bottom');
          return;
        } catch (fallbackError) {
          console.error('Fallback rename failed:', fallbackError);
          showToast(genericHistoryError, 'error', 'bottom');
          return;
        }
      }

      console.error('Failed to rename chat:', error);
      showToast(genericHistoryError, 'error', 'bottom');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('../assets/logo.png')} 
            style={styles.logoImage} 
            resizeMode="contain" 
          />
          <Text style={styles.headerTitle}>History</Text>
        </View>
        {rooms.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search by chat title */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search Chat"
          placeholderTextColor="#94A3B8"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClearBtn}>
            <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Room List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {rooms.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="message-text-outline" size={64} color="#CBD5E1" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySubtext}>
              Start a conversation with Dr. Sahayak to see your chat history here
            </Text>
          </View>
        ) : filteredRooms.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="magnify-close" size={56} color="#CBD5E1" style={{ marginBottom: 16 }} />
            <Text style={styles.emptyTitle}>No chat names matched</Text>
            <Text style={styles.emptySubtext}>Try a different chat title keyword.</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderText}>PINNED CHATS</Text>
            </View>
            {filteredPinnedRooms.length === 0 ? (
              <View style={styles.sectionEmptyWrap}>
                <Text style={styles.sectionEmptyText}>No pinned chats</Text>
              </View>
            ) : (
              filteredPinnedRooms.map(room => renderRoomCard(room, true))
            )}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeaderText}>ALL CHATS</Text>
            </View>
            {filteredRooms.map(room => renderRoomCard(room, false))}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={!!actionRoom}
        transparent
        animationType="fade"
        onRequestClose={() => setActionRoom(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Chat Options</Text>
            <Text style={styles.confirmMessage} numberOfLines={1}>
              {actionRoom?.title || 'Untitled Chat'}
            </Text>
            <View style={styles.optionList}>
              <TouchableOpacity style={styles.optionBtn} onPress={() => actionRoom && togglePinRoom(actionRoom)}>
                <MaterialCommunityIcons
                  name={actionRoom && pinnedRoomIds.includes(actionRoom.id) ? 'pin-off-outline' : 'pin-outline'}
                  size={18}
                  color="#1E293B"
                />
                <Text style={styles.optionText}>
                  {actionRoom && pinnedRoomIds.includes(actionRoom.id) ? 'Unpin Chat' : 'Pin Chat'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionBtn} onPress={openRename}>
                <MaterialCommunityIcons name="pencil-outline" size={18} color="#1E293B" />
                <Text style={styles.optionText}>Rename Chat</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.optionBtn}
                onPress={() => {
                  const roomId = actionRoom?.id;
                  setActionRoom(null);
                  if (roomId) {
                    handleDeleteRoom(roomId);
                  }
                }}
              >
                <MaterialCommunityIcons name="delete-outline" size={18} color="#B42318" />
                <Text style={styles.optionTextDanger}>Delete Chat</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActionRoom(null)}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!renameState}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameState(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Rename Chat</Text>
            <TextInput
              style={styles.renameInput}
              value={renameState?.title ?? ''}
              onChangeText={(value) => setRenameState(prev => (prev ? { ...prev, title: value } : prev))}
              placeholder="Enter chat name"
              placeholderTextColor="#94A3B8"
              autoFocus
              maxLength={80}
            />
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRenameState(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={submitRename}>
                <Text style={styles.deleteText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!confirmState}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmState(null)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <MaterialCommunityIcons name="delete-alert-outline" size={18} color="#B42318" />
            </View>
            <Text style={styles.confirmTitle}>
              {confirmState?.type === 'clear-all' ? 'Clear Entire History?' : 'Delete Conversation?'}
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmState?.type === 'clear-all'
                ? 'This will remove all chat conversations from this device.'
                : 'This conversation will be removed from your device history.'}
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setConfirmState(null)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleConfirmAction}
              >
                <Text style={styles.deleteText}>
                  {confirmState?.type === 'clear-all' ? 'Delete All' : 'Delete'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <BottomNav activeTab="History" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 12 : 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F2544',
    letterSpacing: -0.5,
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 2,
  },
  searchIcon: {
    position: 'absolute',
    left: 34,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingLeft: 44,
    paddingRight: 36,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  searchClearBtn: {
    position: 'absolute',
    right: 30,
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#64748B',
  },
  sectionEmptyWrap: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  sectionEmptyText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  roomIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  roomIcon: {
    fontSize: 22,
  },
  roomTextContainer: {
    flex: 1,
  },
  roomTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 3,
  },
  roomSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  chevron: {
    fontSize: 22,
    color: '#CBD5E1',
    marginLeft: 8,
    fontWeight: '300',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  confirmIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 17,
    color: '#0F172A',
    fontWeight: '800',
  },
  confirmMessage: {
    marginTop: 6,
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  confirmActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  optionList: {
    marginTop: 12,
    gap: 8,
  },
  optionBtn: {
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  optionTextDanger: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#B42318',
  },
  renameInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  cancelBtn: {
    borderRadius: 10,
    backgroundColor: '#E8EEF4',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  cancelText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteBtn: {
    borderRadius: 10,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
