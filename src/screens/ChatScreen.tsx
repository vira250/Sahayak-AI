import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  NativeModules,
  PermissionsAndroid,
} from 'react-native';
import { RunAnywhere } from '@runanywhere/core';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ChatMessageBubble, ChatMessage, ModelLoaderWidget } from '../components';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { RoomService } from '../services/RoomService';
import { playBase64Audio } from '../utils/AudioPlayer';

const { NativeAudioModule } = NativeModules;

export const ChatScreen: React.FC = () => {
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const [roomId, setRoomId] = useState<string | undefined>(route.params?.roomId);
  const [roomContext, setRoomContext] = useState('');
  
  const modelService = useModelService();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  
  // New State for Enhanced Inputs
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageContext, setImageContext] = useState(''); // Holds OCR text before sending
  const recordingStartRef = useRef<number>(0);
  
  const flatListRef = useRef<FlatList>(null);
  const streamCancelRef = useRef<(() => void) | null>(null);
  const responseRef = useRef(''); // Track response for closure

  useEffect(() => {
    if (roomId) {
      RoomService.getRoomHistory(roomId).then(history => {
        if (history.length > 0) setMessages(history);
      });
      RoomService.getRoomDetails(roomId).then(details => {
        if (details) setRoomContext(details.context);
      });
    } else {
      setMessages([]);
      setRoomContext('');
    }
  }, [roomId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, currentResponse]);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (isRecording && NativeAudioModule) {
        NativeAudioModule.cancelRecording().catch(() => {});
      }
    };
  }, [isRecording]);

  // --- AUDIO STT LOGIC ---
  const startRecording = async () => {
    try {
      if (!NativeAudioModule) {
        Alert.alert('Error', 'Native audio module not available.');
        return;
      }
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission Denied', 'Microphone permission is required.');
          return;
        }
      }

      await NativeAudioModule.startRecording();
      recordingStartRef.current = Date.now();
      setIsRecording(true);
    } catch (error) {
      console.error('Recording error:', error);
      Alert.alert('Recording Error', `Failed to start: ${error}`);
    }
  };

  const stopRecordingAndTranscribe = async () => {
    try {
      if (!NativeAudioModule) throw new Error('NativeAudioModule not available');

      const result = await NativeAudioModule.stopRecording();
      setIsRecording(false);
      
      const duration = Date.now() - recordingStartRef.current;
      if (duration < 500) return; // Too short, ignore

      setIsTranscribing(true);
      const audioBase64 = result.audioBase64;
      if (!audioBase64) throw new Error('No audio data received');

      if (!modelService.isSTTLoaded) {
        throw new Error('Please download and load the Speech to Text model first.');
      }

      const transcribeResult = await RunAnywhere.transcribe(audioBase64, {
        sampleRate: 16000,
        language: 'en',
      });

      if (transcribeResult.text) {
        // Append transcribed text to the input box
        setInputText(prev => (prev ? prev + ' ' : '') + transcribeResult.text.trim());
      }
    } catch (error) {
      console.error('Transcription error:', error);
      Alert.alert('Transcription Error', String(error));
    } finally {
      setIsTranscribing(false);
    }
  };

  // --- IMAGE OCR LOGIC ---
  const processImageForOCR = async (asset: Asset) => {
    if (!asset.uri) return;
    setIsProcessingImage(true);
    try {
      const result = await TextRecognition.recognize(asset.uri);
      if (result && result.text && result.text.trim() !== '') {
        setImageContext(result.text.trim());
      } else {
        Alert.alert('No Text Found', 'Could not find readable text in this image.');
      }
    } catch (error: any) {
      console.error('OCR Error:', error);
      Alert.alert('OCR Failed', error.message || 'Failed to extract text.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const handleCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required.');
      return;
    }
    launchCamera({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel || !!response.errorCode || !response.assets) return;
      processImageForOCR(response.assets[0]);
    });
  };

  const handleGallery = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.8 }, (response) => {
      if (response.didCancel || !!response.errorCode || !response.assets) return;
      processImageForOCR(response.assets[0]);
    });
  };

  const handleUploadOptions = () => {
    Alert.alert(
      'Attach Image',
      'Choose how to attach an image for context.',
      [
        { text: 'Take Photo', onPress: handleCamera },
        { text: 'Choose from Gallery', onPress: handleGallery },
        { text: 'Cancel', style: 'cancel' }
      ],
      { cancelable: true }
    );
  };

  const handlePlayTTS = async (text: string) => {
    try {
      if (!modelService.isTTSLoaded) {
        Alert.alert('TTS Not Loaded', 'Please wait for Text-to-Speech model to load.');
        return;
      }
      
      const cleanText = text.replace(/\[Attached Image Context\]\n/g, '');
      const synthResult = await RunAnywhere.synthesize(cleanText, { voice: '0', rate: 1.0 });
      
      if (synthResult.audioData) {
        await playBase64Audio(synthResult.audioData);
      }
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  // --- SEND MESSAGES ---
  const handleSend = async () => {
    const text = inputText.trim();
    if ((!text && !imageContext) || isGenerating) return;

    // Create room implicitly if we don't have one and we're sending context
    let activeRoomId = roomId;
    if (!activeRoomId && (roomContext || imageContext)) {
      activeRoomId = await RoomService.createRoom(imageContext || text, 'Chat Session');
      setRoomId(activeRoomId);
    }

    // Add user message
    const displayMessage = imageContext ? `[Attached Image Context]\n${text || 'Please analyze this information'}` : text;
    const userMessage: ChatMessage = {
      text: displayMessage,
      isUser: true,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    if (activeRoomId) await RoomService.addMessageToRoom(activeRoomId, userMessage);
    
    setInputText('');
    setIsGenerating(true);
    setCurrentResponse('');

    try {
      // Build prompt from room context and ephemeral image context
      let promptText = text || 'Please review the provided information.';
      const combinedContext = [roomContext, imageContext].filter(Boolean).join('\n\n');
      
      if (combinedContext) {
        promptText = `[Background Context]:\n${combinedContext}\n\n[User Input]:\n${promptText}\n\nPlease answer based on the context above.`;
      }
      
      // Clear ephemeral image context after building prompt
      setImageContext('');

      const streamResult = await RunAnywhere.generateStream(promptText, {
        maxTokens: 512,
        temperature: 0.7,
      });

      streamCancelRef.current = streamResult.cancel;
      responseRef.current = '';

      for await (const token of streamResult.stream) {
        responseRef.current += token;
        setCurrentResponse(responseRef.current);
      }

      const finalResult = await streamResult.result;
      const assistantMessage: ChatMessage = {
        text: responseRef.current,
        isUser: false,
        timestamp: new Date(),
        tokensPerSecond: finalResult.performanceMetrics?.tokensPerSecond,
        totalTokens: finalResult.performanceMetrics?.totalTokens,
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      if (activeRoomId) await RoomService.addMessageToRoom(activeRoomId, assistantMessage);
    } catch (error) {
      const errorMessage: ChatMessage = {
        text: `Error: ${error}`,
        isUser: false,
        timestamp: new Date(),
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
      if (activeRoomId) await RoomService.addMessageToRoom(activeRoomId, errorMessage);
    } finally {
      setCurrentResponse('');
      responseRef.current = '';
      setIsGenerating(false);
    }
  };

  const handleStop = async () => {
    if (streamCancelRef.current) {
      streamCancelRef.current();
      if (responseRef.current) {
        const message: ChatMessage = {
          text: responseRef.current,
          isUser: false,
          timestamp: new Date(),
          wasCancelled: true,
        };
        setMessages(prev => [...prev, message]);
        if (roomId) await RoomService.addMessageToRoom(roomId, message);
      }
      setCurrentResponse('');
      responseRef.current = '';
      setIsGenerating(false);
    }
  };

  const renderSuggestionChip = (text: string) => (
    <TouchableOpacity
      key={text}
      style={styles.suggestionChip}
      onPress={() => {
        setInputText(text);
        if (!imageContext) handleSend();
      }}
    >
      <Text style={styles.suggestionText}>{text}</Text>
    </TouchableOpacity>
  );

  if (!modelService.isLLMLoaded) {
    return (
      <ModelLoaderWidget
        title="LLM Model Required"
        subtitle="Download and load the language model to start chatting"
        icon="chat"
        accentColor={AppColors.accentCyan}
        isDownloading={modelService.isLLMDownloading}
        isLoading={modelService.isLLMLoading}
        progress={modelService.llmDownloadProgress}
        onLoad={modelService.downloadAndLoadLLM}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Text style={styles.emptyIcon}>💬</Text>
          </View>
          <Text style={styles.emptyTitle}>Sahayak AI Chat</Text>
          <Text style={styles.emptySubtitle}>
            Ask anything, speak your mind, or upload an image to extract text for context.
          </Text>
          <View style={styles.suggestionsContainer}>
            {renderSuggestionChip('Tell me a joke')}
            {renderSuggestionChip('Summarize uploaded text')}
            {renderSuggestionChip('Extract key points')}
          </View>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={[...messages, ...(isGenerating ? [{ text: currentResponse || '...', isUser: false, timestamp: new Date() }] : [])]}
          renderItem={({ item, index }) => (
            <ChatMessageBubble
              message={item as ChatMessage}
              isStreaming={isGenerating && index === messages.length}
              onPlayTTS={() => handlePlayTTS((item as ChatMessage).text)}
            />
          )}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Input Area */}
      <View style={styles.inputContainer}>
        
        {/* Attachment Badge */}
        {imageContext ? (
          <View style={styles.attachmentBadge}>
            <Text style={styles.attachmentIcon}>📸</Text>
            <Text style={styles.attachmentText} numberOfLines={1}>
              Image text extracted ({imageContext.length} chars)
            </Text>
            <TouchableOpacity onPress={() => setImageContext('')} style={styles.removeAttachment}>
              <Text style={styles.removeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.inputWrapper}>
          {/* Main Input Pill */}
          <View style={styles.inputPill}>
            {/* Upload Button */}
            <TouchableOpacity onPress={handleUploadOptions} style={styles.actionBtn}>
              <Text style={styles.actionIcon}>↑_</Text>
            </TouchableOpacity>

            {/* Text Input */}
            <TextInput
              style={styles.input}
              placeholder={isTranscribing ? "Transcribing..." : isProcessingImage ? "Reading image..." : "Command Sahay"}
              placeholderTextColor={'#9CA3AF'}
              value={inputText}
              onChangeText={setInputText}
              editable={!isGenerating && !isTranscribing && !isProcessingImage}
              multiline
            />

            {/* Audio Button inside the pill */}
            <TouchableOpacity
              onPressIn={startRecording}
              onPressOut={stopRecordingAndTranscribe}
              style={[styles.micButton, isRecording && styles.micButtonActive]}
            >
              <Text style={styles.micIcon}>{isRecording ? '🎙️' : '🎤'}</Text>
            </TouchableOpacity>
          </View>

          {/* Send / Stop Button outside the pill */}
          <View style={styles.endButtons}>
            {isGenerating ? (
              <TouchableOpacity onPress={handleStop} style={styles.stopButton}>
                <Text style={styles.stopIconText}>⏹</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleSend} style={styles.sendButton} disabled={!inputText.trim() && !imageContext}>
                <Text style={styles.sendIcon}>➤</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  messageList: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    backgroundColor: AppColors.navyPale,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginBottom: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: AppColors.surfaceCard,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionText: {
    fontSize: 12,
    color: AppColors.textPrimary,
  },
  inputContainer: {
    padding: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppColors.navyPale,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  attachmentIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  attachmentText: {
    flex: 1,
    fontSize: 12,
    color: AppColors.navyMid,
    fontWeight: '600',
  },
  removeAttachment: {
    padding: 4,
    marginLeft: 8,
  },
  removeIcon: {
    fontSize: 14,
    color: AppColors.textMuted,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  actionBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 18,
    color: '#64748B',
    fontWeight: '800',
  },
  input: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: AppColors.textPrimary,
    minHeight: 44,
    maxHeight: 100,
  },
  endButtons: {
    paddingBottom: 2,
    paddingRight: 2,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#0F2544',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    marginLeft: 4, // Optical alignment for send icon
  },
  micButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: {
    backgroundColor: AppColors.error + '20',
    borderRadius: 18,
    transform: [{ scale: 1.1 }],
  },
  micIcon: {
    fontSize: 18,
  },
  stopButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.error + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopIconText: {
    fontSize: 18,
    color: AppColors.error,
  },
});
