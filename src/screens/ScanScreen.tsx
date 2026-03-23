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
import { ChatBackend } from '../services/ChatBackendBridge';
import { playBase64Audio } from '../utils/AudioPlayer';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { BottomNav } from '../components';
import { AuditTimelineService } from '../services/AuditTimelineService';
import { classifySymptomText } from '../services/SymptomClassifier';

const { width } = Dimensions.get('window');

// The prompt that tells the VLM what to do with the image
const VISION_PROMPT = `You are Dr. Sahayak, a medical first-aid assistant. Carefully examine this image and provide a detailed, structured analysis.

STEP 1: Identify what the image shows (injury, medicine, document, or other).
STEP 2: Provide specific guidance based on the category below.

═══ INJURIES & WOUNDS ═══

If you see a CUT, LACERATION, or OPEN WOUND:
• Severity: minor (shallow, <2cm) / moderate (deep, bleeding) / severe (deep, gaping, won't stop bleeding)
• First aid: clean with running water, apply gentle pressure with clean cloth, apply antiseptic, cover with sterile bandage
• Do NOT: use cotton directly on wound, apply turmeric/toothpaste, pull out embedded objects
• Seek emergency help if: bleeding won't stop after 10 min, wound is deep/gaping, caused by rusty/dirty object, signs of infection (redness spreading, pus, fever)

If you see a BURN:
• Degree: 1st (red, no blisters) / 2nd (blisters, swelling, pain) / 3rd (white/charred, numb)
• First aid: cool under running water for 10-20 min, cover loosely with clean cloth
• Do NOT: apply ice directly, pop blisters, apply butter/oil/toothpaste, remove stuck clothing
• Seek emergency help if: burn is larger than palm size, on face/hands/joints/genitals, is 3rd degree, victim is a child or elderly

If you see SWELLING or INFLAMMATION:
• Type: traumatic (from injury) / infectious (red, warm, spreading) / allergic (hives, facial swelling)
• First aid: RICE method (Rest, Ice-20min on/off, Compress, Elevate), OTC pain relief
• Seek emergency help if: swelling on throat/face causing breathing difficulty, rapidly spreading redness, accompanied by fever >101°F

If you see a SKIN CONDITION (rash, bite, infection, boil):
• Identify: insect bite, allergic rash, fungal infection, boil/abscess, eczema
• First aid: wash area, apply calamine/anti-itch cream, cold compress, avoid scratching
• Seek help if: spreading rapidly, pus/discharge, fever, near eyes, circular rash (possible Lyme)

If you see a possible FRACTURE or SPRAIN:
• Signs: deformity, severe swelling, bruising, inability to move
• First aid: immobilize the area, do not try to realign, apply cold pack, elevate
• Seek emergency help immediately for: open fractures, loss of feeling, deformity

If you see an EYE INJURY:
• First aid: do NOT rub, flush with clean water for chemical exposure, cover with clean cup/shield
• Seek emergency help immediately for: embedded objects, chemical burns, blurred vision, bleeding

═══ MEDICINE / MEDICATION ═══

If this is a MEDICINE (tablet, syrup, packaging):
• Name of medicine (read from label/packaging)
• Primary use and what condition it treats
• Typical dosage and when to take
• Common side effects to watch for
• Important warnings and drug interactions
• ⚠️ Always consult your doctor before starting or stopping any medication

═══ DOCUMENT / REPORT ═══

If this is a MEDICAL REPORT, BILL, or DOCUMENT:
• Summary of key findings or charges
• Important values, dates, and names
• Any abnormal results highlighted
• Recommended next steps

═══ OTHER ═══

For anything else, describe what you see and provide useful context.

IMPORTANT RULES:
• Use bullet points (•) for all responses
• Start with "🔍 Identified:" followed by what you see
• Be specific — mention exact body part, severity, and color observations
• Always end with: "⚠️ Disclaimer: This is AI-assisted first aid guidance only. Please consult a qualified doctor for proper diagnosis and treatment."
• For emergencies, mention: "🚨 Call emergency services (112) immediately"`;


export const ScanScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const modelService = useModelService();
  const [capturedImage, setCapturedImage] = useState<Asset | null>(null);
  const [additionalContext, setAdditionalContext] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

    try {
      // Step 1: Extract text from the image using ML Kit OCR
      setStatusMessage('Scanning image for text...');
      let extractedText = '';
      try {
        const ocrResult = await TextRecognition.recognize(capturedImage.uri);
        extractedText = ocrResult?.text || '';
        console.log('OCR extracted text length:', extractedText.length);
      } catch (ocrErr: any) {
        console.warn('OCR extraction failed (non-fatal):', ocrErr?.message || ocrErr);
        // Continue even if OCR fails — user may have provided context
      }

      if (!extractedText && !additionalContext.trim()) {
        setAnalysisResult(
          '⚠️ No text could be extracted from this image and no context was provided.\n\n' +
          '• Try adding a description of what you see in the text box above\n' +
          '• For medicines: type the medicine name\n' +
          '• For injuries: describe the injury type, location, and severity\n' +
          '• Make sure the image is clear and well-lit\n\n' +
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

      // Step 3: Build the prompt with extracted text and user context
      let analysisPrompt = VISION_PROMPT + '\n\n';
      if (extractedText) {
        analysisPrompt += `📋 TEXT EXTRACTED FROM IMAGE:\n"""${extractedText}"""\n\n`;
      }
      analysisPrompt += 'Based on the information above, provide your analysis:';

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
  }, [capturedImage, additionalContext]);

  const handleReset = useCallback(() => {
    setCapturedImage(null);
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
          ) : (
            <View style={styles.placeholderContainer}>
              <Text style={styles.placeholderLabel}>Point at medicine or object</Text>
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
          </View>
        </View>

        {/* Analyze Scan Button */}
        <TouchableOpacity
          style={[styles.analyzeBtn, (!capturedImage || isAnalyzing) && styles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={!capturedImage || isAnalyzing}
        >
          <LinearGradient
            colors={(!capturedImage || isAnalyzing) ? ['#94A3B8', '#64748B'] : ['#1B3A5C', '#102A43']}
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
