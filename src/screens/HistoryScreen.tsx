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
  Alert,
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { StackNavigationProp } from '@react-navigation/stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { ChatBackend, ChatRoom } from '../services/ChatBackendBridge';
import { BottomNav } from '../components';

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

  useFocusEffect(
    useCallback(() => {
      ChatBackend.getAllRooms().then(setRooms).catch(console.error);
    }, [])
  );

  const handleClearAll = () => {
    if (rooms.length === 0) return;
    Alert.alert('Clear History', 'Delete all chat history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          for (const room of rooms) {
            await ChatBackend.deleteRoom(room.id);
          }
          setRooms([]);
        },
      },
    ]);
  };

  const handleDeleteRoom = (roomId: string) => {
    Alert.alert('Delete Chat', 'Delete this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await ChatBackend.deleteRoom(roomId);
          setRooms(prev => prev.filter(r => r.id !== roomId));
        },
      },
    ]);
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
});
