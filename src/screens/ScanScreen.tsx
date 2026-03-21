import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import { RunAnywhere } from '@runanywhere/core';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useModelService } from '../services/ModelService';
import { RootStackParamList } from '../navigation/types';
import { RoomService } from '../services/RoomService';
import { playBase64Audio } from '../utils/AudioPlayer';

const { width } = Dimensions.get('window');

// The prompt that tells the VLM what to do with the image
const VISION_PROMPT = `Look at this image carefully and identify what it shows. Then provide helpful analysis:

If this is a MEDICINE or MEDICATION:
- Name of the medicine
- What it is used for
- When and how to take it
- Common side effects
- Important precautions
- Disclaimer: consult a doctor for medical advice

If this shows an INJURY, WOUND, or MEDICAL EMERGENCY:
- What type of injury this appears to be
- Immediate first aid steps
- What NOT to do
- When to seek emergency help (call 112)
- Temporary treatment until help arrives

If this is a DOCUMENT, BILL, or FORM:
- Summary of the contents
- Key information (dates, amounts, names)
- Action items if any

For ANYTHING ELSE:
- Describe what you see
- Provide any useful information

Be concise and use bullet points. Start by stating what you identified in the image.`;

export const ScanScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const modelService = useModelService();
  const [capturedImage, setCapturedImage] = useState<Asset | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExtractingText, setIsExtractingText] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const responseRef = useRef('');

  const requestCameraPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'Sahayak AI needs camera access to scan items',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }, []);

  const handleCameraCapture = useCallback(async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to scan items.');
      return;
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
        saveToPhotos: false,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Camera Error', response.errorMessage || 'Failed to capture photo');
          return;
        }
        if (response.assets && response.assets[0]) {
          setCapturedImage(response.assets[0]);
          setAnalysisResult('');
          setStatusMessage('');
        }
      },
    );
  }, [requestCameraPermission]);

  const handleGalleryPick = useCallback(() => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
      },
      (response) => {
        if (response.didCancel) return;
        if (response.errorCode) {
          Alert.alert('Gallery Error', response.errorMessage || 'Failed to pick photo');
          return;
        }
        if (response.assets && response.assets[0]) {
          setCapturedImage(response.assets[0]);
          setAnalysisResult('');
          setStatusMessage('');
        }
      },
    );
  }, []);

  // Ensure VLM is downloaded and loaded
  const ensureVLMReady = useCallback(async (): Promise<boolean> => {
    // Step 1: Check if VLM is already loaded
    try {
      const loaded = await RunAnywhere.isVLMModelLoaded();
      if (loaded) {
        console.log('VLM already loaded');
        return true;
      }
    } catch (e) {
      console.log('isVLMModelLoaded check failed:', e);
    }

    // Step 2: Get or download VLM text model
    setStatusMessage('Checking vision model...');

    let textModelPath: string | null = null;
    let projectorPath: string | null = null;

    try {
      // Check if text model is downloaded
      const textInfo = await RunAnywhere.getModelInfo('nanollava-q4_0');
      const textDownloaded = !!textInfo?.localPath;

      if (textDownloaded) {
        textModelPath = await RunAnywhere.getModelPath('nanollava-q4_0');
        console.log('VLM text model already downloaded:', textModelPath);
      } else {
        setStatusMessage('Downloading vision model (1/2)...');
        setDownloadProgress(0);
        textModelPath = await RunAnywhere.downloadModel('nanollava-q4_0', (p) => {
          setDownloadProgress(Math.round(p.progress * 100));
          setStatusMessage(`Downloading vision model (1/2)... ${Math.round(p.progress * 100)}%`);
        });
        console.log('VLM text model downloaded:', textModelPath);
      }
    } catch (e: any) {
      console.error('Failed to get/download VLM text model:', e);
      setStatusMessage('❌ Failed to download vision model');
      return false;
    }

    try {
      // Check if projector is downloaded
      const projInfo = await RunAnywhere.getModelInfo('nanollava-mmproj-f16');
      const projDownloaded = !!projInfo?.localPath;

      if (projDownloaded) {
        projectorPath = await RunAnywhere.getModelPath('nanollava-mmproj-f16');
        console.log('VLM projector already downloaded:', projectorPath);
      } else {
        setStatusMessage('Downloading vision projector (2/2)...');
        setDownloadProgress(0);
        projectorPath = await RunAnywhere.downloadModel('nanollava-mmproj-f16', (p) => {
          setDownloadProgress(Math.round(p.progress * 100));
          setStatusMessage(`Downloading vision projector (2/2)... ${Math.round(p.progress * 100)}%`);
        });
        console.log('VLM projector downloaded:', projectorPath);
      }
    } catch (e: any) {
      console.error('Failed to get/download VLM projector:', e);
      setStatusMessage('❌ Failed to download vision projector');
      return false;
    }

    if (!textModelPath || !projectorPath) {
      setStatusMessage('❌ Could not locate model files');
      return false;
    }

    // Step 3: Unload the text LLM (llama.cpp can only hold one model)
    setStatusMessage('Preparing vision model...');
    try {
      await RunAnywhere.unloadModel();
      console.log('Text LLM unloaded');
    } catch (e) {
      console.log('unloadModel (harmless if not loaded):', e);
    }

    // Step 4: Load VLM
    setStatusMessage('Loading vision model...');
    try {
      const success = await RunAnywhere.loadVLMModel(textModelPath, projectorPath);
      if (success) {
        console.log('VLM loaded successfully!');
        setStatusMessage('Vision model ready!');
        return true;
      } else {
        console.error('loadVLMModel returned false');
        setStatusMessage('❌ Vision model failed to load');
        return false;
      }
    } catch (e: any) {
      console.error('loadVLMModel error:', e);
      setStatusMessage(`❌ Vision model error: ${e?.message || e}`);
      return false;
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!capturedImage?.uri) {
      Alert.alert('No Image', 'Please capture or select an image first.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult('');
    setStatusMessage('');
    setDownloadProgress(0);
    responseRef.current = '';

    // Build the prompt
    let prompt = VISION_PROMPT;
    if (additionalContext.trim()) {
      prompt += `\n\nUser context: "${additionalContext.trim()}"`;
    }

    // Get the image path
    let imagePath = capturedImage.uri || '';
    if (imagePath.startsWith('file://')) {
      imagePath = imagePath.substring(7);
    }

    try {
      // Ensure VLM is ready (download + load if needed)
      const vlmReady = await ensureVLMReady();

      if (!vlmReady) {
        setAnalysisResult(
          '❌ Could not load the Vision AI model. This may be due to:\n\n' +
          '• Insufficient device memory (needs ~1GB free RAM)\n' +
          '• Download interrupted — try again with stable internet\n' +
          '• Model files corrupted — restart the app and try again\n\n' +
          'Tip: Close other apps to free memory and try again.',
        );
        setIsAnalyzing(false);
        return;
      }

      // Analyze the image with VLM
      setStatusMessage('Analyzing image...');

      try {
        // Try streaming first
        await RunAnywhere.analyzeImageStream(
          imagePath,
          prompt,
          (token: string) => {
            responseRef.current += token;
            setAnalysisResult(responseRef.current);
            setStatusMessage(''); // Hide status once we start getting results
          },
        );
      } catch (streamErr: any) {
        console.warn('analyzeImageStream failed, trying non-streaming:', streamErr);
        // Fallback to non-streaming
        try {
          const result = await RunAnywhere.analyzeImage(imagePath, prompt);
          const parsed = typeof result === 'string' ? result : JSON.stringify(result);
          setAnalysisResult(parsed);
        } catch (analyzeErr: any) {
          console.error('analyzeImage also failed:', analyzeErr);
          setAnalysisResult(
            `❌ Image analysis failed: ${analyzeErr?.message || analyzeErr}\n\n` +
            'The vision model may not support this image format.\n' +
            'Try taking a clearer, well-lit photo.',
          );
        }
      }
    } catch (error: any) {
      console.error('Scan analysis error:', error);
      setAnalysisResult(`❌ Error: ${error?.message || 'Analysis failed'}\n\nPlease try again.`);
    } finally {
      setIsAnalyzing(false);
      setStatusMessage('');
      setDownloadProgress(0);
    }
  }, [capturedImage, additionalContext, ensureVLMReady]);

  const handleReset = useCallback(() => {
    setCapturedImage(null);
    setAnalysisResult('');
    setAdditionalContext('');
    setStatusMessage('');
    setDownloadProgress(0);
    responseRef.current = '';
  }, []);

  const handleExtractText = useCallback(async () => {
    if (!capturedImage?.uri) {
      Alert.alert('No Image', 'Please capture or select an image first.');
      return;
    }

    setIsExtractingText(true);
    setStatusMessage('Extracting text...');

    try {
      const result = await TextRecognition.recognize(capturedImage.uri);
      
      if (!result || !result.text) {
        Alert.alert('No Text Found', 'Could not find any text in this image.');
        setIsExtractingText(false);
        setStatusMessage('');
        return;
      }

      setStatusMessage('Creating chat room...');
      const ocrText = result.text;
      const roomId = await RoomService.createRoom(ocrText);
      
      handleReset();
      navigation.navigate('Chat', { roomId });
    } catch (error: any) {
      console.error('OCR Error:', error);
      Alert.alert('OCR Failed', error.message || 'Failed to extract text.');
    } finally {
      setIsExtractingText(false);
      setStatusMessage('');
    }
  }, [capturedImage, navigation, handleReset]);

  const handlePlayTTS = async () => {
    if (!analysisResult) return;
    try {
      if (!modelService.isTTSLoaded) {
        Alert.alert('TTS Not Loaded', 'Please wait for the Text-to-Speech model to load.');
        return;
      }
      setStatusMessage('Synthesizing speech...');
      const cleanResult = analysisResult.replace(/[*#]/g, ''); // Basic markdown symbol cleanup
      const synthResult = await RunAnywhere.synthesize(cleanResult, { voice: '0', rate: 1.0 });
      
      if (synthResult.audioData) {
        setStatusMessage('Playing audio...');
        await playBase64Audio(synthResult.audioData);
        setStatusMessage('');
      }
    } catch (error) {
      console.error('TTS Error:', error);
      Alert.alert('Playback Failed', 'Could not synthesize or play audio.');
      setStatusMessage('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerDot}>●</Text>
          <Text style={styles.headerTitle}>Sahayak AI</Text>
        </View>
        <TouchableOpacity style={styles.headerSettingsBtn}>
          <Text style={styles.headerSettingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Viewfinder Card */}
        <View style={styles.viewfinderCard}>
          {capturedImage?.uri ? (
            <TouchableOpacity onPress={handleReset} activeOpacity={0.9} style={styles.imagePreviewContainer}>
              <Image source={{ uri: capturedImage.uri }} style={styles.imagePreview} />
              {/* Scan corners */}
              <View style={[styles.cornerTL, styles.corner]} />
              <View style={[styles.cornerTR, styles.corner]} />
              <View style={[styles.cornerBL, styles.corner]} />
              <View style={[styles.cornerBR, styles.corner]} />
              <View style={styles.retakeBadge}>
                <Text style={styles.retakeText}>Tap to retake</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderLabel}>Point at medicine or object</Text>
              <View style={styles.viewfinderFrame}>
                {/* Scan corners */}
                <View style={[styles.cornerTL, styles.corner]} />
                <View style={[styles.cornerTR, styles.corner]} />
                <View style={[styles.cornerBL, styles.corner]} />
                <View style={[styles.cornerBR, styles.corner]} />
                <Text style={styles.placeholderIcon}>📷</Text>
              </View>
            </View>
          )}

          {/* Camera/Gallery Buttons */}
          <View style={styles.captureButtons}>
            <TouchableOpacity style={styles.captureBtn} onPress={handleCameraCapture}>
              <View style={styles.captureBtnInner}>
                <Text style={styles.captureBtnIcon}>📸</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureBtn} onPress={handleGalleryPick}>
              <View style={[styles.captureBtnInner, styles.galleryBtnInner]}>
                <Text style={styles.captureBtnIcon}>🖼️</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Context Input */}
        <View style={styles.contextSection}>
          <View style={styles.contextInputRow}>
            <TextInput
              style={styles.contextInput}
              placeholder="Add context or ask a question..."
              placeholderTextColor="#94A3B8"
              value={additionalContext}
              onChangeText={setAdditionalContext}
              multiline
              numberOfLines={1}
            />
            <TouchableOpacity style={styles.contextActionBtn}>
              <Text style={styles.contextActionIcon}>✨</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Analyze Scan Button */}
        <TouchableOpacity
          style={[styles.analyzeBtn, (!capturedImage || isAnalyzing || isExtractingText) && styles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={!capturedImage || isAnalyzing || isExtractingText}
        >
          {isAnalyzing ? (
            <View style={styles.analyzingRow}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.analyzeBtnText}>
                {statusMessage || 'Analyzing...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.analyzeBtnText}>Analyze Scan</Text>
          )}
        </TouchableOpacity>

        {/* OCR Button */}
        <TouchableOpacity
          style={[styles.ocrBtn, (!capturedImage || isAnalyzing || isExtractingText) && styles.analyzeBtnDisabled]}
          onPress={handleExtractText}
          disabled={!capturedImage || isAnalyzing || isExtractingText}
        >
          {isExtractingText ? (
            <View style={styles.analyzingRow}>
              <ActivityIndicator size="small" color="#1B3A5C" />
              <Text style={styles.ocrBtnText}>
                {statusMessage || 'Extracting...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.ocrBtnText}>📄 Extract Text (OCR)</Text>
          )}
        </TouchableOpacity>

        {/* Download Progress Bar */}
        {isAnalyzing && downloadProgress > 0 && downloadProgress < 100 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${downloadProgress}%` }]} />
            </View>
            <Text style={styles.progressText}>{downloadProgress}%</Text>
          </View>
        )}

        {/* Status Message */}
        {isAnalyzing && statusMessage && !analysisResult ? (
          <View style={styles.statusCard}>
            <ActivityIndicator size="small" color="#1B3A5C" />
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        ) : null}

        {/* Results */}
        {analysisResult ? (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.resultHeaderIcon}>🧠</Text>
                <Text style={styles.resultHeaderText}>AI Analysis</Text>
              </View>
              <TouchableOpacity onPress={handlePlayTTS} style={styles.ttsBtn} disabled={isAnalyzing}>
                <Text style={styles.ttsIcon}>🔊</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.resultDivider} />
            <Text style={styles.resultText} selectable>
              {analysisResult}
            </Text>
            {isAnalyzing && (
              <View style={styles.streamingIndicator}>
                <ActivityIndicator size="small" color="#1B3A5C" />
                <Text style={styles.streamingText}>Generating...</Text>
              </View>
            )}
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerDot: {
    fontSize: 16,
    color: '#1B3A5C',
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  headerSettingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F4F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSettingsIcon: {
    fontSize: 18,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  viewfinderCard: {
    backgroundColor: '#F0F4F8',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
  },
  imagePreviewContainer: {
    width: '100%',
    height: width - 72,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderContainer: {
    width: '100%',
    alignItems: 'center',
  },
  placeholderLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textAlign: 'center',
  },
  viewfinderFrame: {
    width: '100%',
    height: width * 0.6,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  placeholderIcon: {
    fontSize: 48,
    opacity: 0.4,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#1B3A5C',
    borderWidth: 3,
  },
  cornerTL: {
    top: 12,
    left: 12,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 12,
    right: 12,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 12,
    left: 12,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 12,
    right: 12,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  retakeBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(27, 58, 92, 0.8)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  captureButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 16,
  },
  captureBtn: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  captureBtnInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1B3A5C',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#1B3A5C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  galleryBtnInner: {
    backgroundColor: '#2B5F8E',
  },
  captureBtnIcon: {
    fontSize: 22,
  },
  contextSection: {
    marginBottom: 16,
  },
  contextInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  contextInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 12,
    minHeight: 46,
  },
  contextActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  contextActionIcon: {
    fontSize: 16,
  },
  analyzeBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#1B3A5C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#1B3A5C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  analyzeBtnDisabled: {
    opacity: 0.5,
    elevation: 0,
  },
  analyzeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  ocrBtn: {
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E8EEF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#1B3A5C',
  },
  ocrBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1B3A5C',
    letterSpacing: 0.3,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1B3A5C',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1B3A5C',
    width: 40,
    textAlign: 'right',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4F8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  resultCard: {
    backgroundColor: '#F0F4F8',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  resultHeaderIcon: {
    fontSize: 22,
  },
  resultHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  ttsBtn: {
    padding: 6,
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    marginLeft: 'auto',
  },
  ttsIcon: {
    fontSize: 18,
  },
  resultDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  resultText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  streamingText: {
    fontSize: 13,
    color: '#1B3A5C',
    fontWeight: '500',
  },
});
