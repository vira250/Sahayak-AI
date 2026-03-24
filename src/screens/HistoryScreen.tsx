import React, { useState, useCallback } from 'react';
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
} from 'react-native';
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
  const [confirmState, setConfirmState] = useState<{ type: 'clear-all' | 'delete-room'; roomId?: string } | null>(null);
  const { showToast } = useToast();
  const genericHistoryError = 'Something went wrong. Please try again.';

  useFocusEffect(
    useCallback(() => {
      const loadRooms = async () => {
        try {
          const allRooms = await ChatBackend.getAllRooms();
          setRooms(allRooms);
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
        showToast('All chat history deleted', 'success', 'bottom');
        setConfirmState(null);
        return;
      }

      if (confirmState.roomId) {
        await ChatBackend.deleteRoom(confirmState.roomId);
        setRooms(prev => prev.filter(r => r.id !== confirmState.roomId));
        showToast('Conversation deleted', 'success', 'bottom');
      }
      setConfirmState(null);
    } catch (error) {
      console.error('Failed to update history:', error);
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

      {/* New Chat Button */}
      <View style={styles.newChatContainer}>
        <TouchableOpacity
          style={styles.newChatButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Chat')}
        >
          <MaterialCommunityIcons name="sparkles" size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
          <Text style={styles.newChatText}>Start New Conversation</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
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
        ) : (
          rooms.map((room) => (
            <TouchableOpacity
              key={room.id}
              style={styles.roomCard}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Chat', { roomId: room.id })}
              onLongPress={() => handleDeleteRoom(room.id)}
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
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

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
  newChatContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F2544',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#0F2544',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  newChatIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  newChatText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  newChatArrow: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
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
