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
            <ActivityIndicator size="small" color="#1B3A5C" />
          ) : (
            <ActivityIndicator size="small" color={AppColors.textMuted} />
          )}
        </View>
      </View>
      <View style={styles.progressBarBg}>
        <View 
          style={[
            styles.progressBarFill, 
            { width: `${isLoaded ? 100 : progress}%`, backgroundColor: isLoaded ? AppColors.success : '#1B3A5C' }
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
              <Text style={styles.buttonText}>
                {isDownloadingAll ? 'Downloading Models...' : 'Download & Setup All'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.mainButton, styles.successButton]}
              onPress={handleStart}
            >
              <Text style={styles.buttonText}>Let's Get Started!</Text>
            </TouchableOpacity>
          )}
          
          <Text style={styles.infoText}>
            Total size: ~500MB. Please use Wi-Fi for faster download.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 80,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
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
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '600',
  },
  cardStatus: {
    color: '#64748B',
    fontSize: 14,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E2E8F0',
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
    backgroundColor: '#1B3A5C',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1B3A5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  successButton: {
    backgroundColor: AppColors.success,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.7,
  },
  infoText: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 16,
    opacity: 0.6,
  },
});
