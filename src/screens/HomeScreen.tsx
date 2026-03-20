import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Image,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { AppColors } from '../theme';
import { RootStackParamList } from '../navigation/types';

const { width } = Dimensions.get('window');

type HomeScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Home'>;
};

// Activity Item Component
const ActivityItem: React.FC<{
  icon: string;
  title: string;
  time: string;
  type: string;
}> = ({ icon, title, time, type }) => (
  <TouchableOpacity style={styles.activityItem}>
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
            <Text style={styles.offlineIcon}>☁️</Text>
            <Text style={styles.offlineText}>OFFLINE</Text>
          </View>
          <TouchableOpacity style={styles.powerBtn}>
            <Text style={styles.powerIcon}>⚡</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Localization & Privacy Pills */}
        <View style={styles.pillsRow}>
          <View style={styles.privacyPill}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>100% Private (On-device AI)</Text>
          </View>
          <View style={styles.langToggle}>
            <TouchableOpacity style={[styles.langBtn, styles.langBtnActive]}>
              <Text style={styles.langTextActive}>EN</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.langBtn}>
              <Text style={styles.langText}>HI</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Greeting Section */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greetingTitle}>Namaste,</Text>
          <Text style={styles.greetingTitle}>How can I help?</Text>
          <Text style={styles.greetingSubtitle}>Ready to assist without internet.</Text>
        </View>

        {/* Main Mic Card */}
        <TouchableOpacity 
          style={styles.micCard} 
          onPress={() => navigation.navigate('Chat')}
        >
          <LinearGradient
            colors={['#0F2544', '#081426']}
            style={styles.micGradient}
          >
            <View style={styles.micCircle}>
              <Text style={styles.micIconLarge}>🎙️</Text>
            </View>
            <Text style={styles.micText}>TAP TO SPEAK</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Grid Actions */}
        <View style={styles.gridRow}>
          <TouchableOpacity style={styles.scanCard} onPress={() => navigation.navigate('Chat')}>
            <View style={styles.gridIconContainer}>
              <Text style={styles.gridIcon}>🔍</Text>
            </View>
            <Text style={styles.gridLabel}>Scan Anything</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.emergencyCard}>
            <View style={styles.gridIconContainer}>
              <Text style={styles.emergencyIcon}>✳️</Text>
            </View>
            <Text style={styles.emergencyLabel}>Emergency</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.activityHeader}>
          <Text style={styles.activityHeaderText}>RECENT ACTIVITY</Text>
          <TouchableOpacity>
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.activityList}>
          <ActivityItem 
            icon="📄" 
            title="Summarized Electricity Bill" 
            time="2 mins ago" 
            type="Document Scan" 
          />
          <ActivityItem 
            icon="🔤" 
            title="English to Hindi translation" 
            time="1 hour ago" 
            type="Voice" 
          />
          <ActivityItem 
            icon="📦" 
            title="Medicine Dosage Info" 
            time="Yesterday" 
            type="Assistant" 
          />
        </View>
        
        {/* Extra spacing for bottom nav */}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={[styles.navItem, styles.navItemActive]}>
          <Text style={styles.navIcon}>🎙️</Text>
          <Text style={styles.navLabelActive}>ASSISTANT</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🔍</Text>
          <Text style={styles.navLabel}>SCAN</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🔒</Text>
          <Text style={styles.navLabel}>VAULT</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>✳️</Text>
          <Text style={styles.navLabel}>SOS</Text>
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
    paddingVertical: 15,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoShield: {
    fontSize: 20,
    marginRight: 8,
  },
  logoText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginRight: 10,
  },
  offlineIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  offlineText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  powerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  powerIcon: {
    fontSize: 14,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 15,
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  privacyIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  privacyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  langToggle: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 3,
  },
  langBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  langBtnActive: {
    backgroundColor: '#0F172A',
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  langTextActive: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  greetingContainer: {
    marginVertical: 20,
  },
  greetingTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 40,
  },
  greetingSubtitle: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 8,
    fontWeight: '500',
  },
  micCard: {
    width: '100%',
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  micGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  micIconLarge: {
    fontSize: 32,
  },
  micText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1,
  },
  gridRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 15,
  },
  scanCard: {
    flex: 1,
    height: 140,
    backgroundColor: '#E2E8F0',
    borderRadius: 20,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyCard: {
    flex: 1,
    height: 140,
    backgroundColor: '#B91C1C',
    borderRadius: 20,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridIconContainer: {
    marginBottom: 10,
  },
  gridIcon: {
    fontSize: 28,
  },
  emergencyIcon: {
    fontSize: 32,
    color: '#F8FAFC',
  },
  gridLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  emergencyLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 15,
  },
  activityHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  clearAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  activityList: {
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    padding: 5,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  activityIcon: {
    fontSize: 20,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  activitySubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#94A3B8',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 70,
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: 5,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemActive: {
    backgroundColor: '#1E3A5F',
    margin: 5,
    borderRadius: 15,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  navLabelActive: {
    fontSize: 9,
    fontWeight: '900',
    color: '#F1F5F9',
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
  },
});
