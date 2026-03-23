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
  NativeModules,
} from 'react-native';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import { RunAnywhere } from '@runanywhere/core';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useModelService } from '../services/ModelService';
import { RootStackParamList } from '../navigation/types';
import { ChatBackend } from '../services/ChatBackendBridge';
import { playBase64Audio } from '../utils/AudioPlayer';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { BottomNav } from '../components';
import { AuditTimelineService } from '../services/AuditTimelineService';
import { classifySymptomText } from '../services/SymptomClassifier';

const { width } = Dimensions.get('window');
const MAX_OCR_CHARS = 8000;

const OCR_SUMMARY_PROMPT = `You are Dr. Sahayak, a medical assistant.

You will receive OCR text extracted from an image or PDF. Your task is text-only analysis.
Do not claim to see the image. Use only OCR text and user context.

Output format:
• Section 1 - Key Summary (4-8 bullets)
• Section 2 - Important Values/Findings (if any)
• Section 3 - Actionable Next Steps
• Section 4 - Red Flags / Emergency Signs

Rules:
• If OCR text is noisy or incomplete, say so clearly.
• If medical info is present, be cautious and non-diagnostic.
• End with: "⚠️ Disclaimer: This is AI-assisted guidance, not a medical diagnosis. Consult a qualified doctor."
• Use concise bullet points only.`;


