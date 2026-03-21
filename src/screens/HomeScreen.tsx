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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

const { width } = Dimensions.get('window');

type HomeScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Home'>;
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
        <Text style={styles.capIcon}>{icon}</Text>
      </View>
      <Text style={styles.capTitle}>{title}</Text>
      <Text style={styles.capSubtitle}>{subtitle}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

const ActivityItem: React.FC<{
  icon: string;
  title: string;
  time: string;
  type: string;
}> = ({ icon, title, time, type }) => (
  <TouchableOpacity style={styles.activityItem} activeOpacity={0.7}>
    <View style={styles.activityIconContainer}>
      <Text style={styles.activityIcon}>{icon}</Text>
    </View>
    <View style={styles.activityTextContainer}>
      <Text style={styles.activityTitle}>{title}</Text>
      <Text style={styles.activitySubtitle}>{time} • {type}</Text>
    </View>
    <Text style={styles.chevron}>›</Text>
  </TouchableOpacity>
);

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      {/* Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.logoRow}>
          <Text style={styles.logoShield}>🛡️</Text>
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
          <Text style={styles.greetingTitle}>Namaste,</Text>
          <Text style={styles.greetingSubtitle}>How can I help you today?</Text>
        </View>

        {/* Quick Chat Input Launcher */}
        <TouchableOpacity 
          style={styles.searchLauncher} 
          activeOpacity={0.9}
          onPress={() => navigation.navigate('Chat')}
        >
          <View style={styles.searchInner}>
            <Text style={styles.searchIcon}>✨</Text>
            <Text style={styles.searchText}>Ask Sahayak...</Text>
            <View style={styles.searchMicBtn}>
              <Text style={styles.searchMicIcon}>🎤</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Capabilities Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Capabilities</Text>
        </View>
        
        <View style={styles.gridRow}>
          <CapabilityCard
            icon="💬"
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
            icon="🔍"
            title="Visual AI"
            subtitle="Scan & OCR"
            colorPrimary="#F0F4F8"
            colorSecondary="#E2E8F0"
            onPress={() => navigation.navigate('Scan')}
          />
          <CapabilityCard
            icon="📝"
            title="Smart Notes"
            subtitle="Record meetings"
            colorPrimary="#F0F4F8"
            colorSecondary="#E2E8F0"
            onPress={() => navigation.navigate('SmartNotes')}
          />
        </View>

        <View style={styles.gridRow}>
          <CapabilityCard
            icon="🔒"
            title="Secure Vault"
            subtitle="Private storage"
            colorPrimary="#F0F4F8"
            colorSecondary="#E2E8F0"
            onPress={() => {}} // Placeholder
          />
          <CapabilityCard
            icon="🚨"
            title="Emergency"
            subtitle="SOS Contacts"
            colorPrimary="#FEE2E2"
            colorSecondary="#FECACA"
            onPress={() => {}} // Placeholder
          />
        </View>

        {/* Recent Activity */}
        <View style={styles.activityHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity>
            <Text style={styles.clearAllText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityList}>
          <ActivityItem 
            icon="📄" 
            title="Medicine Details Extracted" 
            time="2 mins ago" 
            type="Scan" 
          />
          <ActivityItem 
            icon="💬" 
            title="Translated phrase to Hindi" 
            time="1 hour ago" 
            type="Chat" 
          />
          <ActivityItem 
            icon="📝" 
            title="Doctor's Visit Summary" 
            time="Yesterday" 
            type="Smart Note" 
          />
        </View>
        
        {/* Extra spacing for bottom nav */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <View style={[styles.navIconContainer, styles.navItemActive]}>
            <Text style={styles.navIcon}>🏠</Text>
          </View>
          <Text style={[styles.navLabel, styles.navLabelActive]}>HOME</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Chat')}>
          <View style={styles.navIconContainer}>
            <Text style={styles.navIcon}>💬</Text>
          </View>
          <Text style={styles.navLabel}>CHAT</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Scan')}>
          <View style={styles.navIconContainer}>
            <Text style={styles.navIcon}>🔍</Text>
          </View>
          <Text style={styles.navLabel}>SCAN</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <View style={styles.navIconContainer}>
            <Text style={styles.navIcon}>⚙️</Text>
          </View>
          <Text style={styles.navLabel}>SETTINGS</Text>
        </TouchableOpacity>
      </View>
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
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoShield: {
    fontSize: 22,
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
    backgroundColor: '#10B981', // Success green indicating ready
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
  clearAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1B3A5C',
  },
  activityList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  activityIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityIcon: {
    fontSize: 20,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  activitySubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#CBD5E1',
    marginRight: 8,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 85,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconContainer: {
    width: 44,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: '#E8EEF4',
  },
  navIcon: {
    fontSize: 20,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  navLabelActive: {
    color: '#1B3A5C',
    fontWeight: '800',
  },
});
