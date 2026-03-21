import React, { useRef, useEffect } from 'react';
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
  // Brand
  primary:                  '#005da7',
  primaryContainer:         '#2976c7',
  onPrimary:                '#ffffff',
  primaryFixed:             '#d4e3ff',
  secondary:                '#136a5c',
  secondaryFixed:           '#a4f1e0',
  tertiary:                 '#20637c',
  tertiaryFixed:            '#bde9ff',
  // Surfaces
  background:               '#f6faff',
  surface:                  '#f6faff',
  surfaceContainerLowest:   '#ffffff',
  surfaceContainerLow:      '#eaf5ff',
  surfaceContainerHigh:     '#d9ebfa',
  surfaceContainer:         '#dff0ff',
  // Text
  onSurface:                '#0c1d28',
  onSurfaceVariant:         '#414751',
  outline:                  '#717783',
  outlineVariant:           '#c1c7d3',
  // Tint
  surfaceTint:              '#0060ac',
};

// ─── Navigation Prop ──────────────────────────────────────────────────────────
type SetupScreenProps = {
  navigation: StackNavigationProp<RootStackParamList, 'InitialSetup'>;
};

// ─── Floating Glow (replaces CSS blur-3xl circle) ────────────────────────────
function HeroGlow() {
  const pulse = useRef(new Animated.Value(0.18)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.28, duration: 2000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.18, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.heroGlow, { opacity: pulse }]} />
  );
}

// ─── Preparation Item Row ─────────────────────────────────────────────────────
type PrepItemProps = {
  icon: string;           // emoji
  iconBg: string;
  title: string;
  subtitle: string;
  status: 'pending' | 'done' | 'loading';
};

