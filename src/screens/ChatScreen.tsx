import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Dimensions,
  Image,
  Alert,
  PermissionsAndroid,
} from 'react-native';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget } from '../components';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { launchImageLibrary } = require('react-native-image-picker');

// ─── Theme ────────────────────────────────────────────────────────────────────
const theme = {
  primary: '#005da7',
  primaryContainer: '#2976c7',
  primaryFixed: '#d4e3ff',
  onPrimaryFixed: '#001c39',
  secondary: '#136a5c',
  secondaryContainer: '#a1eedd',
  secondaryFixed: '#a4f1e0',
  onSecondaryFixed: '#00201b',
  onSecondaryContainer: '#1b6e61',
  surface: '#f6faff',
  surfaceContainer: '#dff0ff',
  surfaceContainerLow: '#eaf5ff',
  surfaceContainerHigh: '#d9ebfa',
  surfaceContainerHighest: '#d3e5f4',
  background: '#f6faff',
  onSurface: '#0c1d28',
  onSurfaceVariant: '#414751',
  outline: '#717783',
  outlineVariant: '#c1c7d3',
  error: '#ba1a1a',
  white: '#ffffff',
};

// ─── Types ────────────────────────────────────────────────────────────────────
type MessageRole = 'user' | 'ai';

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  time: string;
  imageUri?: string; // For OCR images
  ocrText?: string; // Extracted OCR text for context
}

