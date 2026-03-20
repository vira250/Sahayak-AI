import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { useModelService } from '../services/ModelService';

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const AppColors = {
  primary:                  '#005da7',
  primaryContainer:         '#2976c7',
  primaryFixed:             '#d4e3ff',
  primaryFixedDim:          '#a4c9ff',
  onPrimary:                '#ffffff',
  onPrimaryFixed:           '#001c39',
  secondary:                '#136a5c',
  secondaryContainer:       '#a1eedd',
  secondaryFixed:           '#a4f1e0',
  secondaryFixedDim:        '#88d5c4',
  onSecondaryContainer:     '#1b6e61',
  tertiary:                 '#20637c',
  tertiaryFixed:            '#bde9ff',
  tertiaryContainer:        '#3e7c95',
  onTertiary:               '#ffffff',
  surface:                  '#f6faff',
  surfaceContainerLowest:   '#ffffff',
  surfaceContainerLow:      '#eaf5ff',
  surfaceContainer:         '#dff0ff',
  surfaceContainerHigh:     '#d9ebfa',
  surfaceContainerHighest:  '#d3e5f4',
  onSurface:                '#0c1d28',
  onSurfaceVariant:         '#414751',
  outlineVariant:           '#c1c7d3',
  outline:                  '#717783',
};

// ─── Navigation Prop ──────────────────────────────────────────────────────────
type HomeScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'Home'>;
};

// ─── Pulsing Voice Orb ────────────────────────────────────────────────────────
type VoiceOrbProps = { onPress: () => void };