export const ScanScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const modelService = useModelService();
  const [capturedImage, setCapturedImage] = useState<Asset | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<{ uri: string; name?: string; size?: number } | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const responseRef = useRef('');

  const isDocumentPickerAvailable = useCallback(() => {
    if ((NativeModules as any)?.RNDocumentPicker) {
      return true;
    }

    const turboProxy = (global as any)?.__turboModuleProxy;
    if (typeof turboProxy === 'function') {
      try {
        return !!turboProxy('RNDocumentPicker');
      } catch {
        return false;
      }
    }

    return false;
  }, []);

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
          setSelectedPdf(null);
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
          setSelectedPdf(null);
          setAnalysisResult('');
          setStatusMessage('');
        }
      },
    );
  }, []);

  const handlePdfPick = useCallback(async () => {
    try {
      if (!isDocumentPickerAvailable()) {
        Alert.alert(
          'PDF Picker Not Ready',
          'PDF picker native module is not loaded yet. Please reinstall the app build and restart Metro.',
        );
        return;
      }

      const picker = require('@react-native-documents/picker');

      const result = await picker.pick({
        type: [picker.types.pdf],
        mode: 'open',
      });
      const file = result[0];

      setSelectedPdf({
        uri: file.uri,
        name: file.name || 'document.pdf',
        size: file.size || undefined,
      });
      setCapturedImage(null);
      setAnalysisResult('');
      setStatusMessage('');
    } catch (error: any) {
      const picker = require('@react-native-documents/picker');
      if (picker.isErrorWithCode(error) && error.code === picker.errorCodes.OPERATION_CANCELED) {
        return;
      }
      Alert.alert('PDF Error', error?.message || 'Failed to pick PDF');
    }
  }, [isDocumentPickerAvailable]);



  const handleAnalyze = useCallback(async () => {
    if (!capturedImage?.uri && !selectedPdf?.uri) {
      Alert.alert('No File Selected', 'Please capture/select an image or upload a PDF first.');
      return;
    }

    if (selectedPdf?.uri && Platform.OS !== 'android') {
      Alert.alert('PDF OCR Not Available', 'PDF OCR is currently available on Android in this build.');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult('');
    setStatusMessage('');
    setDownloadProgress(0);
    responseRef.current = '';

    try {
      // Step 1: Extract text via OCR from image or PDF
      let extractedText = '';
      try {
        if (selectedPdf?.uri) {
          setStatusMessage('Scanning PDF pages for text...');
          extractedText = await ChatBackend.extractTextFromPdf(selectedPdf.uri, 3);
        } else if (capturedImage?.uri) {
          setStatusMessage('Scanning image for text...');
          const ocrResult = await TextRecognition.recognize(capturedImage.uri);
          extractedText = ocrResult?.text || '';
        }

        if (extractedText) {
          extractedText = await ChatBackend.cleanOCRText(extractedText);
          if (extractedText.length > MAX_OCR_CHARS) {
            extractedText = extractedText.slice(0, MAX_OCR_CHARS);
            setStatusMessage('OCR text is large, summarizing first section...');
          }
        }
        console.log('OCR extracted text length:', extractedText.length);
      } catch (ocrErr: any) {
        console.warn('OCR extraction failed (non-fatal):', ocrErr?.message || ocrErr);
        // Continue even if OCR fails — user may have provided context
      }

      if (!extractedText && !additionalContext.trim()) {
        setAnalysisResult(
          `⚠️ No text could be extracted from this ${selectedPdf ? 'PDF' : 'image'} and no context was provided.\n\n` +
          '• Try adding a description of what you see in the text box above\n' +
          '• For medicines: type the medicine name\n' +
          '• For injuries: describe the injury type, location, and severity\n' +
          `• Make sure the ${selectedPdf ? 'PDF is readable' : 'image is clear and well-lit'}\n\n` +
          'Then tap "Analyze Scan" again.',
        );
        setIsAnalyzing(false);
        return;
      }

      const classifierInput = `${additionalContext}\n${extractedText}`.trim();
      const classification = classifySymptomText(classifierInput);
      if (classification.detected) {
        await AuditTimelineService.logEvent({
          type: 'symptom_entry',
          severity: classification.emergency ? 'warning' : 'info',
          source: 'scan',
          summary: `Symptom-like content detected from scan (${classification.condition || 'general'})`,
          details: {
            confidence: classification.confidence,
            matchedSymptoms: classification.matchedSymptoms,
            emergency: classification.emergency,
            emergencyReason: classification.emergencyReason,
            extractedTextLength: extractedText.length,
            contextLength: additionalContext.length,
          },
        });
      }

      if (classification.emergency) {
        await AuditTimelineService.logEvent({
          type: 'emergency_warning_shown',
          severity: 'critical',
          source: 'scan',
          summary: classification.emergencyReason || 'Potential emergency signs detected in scanned context',
          details: {
            condition: classification.condition,
            matchedSymptoms: classification.matchedSymptoms,
          },
        });
      }

      // Step 2: Check if LLM is loaded, reload if needed
      setStatusMessage('Preparing AI model...');
      try {
        const modelLoaded = await RunAnywhere.isModelLoaded();
        if (!modelLoaded) {
          // Try to reload the LLM — the VLM flow may have unloaded it
          setStatusMessage('Loading AI model...');
          const modelPath = await RunAnywhere.getModelPath('qwen2.5-1.5b-instruct-q4km');
          if (modelPath) {
            await RunAnywhere.loadModel(modelPath);
          } else {
            // Try fallback models
            for (const fallback of ['smollm2-360m-q8_0', 'lfm2-350m-q8_0']) {
              try {
                const fbPath = await RunAnywhere.getModelPath(fallback);
                if (fbPath) {
                  await RunAnywhere.loadModel(fbPath);
                  break;
                }
              } catch { /* try next */ }
            }
          }
        }
      } catch (modelErr: any) {
        console.warn('Model check/load failed:', modelErr?.message || modelErr);
      }

      // Step 3: Build strict OCR -> Qwen prompt
      let analysisPrompt = OCR_SUMMARY_PROMPT + '\n\n';
      analysisPrompt += `SOURCE TYPE: ${selectedPdf ? 'PDF' : 'IMAGE'}\n\n`;
      analysisPrompt += `OCR TEXT:\n"""${extractedText || ''}"""\n\n`;
      if (additionalContext.trim()) {
        analysisPrompt += `USER CONTEXT:\n"""${additionalContext.trim()}"""\n\n`;
      }
      analysisPrompt += 'Generate the final summary now.';

      // Step 4: Stream LLM response
      setStatusMessage('Analyzing...');

      try {
        const streaming = await RunAnywhere.generateStream(analysisPrompt, {
          maxTokens: 1000,
          temperature: 0.7,
        });

        for await (const token of streaming.stream) {
          responseRef.current += token;
          setAnalysisResult(responseRef.current);
          setStatusMessage('');
        }

        await AuditTimelineService.logEvent({
          type: 'analysis_completed',
          severity: 'info',
          source: 'scan',
          summary: 'Scan analysis completed successfully',
          details: {
            responseLength: responseRef.current.length,
            usedStreaming: true,
          },
        });
      } catch (streamErr: any) {
        console.warn('generateStream failed, trying non-stream:', streamErr?.message || streamErr);
        // Fallback to non-streaming generate
        try {
          const result = await RunAnywhere.generate(analysisPrompt, {
            maxTokens: 1000,
            temperature: 0.7,
          });
          if (result?.text) {
            setAnalysisResult(result.text);
            await AuditTimelineService.logEvent({
              type: 'analysis_completed',
              severity: 'info',
              source: 'scan',
              summary: 'Scan analysis completed with fallback generation',
              details: {
                responseLength: result.text.length,
                usedStreaming: false,
              },
            });
          } else {
            throw new Error('Empty response from generate');
          }
        } catch (genErr: any) {
          console.error('Non-streaming generate also failed:', genErr?.message || genErr);
          setAnalysisResult(
            `❌ Analysis failed: ${genErr?.message || 'Unknown error'}\n\n` +
            '• Make sure the AI model is loaded\n' +
            '• Try restarting the app\n' +
            '• Close other apps to free memory',
          );
          await AuditTimelineService.logEvent({
            type: 'model_issue',
            severity: 'warning',
            source: 'scan',
            summary: 'Scan analysis failed in both streaming and fallback modes',
            details: {
              streamError: streamErr?.message || String(streamErr),
              generateError: genErr?.message || String(genErr),
            },
          });
        }
      }
    } catch (error: any) {
      console.error('Scan analysis error:', error);
      setAnalysisResult(`❌ Error: ${error?.message || 'Analysis failed'}\n\nPlease try again.`);
      await AuditTimelineService.logEvent({
        type: 'model_issue',
        severity: 'warning',
        source: 'scan',
        summary: 'Scan analysis pipeline error',
        details: {
          error: error?.message || String(error),
        },
      });
    } finally {
      setIsAnalyzing(false);
      setStatusMessage('');
      setDownloadProgress(0);
    }
  }, [capturedImage, selectedPdf, additionalContext]);

  const handleReset = useCallback(() => {
    setCapturedImage(null);
    setSelectedPdf(null);
    setAnalysisResult('');
    setAdditionalContext('');
    setStatusMessage('');
    setDownloadProgress(0);
    responseRef.current = '';
  }, []);


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
          <Image
            source={require('../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Sahayak AI</Text>
        </View>
        <TouchableOpacity
          style={styles.headerSettingsBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <MaterialCommunityIcons name="account-outline" size={22} color="#475569" />
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
                <MaterialCommunityIcons name="refresh" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.retakeText}>Tap to retake</Text>
              </View>
            </TouchableOpacity>
          ) : selectedPdf?.uri ? (
            <TouchableOpacity onPress={handleReset} activeOpacity={0.9} style={styles.pdfPreviewContainer}>
              <MaterialCommunityIcons name="file-pdf-box" size={62} color="#B91C1C" />
              <Text style={styles.pdfTitle} numberOfLines={2}>{selectedPdf.name || 'document.pdf'}</Text>
              <Text style={styles.pdfSubtitle}>Tap to clear and pick another file</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderLabel}>Capture image or upload a medical PDF</Text>
              <View style={styles.viewfinderFrame}>
                {/* Scan corners */}
                <View style={[styles.cornerTL, styles.corner]} />
                <View style={[styles.cornerTR, styles.corner]} />
                <View style={[styles.cornerBL, styles.corner]} />
                <View style={[styles.cornerBR, styles.corner]} />
                <MaterialCommunityIcons name="camera-plus-outline" size={64} color="#94A3B8" />
              </View>
            </View>
          )}

          {/* Camera/Gallery Buttons */}
          <View style={styles.captureButtons}>
            <TouchableOpacity style={styles.captureBtn} onPress={handleCameraCapture}>
              <LinearGradient
                colors={['#1B3A5C', '#102A43']}
                style={styles.captureBtnInner}
              >
                <MaterialCommunityIcons name="camera" size={26} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureBtn} onPress={handleGalleryPick}>
              <View style={[styles.captureBtnInner, styles.galleryBtnInner]}>
                <MaterialCommunityIcons name="image-multiple" size={26} color="#1B3A5C" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureBtn} onPress={handlePdfPick}>
              <View style={[styles.captureBtnInner, styles.pdfBtnInner]}>
                <MaterialCommunityIcons name="file-pdf-box" size={26} color="#B91C1C" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.contextCard}>
          <Text style={styles.contextLabel}>Optional context for better summary</Text>
          <TextInput
            style={styles.contextInput}
            placeholder="Example: This is my blood test report from yesterday"
            placeholderTextColor="#94A3B8"
            multiline
            value={additionalContext}
            onChangeText={setAdditionalContext}
            textAlignVertical="top"
          />
        </View>

        {/* Analyze Scan Button */}
        <TouchableOpacity
          style={[styles.analyzeBtn, ((!capturedImage && !selectedPdf) || isAnalyzing) && styles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={(!capturedImage && !selectedPdf) || isAnalyzing}
        >
          <LinearGradient
            colors={((!capturedImage && !selectedPdf) || isAnalyzing) ? ['#94A3B8', '#64748B'] : ['#1B3A5C', '#102A43']}
            style={styles.btnGradient}
          >
            {isAnalyzing ? (
              <View style={styles.analyzingRow}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.analyzeBtnText}>
                  {statusMessage || 'Analyzing...'}
                </Text>
              </View>
            ) : (
              <View style={styles.btnInner}>
                <MaterialCommunityIcons name="brain" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.analyzeBtnText}>Analyze Scan</Text>
              </View>
            )}
          </LinearGradient>
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
                <MaterialCommunityIcons name="creation" size={22} color="#1B3A5C" style={{ marginRight: 8 }} />
                <Text style={styles.resultHeaderText}>AI Analysis</Text>
              </View>
              <TouchableOpacity onPress={handlePlayTTS} style={styles.ttsBtn} disabled={isAnalyzing}>
                <MaterialCommunityIcons name="volume-high" size={22} color="#1B3A5C" />
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

        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Bottom Navigation */}
      <BottomNav activeTab="Scan" />
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 8 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F2544',
    letterSpacing: -0.5,
  },
  headerSettingsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  viewfinderCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 28,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  imagePreviewContainer: {
    width: '100%',
    height: width - 72,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#F1F5F9',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pdfPreviewContainer: {
    width: '100%',
    height: width * 0.65,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 20,
  },
  pdfTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '800',
    color: '#7F1D1D',
    textAlign: 'center',
  },
  pdfSubtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
    textAlign: 'center',
  },
  placeholderContainer: {
    width: '100%',
    alignItems: 'center',
  },
  placeholderLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 16,
    textAlign: 'center',
  },
  viewfinderFrame: {
    width: '100%',
    height: width * 0.65,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#1B3A5C',
    borderWidth: 4,
  },
  cornerTL: {
    top: 16,
    left: 16,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 16,
    right: 16,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 16,
    left: 16,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 16,
    right: 16,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  retakeBadge: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    backgroundColor: 'rgba(15, 37, 68, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  captureButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 24,
  },
  captureBtn: {
    borderRadius: 32,
    elevation: 6,
    shadowColor: '#1B3A5C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  captureBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1B3A5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryBtnInner: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#F1F5F9',
  },
  pdfBtnInner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#FECACA',
  },
  contextCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 16,
  },
  contextLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 8,
  },
  contextInput: {
    minHeight: 84,
    fontSize: 14,
    lineHeight: 20,
    color: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  analyzeBtn: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 6,
    shadowColor: '#1B3A5C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  analyzeBtnDisabled: {
    elevation: 0,
    shadowOpacity: 0,
    opacity: 0.7,
  },
  btnGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzeBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
    paddingHorizontal: 4,
  },
  progressBarBg: {
    flex: 1,
    height: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#1B3A5C',
    borderRadius: 5,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1B3A5C',
    width: 45,
    textAlign: 'right',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 18,
    marginBottom: 20,
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  statusText: {
    flex: 1,
    fontSize: 15,
    color: '#475569',
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    marginBottom: 40,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  resultHeaderText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
  },
  ttsBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
  },
  resultDivider: {
    height: 2,
    backgroundColor: '#F1F5F9',
    marginBottom: 18,
  },
  resultText: {
    fontSize: 15,
    color: '#334155',
    lineHeight: 24,
    fontWeight: '500',
  },
  streamingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 2,
    borderTopColor: '#F1F5F9',
  },
  streamingText: {
    fontSize: 14,
    color: '#1B3A5C',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
