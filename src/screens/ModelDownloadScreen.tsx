import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useModelService } from '../services/ModelService';
import { AppColors } from '../theme';

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

  const allReady =
    modelService.isLLMLoaded &&
    modelService.isSTTLoaded &&
    modelService.isTTSLoaded;// set only after both img + imgProj finish

  const getSingleProgress = (isLoaded: boolean, isDownloading: boolean, isLoading: boolean, progress: number) => {
    if (isLoaded) return 100;
    if (isDownloading) return Math.max(0, Math.min(100, progress));
    if (isLoading) return 99;
    return 0;
  };

  const llmProgress = getSingleProgress(
    modelService.isLLMLoaded,
    modelService.isLLMDownloading,
    modelService.isLLMLoading,
    modelService.llmDownloadProgress,
  );
  const sttProgress = getSingleProgress(
    modelService.isSTTLoaded,
    modelService.isSTTDownloading,
    modelService.isSTTLoading,
    modelService.sttDownloadProgress,
  );
  const ttsProgress = getSingleProgress(
    modelService.isTTSLoaded,
    modelService.isTTSDownloading,
    modelService.isTTSLoading,
    modelService.ttsDownloadProgress,
  );

  const totalProgress = Math.round((llmProgress + sttProgress + ttsProgress) / 3);
  const isAnyDownloading = modelService.isLLMDownloading || modelService.isSTTDownloading || modelService.isTTSDownloading;
  const isAnyLoading = modelService.isLLMLoading || modelService.isSTTLoading || modelService.isTTSLoading;
  const isAnyWorking = isDownloadingAll || modelService.isLLMLoading || modelService.isSTTLoading || modelService.isTTSLoading;
  const allDownloaded = llmProgress >= 100 && sttProgress >= 100 && ttsProgress >= 100;
  const progressTitle = isAnyDownloading
    ? 'Models Downloading'
    : allReady
      ? 'Models Loaded'
      : (allDownloaded || isAnyLoading)
        ? 'Models Downloaded'
        : 'Models Downloading';
  const progressSubtext = isAnyDownloading
    ? 'Downloading models...'
    : allReady
      ? 'All models are loaded and ready.'
      : (allDownloaded || isAnyLoading)
        ? 'Models downloaded. Loading models...'
        : 'Ready to start download.';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Setup Sahayak AI</Text>
        <Text style={styles.subtitle}>
          To provide the best experience, we need to download and load some AI models. This happens only once!
        </Text>

        <View style={styles.cardContainer}>
          <View style={styles.aggregateCard}>
            <View style={styles.aggregateHeader}>
              <Text style={styles.aggregateTitle}>{progressTitle}</Text>
              <Text style={styles.aggregatePercent}>{totalProgress}%</Text>
            </View>

            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${totalProgress}%` }]} />
            </View>

            <Text style={styles.aggregateSubtext}>
              {progressSubtext}
            </Text>
          </View>
        </View>

        <View style={styles.actionContainer}>
          {!allReady ? (
            <TouchableOpacity
              style={[styles.mainButton, isDownloadingAll && styles.disabledButton]}
              onPress={handleDownloadAll}
              disabled={isDownloadingAll}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons
                  name={isDownloadingAll ? 'loading' : 'download'}
                  size={22}
                  color="#FFFFFF"
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.buttonText}>
                  {isDownloadingAll ? 'Downloading Models...' : 'Download & Setup All'}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.mainButton, styles.successButton]}
              onPress={handleStart}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.buttonText}>Let's Get Started!</Text>
                <MaterialCommunityIcons name="arrow-right" size={22} color="#FFFFFF" style={{ marginLeft: 10 }} />
              </View>
            </TouchableOpacity>
          )}

          <Text style={styles.infoText}>
            Total size: ~2GB. Please use Wi-Fi for faster download.
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
    paddingTop: 60,
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
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
  aggregateCard: {
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  aggregateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  aggregateTitle: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '700',
  },
  aggregatePercent: {
    color: '#1B3A5C',
    fontSize: 15,
    fontWeight: '800',
  },
  aggregateSubtext: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 13,
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
    backgroundColor: '#1B3A5C',
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