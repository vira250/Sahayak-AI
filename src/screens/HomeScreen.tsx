import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  Platform,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { ChatMessage, ModelLoaderWidget, BottomNav } from '../components';

const { width } = Dimensions.get('window');

type HomeScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Home'>;
};

// Helper to format timestamp to relative time
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

const CapabilityCard: React.FC<{
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  colorPrimary: string;
  colorSecondary: string;
  isLarge?: boolean;
}> = ({ icon, title, subtitle, onPress, colorPrimary, colorSecondary, isLarge }) => (
  <TouchableOpacity
    style={[styles.capCardContainer, isLarge && styles.capCardLarge]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <LinearGradient
      colors={[colorPrimary, colorSecondary]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.capGradient}
    >
      <View style={styles.capIconBg}>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={colorPrimary === '#F0F4F8' ? '#1B3A5C' : '#FFFFFF'}
        />
      </View>
      <Text style={[styles.capTitle, colorPrimary === '#1B3A5C' && { color: '#FFFFFF' }]}>{title}</Text>
      <Text style={[styles.capSubtitle, colorPrimary === '#1B3A5C' && { color: 'rgba(255,255,255,0.7)' }]}>{subtitle}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.logoText}>Sahayak AI</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={styles.offlineBadge}>
            <View style={styles.statusDot} />
            <Text style={styles.offlineText}>Private & Local</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Greeting Section */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingTitle}>Hello,</Text>
        </View>

        {/* Quick Chat Input Launcher */}
        <TouchableOpacity
          style={styles.searchLauncher}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Chat')}
        >
          <View style={styles.searchInner}>
            <MaterialCommunityIcons name="sparkles" size={24} color="#1B3A5C" style={{ marginRight: 12 }} />
            <Text style={styles.searchText}>Ask Dr. Sahayak...</Text>
            <View style={styles.searchMicBtn}>
              <MaterialCommunityIcons name="microphone" size={20} color="#1B3A5C" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Capabilities Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Capabilities</Text>
        </View>

        <View style={styles.gridRow}>
          <CapabilityCard
            icon="message-text-outline"
            title="Assistant Chat"
            subtitle="Text & Voice AI"
            colorPrimary="#1B3A5C"
            colorSecondary="#2B5F8E"
            onPress={() => navigation.navigate('Chat')}
            isLarge
          />
        </View>

        <View style={styles.gridRow}>
          <CapabilityCard
            icon="camera-outline"
            title="Visual AI"
            subtitle="Scan & OCR"
            colorPrimary="#F0F4F8"
            colorSecondary="#E2E8F0"
            onPress={() => navigation.navigate('Scan')}
          />
          <CapabilityCard
            icon="timeline-text-outline"
            title="Audit Timeline"
            subtitle="Clinical event log"
            colorPrimary="#F0F4F8"
            colorSecondary="#E2E8F0"
            onPress={() => navigation.navigate('AuditTimeline')}
          />
        </View>

        <View style={styles.gridRow}>
          <CapabilityCard
            icon="shield-lock-outline"
            title="Medicine Schedule"
            subtitle="Reminders & logs"
            colorPrimary="#F0F4F8"
            colorSecondary="#E2E8F0"
            onPress={() => navigation.navigate('MedicineSchedule')}
          />
          <CapabilityCard
            icon="alert-octagon-outline"
            title="Emergency"
            subtitle="SOS Contacts"
            colorPrimary="#FEE2E2"
            colorSecondary="#FECACA"
            onPress={() => navigation.navigate('MeshSOS')}
          />
        </View>

        {/* View History Button */}
        <View style={styles.activityHeader}>
          <Text style={styles.sectionTitle}>Recent Chats</Text>
        </View>
        <TouchableOpacity
          style={styles.viewHistoryButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('History')}
        >
          <MaterialCommunityIcons name="history" size={22} color="#1B3A5C" style={{ marginRight: 14 }} />
          <Text style={styles.viewHistoryText}>View Chat History</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>

        {/* Extra spacing for bottom nav */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav activeTab="Home" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 8 : 16,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 35,
    height: 35,
    marginRight: 8,
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F2544',
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8EEF4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  offlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1B3A5C',
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  greetingContainer: {
    marginTop: 10,
    marginBottom: 24,
  },
  greetingTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F2544',
    lineHeight: 40,
  },
  greetingSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  searchLauncher: {
    marginBottom: 32,
    elevation: 4,
    shadowColor: '#1B3A5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  searchText: {
    flex: 1,
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '500',
  },
  searchMicBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchMicIcon: {
    fontSize: 20,
  },
  sectionHeader: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F2544',
  },
  gridRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  capCardContainer: {
    flex: 1,
    height: 120,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  capCardLarge: {
    height: 140,
  },
  capGradient: {
    flex: 1,
    padding: 20,
    justifyContent: 'flex-end',
  },
  capIconBg: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  capIcon: {
    fontSize: 20,
  },
  capTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F2544',
    marginBottom: 4,
  },
  capSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  viewHistoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
  },
  viewHistoryIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  viewHistoryText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1B3A5C',
  },
  viewHistoryArrow: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '600',
  },
  capabilityLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
  },
});