function PrepItem({ icon, iconBg, title, subtitle, status }: PrepItemProps) {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (status === 'loading') {
      Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
      ).start();
    }
  }, [status]);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const statusIcon =
    status === 'done'    ? '✅' :
    status === 'loading' ? '🔄' : '⏳';

  return (
    <View style={styles.prepItem}>
      <View style={[styles.prepIconBox, { backgroundColor: iconBg }]}>
        <Text style={styles.prepIconEmoji}>{icon}</Text>
      </View>
      <View style={styles.prepTextBlock}>
        <Text style={styles.prepTitle}>{title}</Text>
        <Text style={styles.prepSubtitle}>{subtitle}</Text>
      </View>
      {status === 'loading' ? (
        <Animated.Text style={[styles.prepStatus, { transform: [{ rotate: spin }] }]}>
          🔄
        </Animated.Text>
      ) : (
        <Text style={styles.prepStatus}>{statusIcon}</Text>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const InitialSetup: React.FC<SetupScreenProps> = ({ navigation }) => {
  const {
    isLLMDownloading,
    isSTTDownloading,
    isTTSDownloading,
    isOCRDownloading,
    isLLMLoading,
    isSTTLoading,
    isTTSLoading,
    isOCRLoading,
    isLLMLoaded,
    isSTTLoaded,
    isTTSLoaded,
    isOCRLoaded,
    downloadAndLoadAllModels,
  } = useModelService();

  const downloading =
    isLLMDownloading ||
    isSTTDownloading ||
    isTTSDownloading ||
    isOCRDownloading ||
    isLLMLoading ||
    isSTTLoading ||
    isTTSLoading ||
    isOCRLoading;

  const handleDownload = async () => {
    try {
      await downloadAndLoadAllModels();
      navigation.navigate('Home');
    } catch (error) {
      console.error('Download all models failed:', error);
    }
  };

  const prepItems: PrepItemProps[] = [
    {
      icon: '💬',
      iconBg: AppColors.primaryFixed,
      title: 'AI Chat Assistant',
      subtitle: 'NATURAL LANGUAGE CORE',
      status: isLLMLoaded ? 'done' : (isLLMDownloading || isLLMLoading ? 'loading' : 'pending'),
    },
    {
      icon: '🎙️',
      iconBg: AppColors.secondaryFixed,
      title: 'Voice Recognition',
      subtitle: 'SPEECH-TO-TEXT ENGINE',
      status: isSTTLoaded ? 'done' : (isSTTDownloading || isSTTLoading ? 'loading' : 'pending'),
    },
    {
      icon: '🔊',
      iconBg: AppColors.tertiaryFixed,
      title: 'Voice Response',
      subtitle: 'NEURAL TEXT-TO-SPEECH',
      status: isTTSLoaded ? 'done' : (isTTSDownloading || isTTSLoading ? 'loading' : 'pending'),
    },
    {
      icon: '🧾',
      iconBg: AppColors.secondaryFixed,
      title: 'Medicine Detection',
      subtitle: 'IMAGE OCR DETECTION',
      status: isOCRLoaded ? 'done' : (isOCRDownloading || isOCRLoading ? 'loading' : 'pending'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.background} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🏥</Text>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Sahayak AI</Text>
          <Text style={styles.headerSubtitle}>Setting up your Healthcare Assistant</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Illustration ── */}
        <View style={styles.heroContainer}>
          <HeroGlow />
          {/* Circular surface — mirrors surface-container-low rounded-full */}
          <LinearGradient
            colors={[AppColors.surfaceContainerLow, AppColors.surfaceContainer]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.heroCircle}
          >
            <Text style={styles.heroMainIcon}>📋</Text>
            <View style={styles.heroSubIconRow}>
              <Text style={styles.heroSubIcon}>🧠</Text>
              <Text style={styles.heroSubIcon}>☁️</Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── Messaging ── */}
        <View style={styles.messagingBlock}>
          <Text style={styles.messagingTitle}>Preparing Your Digital Sanctuary</Text>
          <Text style={styles.messagingBody}>
            To enable offline healthcare support, the app needs to download essential AI models.
            This is a one-time setup.
          </Text>
        </View>

        {/* ── Preparation List ── */}
        <View style={styles.prepList}>
          {prepItems.map((item, i) => (
            <PrepItem key={i} {...item} />
          ))}
        </View>

        {/* ── CTA ── */}
        <View style={styles.actionsBlock}>
          {/* Gradient button — same pattern as HomeScreen mic */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleDownload}
            disabled={downloading}
            style={styles.downloadBtnWrapper}
          >
            <LinearGradient
              colors={[AppColors.primary, AppColors.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.downloadBtn, downloading && styles.downloadBtnDisabled]}
            >
              <Text style={styles.downloadBtnText}>
                {downloading ? 'Downloading…' : 'Download & Setup'}
              </Text>
              <Text style={styles.downloadBtnIcon}>{downloading ? '⏳' : '⬇️'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Info Banner — mirrors privacyBanner from old HomeScreen */}
          <View style={styles.infoBanner}>
            <View style={styles.infoBannerAccent} />
            <Text style={styles.infoBannerIcon}>ℹ️</Text>
            <Text style={styles.infoBannerText}>
              Approx. 500MB required. This may take a few minutes. Please keep the app open.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>SECURE & PRIVATE HEALTHCARE AI</Text>
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: AppColors.surface,
  },
  headerIcon: {
    fontSize: 26,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: AppColors.onSurface,
    letterSpacing: -0.3,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
  },
  headerSubtitle: {
    fontSize: 12,
    color: AppColors.onSurfaceVariant,
    fontWeight: '500',
    marginTop: 1,
  },

  // Scroll
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },

  // Hero
  heroContainer: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 32,
  },
  heroGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: AppColors.secondaryFixed,
  },
  heroCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  heroMainIcon: {
    fontSize: 72,
    marginBottom: 12,
  },
  heroSubIconRow: {
    flexDirection: 'row',
    gap: 16,
  },
  heroSubIcon: {
    fontSize: 32,
  },

  // Messaging
  messagingBlock: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 12,
  },
  messagingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.onSurface,
    textAlign: 'center',
    letterSpacing: -0.4,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
  },
  messagingBody: {
    fontSize: 14,
    color: AppColors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '400',
  },

  // Prep List
  prepList: {
    width: '100%',
    gap: 12,
    marginBottom: 40,
  },
  prepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: AppColors.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    // Tinted shadow — same style as old HomeScreen cardWhite
    shadowColor: AppColors.onSurface,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  prepIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prepIconEmoji: {
    fontSize: 22,
  },
  prepTextBlock: {
    flex: 1,
    gap: 3,
  },
  prepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.onSurface,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  prepSubtitle: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.onSurfaceVariant,
    letterSpacing: 1.0,
    textTransform: 'uppercase',
  },
  prepStatus: {
    fontSize: 20,
  },

  // CTA
  actionsBlock: {
    width: '100%',
    gap: 16,
    alignItems: 'center',
  },
  downloadBtnWrapper: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
    // Tinted shadow like old HomeScreen mic
    shadowColor: AppColors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    borderRadius: 999,
  },
  downloadBtnDisabled: {
    opacity: 0.7,
  },
  downloadBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.onPrimary,
    letterSpacing: 0.2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
  },
  downloadBtnIcon: {
    fontSize: 18,
  },

  // Info Banner — mirrors privacyBanner from HomeScreen
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    width: '100%',
    backgroundColor: AppColors.surfaceContainerLow,
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  infoBannerAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: AppColors.primary,
    opacity: 0.2,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  infoBannerIcon: {
    fontSize: 16,
    marginTop: 1,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: AppColors.onSurfaceVariant,
    lineHeight: 18,
    fontWeight: '400',
  },

  // Footer
  footer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 10,
    fontWeight: '600',
    color: AppColors.outline,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});