function VoiceOrb({ onPress }: VoiceOrbProps) {
  const glowScale   = useRef(new Animated.Value(1.25)).current;
  const glowOpacity = useRef(new Animated.Value(0.4)).current;
  const orbScale    = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale,   { toValue: 1.5,  duration: 1400, useNativeDriver: true }),
          Animated.timing(glowScale,   { toValue: 1.25, duration: 1400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 0.15, duration: 1400, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.4,  duration: 1400, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  const handlePressIn  = () =>
    Animated.spring(orbScale, { toValue: 0.93, useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.spring(orbScale, { toValue: 1,    useNativeDriver: true }).start();

  return (
    <View style={styles.orbWrapper}>
      {/* Outer ambient glow */}
      <Animated.View
        style={[styles.orbGlow, { transform: [{ scale: glowScale }], opacity: glowOpacity }]}
      />
      {/* Orb */}
      <Animated.View style={{ transform: [{ scale: orbScale }] }}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <LinearGradient
            colors={[AppColors.primary, AppColors.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orb}
          >
            <Text style={styles.orbMic}>🎤</Text>
            <Text style={styles.orbLabel}>TAP TO SPEAK</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Suggestion Card ──────────────────────────────────────────────────────────
type SuggestionCardProps = {
  icon: string;
  iconBg: string;
  label: string;
  onPress: () => void;
};

function SuggestionCard({ icon, iconBg, label, onPress }: SuggestionCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={styles.suggestionCard}
    >
      <View style={[styles.suggestionIconBox, { backgroundColor: iconBg }]}>
        <Text style={styles.suggestionIcon}>{icon}</Text>
      </View>
      <Text style={styles.suggestionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Bottom Tab Item ──────────────────────────────────────────────────────────
type TabItemProps = {
  icon: string;
  label: string;
  active: boolean;
  onPress: () => void;
};

function TabItem({ icon, label, active, onPress }: TabItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.tabItem, active && styles.tabItemActive]}
    >
      <Text style={[styles.tabIcon, active && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Offline Status Pill ──────────────────────────────────────────────────────
function OfflineReadyPill() {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusPillIcon}>✅</Text>
      <Text style={styles.statusPillText}>Offline AI Ready</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState(0);
  const modelService = useModelService();

  const handleVoicePress = () => {
    navigation.navigate('Chat', { startVoice: true });
  };

  const handleStartChat = () => {
    navigation.navigate('Chat');
  };

  const handleLogoPress = () => {
    navigation.navigate('Chat');
  };

  const handleToolsPress = () => {
    navigation.navigate('ToolCalling');
  };

  const handleHealthLog = () => {
    // TODO: Implement health log
    console.log('Health log pressed');
  };

  const handleProfile = () => {
    // TODO: Implement profile
    console.log('Profile pressed');
  };

  const handleSettingsPress = () => {
    console.log('Settings pressed');
  };

  const tabs = [
    { icon: '🏠', label: 'Home' },
    { icon: '📋', label: 'Health Log' },
    { icon: '✨', label: 'Sahayak AI' },
    { icon: '👤', label: 'Profile' },
  ];

  const suggestions: SuggestionCardProps[] = [
    {
      icon: '💊',
      iconBg: AppColors.tertiaryFixed,
      label: 'Identify this medicine',
      onPress: handleStartChat,
    },
    {
      icon: '🛡️',
      iconBg: AppColors.secondaryFixed,
      label: 'Is this tablet safe?',
      onPress: handleStartChat,
    },
    {
      icon: '📄',
      iconBg: AppColors.primaryFixed,
      label: 'Explain this report',
      onPress: handleStartChat,
    },
    {
      icon: '🔍',
      iconBg: AppColors.surfaceContainerHighest,
      label: 'Check this object',
      onPress: handleStartChat,
    },
  ];

  const tabHandlers = [
    () => setActiveTab(0),
    handleHealthLog,
    handleStartChat,
    handleProfile,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.surfaceContainerLow} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} onPress={handleLogoPress}>
          <Text style={styles.headerLogo}>🌐</Text>
          <Text style={styles.headerTitle}>Sahayak AI</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={handleSettingsPress}
          activeOpacity={0.75}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Sahayak AI</Text>
          <Text style={styles.heroSubtitle}>Your AI Healthcare Assistant</Text>
        </View>

        {/* Voice Orb */}
        <View style={styles.orbSection}>
          <VoiceOrb onPress={handleVoicePress} />
          <Text style={styles.orbHint}>Ask anything by voice, text, or image.</Text>
        </View>

        {/* Secondary Action Buttons */}
        <View style={styles.secondaryActions}>
          {/* Start Chat */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleStartChat}
            style={styles.actionBtnChat}
          >
            <Text style={styles.actionBtnIcon}>💬</Text>
            <Text style={styles.actionBtnTextDark}>Start Chat</Text>
          </TouchableOpacity>

          {/* Upload / Capture */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleStartChat}
            style={styles.actionBtnCapture}
          >
            <Text style={styles.actionBtnIcon}>📷</Text>
            <Text style={styles.actionBtnTextGreen}>Upload / Capture Image</Text>
          </TouchableOpacity>
        </View>

        {/* Offline Status */}
        <View style={styles.statusRow}>
          <OfflineReadyPill />
        </View>

        {/* Quick Suggestions */}
        <View style={styles.suggestionsSection}>
          <Text style={styles.sectionTitle}>Quick Suggestions</Text>
          <View style={styles.suggestionsGrid}>
            {suggestions.map((s, i) => (
              <SuggestionCard key={i} {...s} />
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom Navigation ── */}
      <View style={styles.bottomNav}>
        {tabs.map((tab, i) => (
          <TabItem
            key={i}
            icon={tab.icon}
            label={tab.label}
            active={activeTab === i}
            onPress={tabHandlers[i]}
          />
        ))}
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.surface,
  },

  // Header — tonal shift using surfaceContainerLow (#eaf5ff)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingVertical: 10,
    backgroundColor: AppColors.surfaceContainerLow,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    fontSize: 22,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.primary,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
  },
  settingsBtn: {
    padding: 8,
    borderRadius: 999,
  },
  settingsIcon: {
    fontSize: 22,
  },

  // Scroll
  scrollContent: {
    paddingBottom: 32,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 4,
    gap: 6,
  },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: AppColors.onSurface,
    letterSpacing: -0.8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
  },
  heroSubtitle: {
    fontSize: 17,
    fontWeight: '500',
    color: AppColors.onSurfaceVariant,
  },

  // Orb
  orbSection: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 24,
  },
  orbWrapper: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbGlow: {
    position: 'absolute',
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: AppColors.primary,
  },
  orb: {
    width: 192,
    height: 192,
    borderRadius: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    // active-mic-glow equivalent
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 40,
    elevation: 14,
  },
  orbMic: {
    fontSize: 52,
  },
  orbLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.onPrimary,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  orbHint: {
    fontSize: 14,
    fontWeight: '500',
    color: AppColors.onSurfaceVariant,
    textAlign: 'center',
  },

  // Secondary Actions
  secondaryActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 24,
  },
  actionBtnChat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.primaryFixed,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  actionBtnCapture: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.secondaryContainer,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  actionBtnIcon: {
    fontSize: 18,
  },
  actionBtnTextDark: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.onPrimaryFixed,
  },
  actionBtnTextGreen: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.onSecondaryContainer,
  },

  // Status
  statusRow: {
    alignItems: 'center',
    marginBottom: 32,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: AppColors.secondaryFixed + '55',
  },
  statusPillIcon: {
    fontSize: 13,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.secondary,
  },

  // Suggestions
  suggestionsSection: {
    paddingHorizontal: 24,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.onSurface,
    letterSpacing: -0.3,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
  },
  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  suggestionCard: {
    // ~50% width minus gap
    width: '47%',
    backgroundColor: AppColors.surfaceContainerLow,
    borderRadius: 14,
    padding: 20,
    gap: 16,
  },
  suggestionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionIcon: {
    fontSize: 20,
  },
  suggestionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.onSurface,
    lineHeight: 18,
  },

  // Bottom Nav
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.75)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: AppColors.onSurface,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 999,
    gap: 3,
  },
  tabItemActive: {
    backgroundColor: AppColors.primaryFixed,
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: AppColors.onSurfaceVariant,
    opacity: 0.6,
  },
  tabLabelActive: {
    color: AppColors.primary,
    fontWeight: '700',
    opacity: 1,
  },
});
