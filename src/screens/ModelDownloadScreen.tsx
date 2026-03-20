import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useModelService } from '../services/ModelService';
import { AppColors } from '../theme';

const ProgressItem: React.FC<{
  label: string;
  progress: number;
  isDownloading: boolean;
  isLoading: boolean;
  isLoaded: boolean;
}> = ({ label, progress, isDownloading, isLoading, isLoaded }) => {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>{label}</Text>
        <View style={styles.statusContainer}>
          {isLoaded ? (
            <Text style={[styles.cardStatus, { color: AppColors.success }]}>Ready</Text>
          ) : isDownloading ? (
            <Text style={styles.cardStatus}>{Math.round(progress)}%</Text>
          ) : isLoading ? (
            <ActivityIndicator size="small" color={AppColors.accentCyan} />
          ) : (
            <ActivityIndicator size="small" color={AppColors.textMuted} />
          )}
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <View 
          style={[
            styles.progressBarFill, 
            { width: `${isLoaded ? 100 : progress}%`, backgroundColor: isLoaded ? AppColors.success : AppColors.accentCyan }
          ]} 
        />
      </View>
    </View>
  );
};

export const ModelDownloadScreen: React.FC = () => {
  const navigation = useNavigation();
  const modelService = useModelService();
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const handleDownloadAll = async () => {
    setIsDownloadingAll(true);
    try {
      await modelService.downloadAndLoadAllModels();
    } catch (error) {
      console.error('Download all error:', error);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleStart = async () => {
    await modelService.completeSetup();
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      })
    );
  };

  const allReady = modelService.isLLMLoaded && 
                   modelService.isSTTLoaded && 
                   modelService.isTTSLoaded &&
                   modelService.isIMGLoaded;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[AppColors.primaryDark, '#1A1A2E']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.title}>Setup Sahayak AI</Text>
          <Text style={styles.subtitle}>
            To provide the best experience, we need to download and load some AI models. This happens only once!
          </Text>

          <View style={styles.cardContainer}>
            <ProgressItem
              label="Large Language Model (Chat)"
              progress={modelService.llmDownloadProgress}
              isDownloading={modelService.isLLMDownloading}
              isLoading={modelService.isLLMLoading}
              isLoaded={modelService.isLLMLoaded}
            />
            <ProgressItem
              label="Speech to Text (Listen)"
              progress={modelService.sttDownloadProgress}
              isDownloading={modelService.isSTTDownloading}
              isLoading={modelService.isSTTLoading}
              isLoaded={modelService.isSTTLoaded}
            />
            <ProgressItem
              label="Text to Speech (Speak)"
              progress={modelService.ttsDownloadProgress}
              isDownloading={modelService.isTTSDownloading}
              isLoading={modelService.isTTSLoading}
              isLoaded={modelService.isTTSLoaded}
            />
            <ProgressItem
              label="Vision Model (See)"
              progress={modelService.imgDownloadProgress}
              isDownloading={modelService.isIMGDownloading}
              isLoading={modelService.isIMGLoading}
              isLoaded={modelService.isIMGLoaded}
            />
          </View>

          <View style={styles.actionContainer}>
            {!allReady ? (
              <TouchableOpacity
                style={[styles.mainButton, isDownloadingAll && styles.disabledButton]}
                onPress={handleDownloadAll}
                disabled={isDownloadingAll}
              >
                <LinearGradient
                  colors={[AppColors.accentCyan, AppColors.accentViolet]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>
                    {isDownloadingAll ? 'Downloading Models...' : 'Download & Setup All'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.mainButton}
                onPress={handleStart}
              >
                <LinearGradient
                  colors={[AppColors.success, '#1B5E20']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Let's Get Started!</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            <Text style={styles.infoText}>
              Total size: ~500MB. Please use Wi-Fi for faster download.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: AppColors.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
    opacity: 0.8,
  },
  cardContainer: {
    width: '100%',
    marginBottom: 40,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    color: AppColors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  cardStatus: {
    color: AppColors.textSecondary,
    fontSize: 14,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionContainer: {
    width: '100%',
    alignItems: 'center',
  },
  mainButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: AppColors.accentCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.7,
  },
  infoText: {
    color: AppColors.textSecondary,
    fontSize: 13,
    marginTop: 16,
    opacity: 0.6,
  },
});