interface SessionContext {
  ocrData: Array<{ imageUri: string; text: string; timestamp: string }>;
  voiceTranscripts: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (): string => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m} ${ampm}`;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated typing indicator with three bouncing dots */
const TypingIndicator: React.FC = () => {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: -6, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(600 - i * 150),
        ])
      )
    );
    const group = Animated.parallel(animations);
    group.start();
    return () => group.stop();
  }, []);

  return (
    <View style={styles.typingRow}>
      <View style={styles.aiAvatar}>
        <Text style={styles.aiAvatarIcon}>⚡</Text>
      </View>
      <View style={styles.typingBubble}>
        <View style={styles.dotsRow}>
          {dots.map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: 0.4 + i * 0.3, transform: [{ translateY: dot }] }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

/** Single chat message bubble */
const MessageBubble: React.FC<{ message: Message; onSpeakText?: (text: string) => void }> = ({ message, onSpeakText }) => {
  const isUser = message.role === 'user';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  if (isUser) {
    return (
      <Animated.View style={[styles.userRow, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.userBubble}>
          {message.imageUri && (
            <Image source={{ uri: message.imageUri }} style={styles.messageImage} />
          )}
          <Text style={styles.userBubbleText}>{message.text}</Text>
          {message.ocrText && (
            <Text style={styles.ocrLabel}>📸 OCR: {message.ocrText.substring(0, 50)}...</Text>
          )}
          <Text style={styles.userTimestamp}>{message.time}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.aiRow, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
      <View style={styles.aiAvatar}>
        <Text style={styles.aiAvatarIcon}>⚡</Text>
      </View>
      <View style={styles.aiBubble}>
        <Text style={styles.aiBubbleText}>{message.text}</Text>
        <View style={styles.aiBubbleFooter}>
          <Text style={styles.aiSenderLabel}>Sahayak AI</Text>
          <TouchableOpacity style={styles.speakerBtn} activeOpacity={0.7} onPress={() => onSpeakText?.(message.text)}>
            <Text style={styles.speakerIcon}>🔊</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

/** Welcome/Empty state */
const WelcomeState: React.FC = () => (
  <View style={styles.welcome}>
    <View style={styles.welcomeIcon}>
      <Text style={styles.welcomeEmoji}>⚡</Text>
    </View>
    <Text style={styles.welcomeTitle}>Hi, I'm Sahayak AI 👋</Text>
    <Text style={styles.welcomeSubtitle}>
      Chat with me, share images for OCR, or use voice commands. I'm here to help!
    </Text>
    <View style={styles.suggestedPrompts}>
      <Text style={styles.suggestedLabel}>Quick examples:</Text>
      <Text style={styles.suggestedItem}>• "What's the capital of France?"</Text>
      <Text style={styles.suggestedItem}>• "Help me write a poem"</Text>
      <Text style={styles.suggestedItem}>• "Use voice or take a photo"</Text>
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const ChatScreen: React.FC = () => {
  const modelService = useModelService();

  // Check model loading status before calling any hooks
  if (!modelService.isLLMLoaded) {
    return (
      <ModelLoaderWidget
        title="LLM Model Required"
        subtitle="Download and load the language model to chat with Sahayak AI"
        icon="chat"
        accentColor={theme.primary}
        isDownloading={modelService.isLLMDownloading}
        isLoading={modelService.isLLMLoading}
        progress={modelService.llmDownloadProgress}
        onLoad={modelService.downloadAndLoadLLM}
      />
    );
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sessionContext, setSessionContext] = useState<SessionContext>({ ocrData: [], voiceTranscripts: [] });
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, isTyping]);

  // ─── STT Integration: Voice Transcription ───────────────────────────────────
  const handleVoiceInput = async () => {
    if (!modelService.isSTTLoaded) {
      Alert.alert('STT Not Ready', 'Please download and load the STT model first');
      return;
    }

    Alert.alert('Voice Recording', 'Listening... Speak for up to 5 seconds');

    try {
      const response = await modelService.performSTT?.();
      if (response && response !== 'No speech detected') {
        setInputText(response);
        // Store in session context
        setSessionContext(prev => ({
          ...prev,
          voiceTranscripts: [...prev.voiceTranscripts, response],
        }));
        console.log('Voice input received:', response);
      }
    } catch (error) {
      console.error('STT error:', error);
      Alert.alert('Voice Input Error', `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // ─── OCR Integration: Image to Text ──────────────────────────────────────────
  const handleImagePicker = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });

      if (result.didCancel) return;

      const imageUri = result.assets?.[0]?.uri;
      if (!imageUri) return;

      console.log('Image selected:', imageUri);

      // Add user message with image first (non-blocking)
      const userMsg: Message = {
        id: Date.now().toString(),
        role: 'user',
        text: `[📸 Image uploaded]`,
        time: formatTime(),
        imageUri,
      };
      setMessages(prev => [...prev, userMsg]);
      setIsTyping(true);

      // Run OCR in background
      try {
        console.log('Running OCR...');
        const ocrText = await modelService.performOCR(imageUri);
        console.log('OCR result:', ocrText);

        // Update session context
        const ocrEntry = { imageUri, text: ocrText, timestamp: formatTime() };
        setSessionContext(prev => ({
          ...prev,
          ocrData: [...prev.ocrData, ocrEntry],
        }));

        // Update message with OCR result
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            ocrText: ocrText.substring(0, 100),
          };
          return updated;
        });

        // Auto-generate response
        const contextPrompt = `I analyzed an image and detected: "${ocrText.substring(0, 200)}"${ocrText.length > 200 ? '...' : ''}. Can you help me understand this better?`;
        await generateAIResponse(contextPrompt);
      } catch (ocrError) {
        console.error('OCR failed:', ocrError);
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          text: `OCR Error: ${ocrError instanceof Error ? ocrError.message : 'Could not extract text from image'}`,
          time: formatTime(),
        };
        setMessages(prev => [...prev, errorMsg]);
      }

      setIsTyping(false);
    } catch (error) {
      setIsTyping(false);
      console.error('Image picker error:', error);
      Alert.alert('Image Error', `Failed: ${error instanceof Error ? error.message : 'Could not process image'}`);
    }
  };

  // ─── TTS Integration: Text-to-Speech ────────────────────────────────────────
  const handleSpeakText = async (text: string) => {
    if (!modelService.isTTSLoaded) {
      console.log('TTS not loaded yet');
      return;
    }

    try {
      // Fire and forget - don't block UI
      modelService.performTTS?.(text).catch(err => {
        console.error('TTS playback failed:', err);
      });
    } catch (error) {
      console.error('TTS error:', error);
    }
  };

  // ─── Context-Aware AI Response Generation ────────────────────────────────────
  const generateAIResponse = async (prompt: string) => {
    // Build context from session data
    let contextString = '';
    if (sessionContext.ocrData.length > 0) {
      contextString += '[Context: User shared images - ';
      contextString += sessionContext.ocrData.map((d, i) => d.text.substring(0, 40)).join(', ');
      contextString += '] ';
    }
    if (sessionContext.voiceTranscripts.length > 0) {
      contextString += '[Voice: ' + sessionContext.voiceTranscripts.slice(-2).join(', ') + '] ';
    }

    const fullPrompt = contextString + prompt;

    console.log('Generating response for prompt:', fullPrompt.substring(0, 100) + '...');

    try {
      const aiText = await modelService.generateLimitedResponse(fullPrompt, 200);

      console.log('AI Response received:', aiText.substring(0, 100) + '...');

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: aiText || 'I could not generate a response. Try again.',
        time: formatTime(),
      };
      setMessages(prev => [...prev, aiMsg]);

      // Try TTS in background if available
      if (modelService.isTTSLoaded && aiText) {
        handleSpeakText(aiText);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        text: `Error: ${error instanceof Error ? error.message : 'Failed to generate response'}. Please try again.`,
        time: formatTime(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  // ─── Text Input Handler ────────────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    console.log('Sending message:', trimmed);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: trimmed,
      time: formatTime(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    await generateAIResponse(trimmed);
    setIsTyping(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={theme.primary} />

      {/* ── Decorative background blobs ── */}
      <View style={styles.blobTopLeft} pointerEvents="none" />
      <View style={styles.blobBottomRight} pointerEvents="none" />

      {/* ── Messages ── */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {messages.length === 0 && <WelcomeState />}
          <View style={styles.messagesList}>
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} onSpeakText={handleSpeakText} />
            ))}
            {isTyping && <TypingIndicator />}
          </View>
        </ScrollView>

        {/* ── Input Bar ── */}
        <View style={styles.inputBar}>
          <View style={styles.inputRow}>
            {/* Voice */}
            <TouchableOpacity
              style={[styles.iconBtn, modelService.isSTTLoaded && styles.iconBtnActive]}
              activeOpacity={0.7}
              onPress={handleVoiceInput}
            >
              <Text style={styles.iconBtnText}>🎤</Text>
            </TouchableOpacity>
            {/* Image/OCR */}
            <TouchableOpacity
              style={[styles.iconBtn, modelService.isOCRLoaded && styles.iconBtnActive]}
              activeOpacity={0.7}
              onPress={handleImagePicker}
            >
              <Text style={styles.iconBtnText}>🖼️</Text>
            </TouchableOpacity>

            {/* Text Input */}
            <View style={styles.textInputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Type or use voice..."
                placeholderTextColor={theme.outline}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                multiline={false}
              />
            </View>

            {/* Send */}
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              activeOpacity={0.8}
              onPress={handleSend}
              disabled={!inputText.trim()}
            >
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.background,
  },
  flex: { flex: 1 },

  // Decorative blobs
  blobTopLeft: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: theme.primaryFixed + '30',
    zIndex: -1,
  },
  blobBottomRight: {
    position: 'absolute',
    bottom: -60,
    right: -60,
    width: width * 0.5,
    height: width * 0.5,
    borderRadius: width * 0.25,
    backgroundColor: theme.secondaryContainer + '40',
    zIndex: -1,
  },

  // Scroll
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  messagesList: { gap: 20 },

  // Placeholder
  placeholder: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 40,
    gap: 12,
  },
  placeholderIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: { fontSize: 28 },
  placeholderText: {
    fontSize: 13,
    color: theme.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 19,
    fontWeight: '500',
    maxWidth: 240,
  },

  // Welcome state
  welcome: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 16,
  },
  welcomeIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primaryFixed,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  welcomeEmoji: { fontSize: 36 },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.primary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: theme.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 21,
    fontWeight: '500',
    maxWidth: 280,
  },
  suggestedPrompts: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.surfaceContainerLow,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: theme.secondary,
  },
  suggestedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.secondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  suggestedItem: {
    fontSize: 12,
    color: theme.onSurfaceVariant,
    marginBottom: 6,
    lineHeight: 18,
  },

  // User bubble
  userRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: theme.primaryFixed,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderTopRightRadius: 4,
    shadowColor: theme.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  userBubbleText: { fontSize: 14, color: theme.onPrimaryFixed, lineHeight: 21 },
  messageImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: theme.surfaceContainer,
  },
  ocrLabel: {
    fontSize: 10,
    color: theme.onPrimaryFixed + 'B3',
    marginTop: 6,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  userTimestamp: { fontSize: 10, color: theme.onPrimaryFixed + '80', marginTop: 4, alignSelf: 'flex-end' },

  // AI bubble
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.secondaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  aiAvatarIcon: { fontSize: 14 },
  aiBubble: {
    flex: 1,
    maxWidth: '82%',
    backgroundColor: theme.secondaryFixed,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    shadowColor: theme.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  aiBubbleText: { fontSize: 14, color: theme.onSecondaryFixed, lineHeight: 21 },
  aiBubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  aiSenderLabel: { fontSize: 10, color: theme.onSecondaryFixed + '80' },
  speakerBtn: { padding: 4 },
  speakerIcon: { fontSize: 13 },

  // Typing indicator
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typingBubble: {
    backgroundColor: theme.surfaceContainerLow,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.secondary },

  // Input bar
  inputBar: {
    backgroundColor: theme.surface + 'CC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    paddingHorizontal: 12,
    shadowColor: theme.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: { backgroundColor: theme.secondaryContainer },
  iconBtnSecondary: { backgroundColor: theme.secondaryContainer + '50' },
  iconBtnText: { fontSize: 18 },
  textInputWrapper: {
    flex: 1,
    backgroundColor: theme.surfaceContainerHighest,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  textInput: {
    fontSize: 14,
    color: theme.onSurface,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.primary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: theme.surfaceContainerHigh, shadowOpacity: 0 },
  sendIcon: { fontSize: 18, color: theme.white },
});