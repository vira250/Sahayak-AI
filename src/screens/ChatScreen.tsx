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
  StatusBar,
  Animated,
  SafeAreaView,
  Modal,
  Alert,
  Image,
  Dimensions,
  Keyboard,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { RunAnywhere, VoiceSessionEvent, VoiceSessionHandle } from '@runanywhere/core';
import { useModelService } from '../services/ModelService';
import { ChatMessage, ModelLoaderWidget } from '../components';
import { ChatBackend } from '../services/ChatBackendBridge';
import { playBase64Audio } from '../utils/AudioPlayer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Sahayak Design Tokens ────────────────────────────────────────────────────
const Colors = {
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
  onSurface: '#0c1d28',
  onSurfaceVariant: '#414751',
  outline: '#717783',
  outlineVariant: '#c1c7d3',
  error: '#ba1a1a',
  background: '#f6faff',
};

// ─── Extended ChatMessage type with optional image ────────────────────────────
type ExtendedChatMessage = ChatMessage & {
  imageUri?: string;
  imageContext?: string; // OCR text context hidden from UI
};

type ChatScreenProps = StackScreenProps<RootStackParamList, 'Chat'>;

// ─── Typing Dots ──────────────────────────────────────────────────────────────
const TypingDots: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(1)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay(800 - delay),
        ])
      );
    const composite = Animated.parallel([
      pulse(dot1, 0),
      pulse(dot2, 200),
      pulse(dot3, 400),
    ]);
    animRef.current = composite;
    composite.start();
    return () => { animRef.current?.stop(); animRef.current = null; };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.typingDots}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View key={i} style={[styles.dot, { opacity: dot }]} />
      ))}
    </View>
  );
};

// ─── Listening Pill ───────────────────────────────────────────────────────────
const ListeningPill: React.FC<{ visible: boolean }> = ({ visible }) => {
  if (!visible) return null;
  return (
    <View style={styles.listeningPill}>
      <View style={styles.listeningDotWrapper}>
        <View style={styles.listeningDotOuter} />
        <View style={styles.listeningDotInner} />
      </View>
      <Text style={styles.listeningText}>LISTENING...</Text>
    </View>
  );
};

// ─── Image Full-Screen Preview Modal ─────────────────────────────────────────
const ImagePreviewModal: React.FC<{
  uri: string | null;
  onClose: () => void;
}> = ({ uri, onClose }) => {
  if (!uri) return null;
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={imagePreviewStyles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={imagePreviewStyles.container}>
          <Image
            source={{ uri: uri || undefined }}
            style={imagePreviewStyles.image}
            resizeMode="contain"
          />
          <TouchableOpacity style={imagePreviewStyles.closeBtn} onPress={onClose}>
            <Text style={imagePreviewStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

// ─── Message Bubble ───────────────────────────────────────────────────────────
const SahayakMessageBubble: React.FC<{
  message: ExtendedChatMessage;
  isStreaming?: boolean;
  onImagePress: (uri: string) => void;
  onPlayTTS: (text: string) => void;
}> = ({ message, isStreaming, onImagePress, onPlayTTS }) => {

  const displayText = message.text;
  const hasImageContext = !!message.imageContext;

  if (message.isUser) {
    // Image-only message
    if (message.imageUri && !displayText) {
      return (
        <View style={bubbleStyles.userRow}>
          <TouchableOpacity
            style={bubbleStyles.imageBubble}
            activeOpacity={0.85}
            onPress={() => onImagePress(message.imageUri!)}
          >
            <Image
              source={{ uri: message.imageUri }}
              style={bubbleStyles.inlineImage}
              resizeMode="cover"
            />
            <View style={bubbleStyles.imageOverlay}>
              <MaterialCommunityIcons name="magnify" size={24} color="#FFFFFF" />
            </View>
            <Text style={bubbleStyles.imageTimestamp}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Image + text message
    if (message.imageUri && displayText) {
      return (
        <View style={bubbleStyles.userRow}>
          <View style={bubbleStyles.userBubbleWithImage}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onImagePress(message.imageUri!)}
            >
              <Image
                source={{ uri: message.imageUri }}
                style={bubbleStyles.inlineImageWithText}
                resizeMode="cover"
              />
              <View style={bubbleStyles.imageOverlaySmall}>
                <MaterialCommunityIcons name="magnify" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            {hasImageContext && (
              <View style={bubbleStyles.attachmentBadge}>
                <MaterialCommunityIcons name="file-document-outline" size={12} color={Colors.onSecondaryContainer} style={{ marginRight: 4 }} />
                <Text style={bubbleStyles.attachmentLabel}>Text extracted from image</Text>
              </View>
            )}
            <Text style={bubbleStyles.userTextBelowImage}>{displayText}</Text>
            <Text style={bubbleStyles.timestamp}>
              {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>
      );
    }

    // Text-only user message
    return (
      <View style={bubbleStyles.userRow}>
        <View style={bubbleStyles.userBubble}>
          {hasImageContext && (
            <View style={bubbleStyles.attachmentBadge}>
              <MaterialCommunityIcons name="camera-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={bubbleStyles.attachmentLabel}>Image Context Attached</Text>
            </View>
          )}
          <Text style={bubbleStyles.userText}>{displayText}</Text>
          <Text style={bubbleStyles.timestamp}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  }

  // AI message
  return (
    <View style={bubbleStyles.aiRow}>
      <View style={bubbleStyles.aiAvatar}>
        <Image
          source={require('../assets/logo.png')}
          style={bubbleStyles.aiAvatarImage}
          resizeMode="contain"
        />
      </View>
      <View style={bubbleStyles.aiBubble}>
        <Text style={[
          bubbleStyles.aiText,
          message.isError && bubbleStyles.errorText,
          message.wasCancelled && bubbleStyles.cancelledText,
        ]}>
          {message.text}
        </Text>
        {isStreaming && <TypingDots />}
        <View style={bubbleStyles.aiFooter}>
          <Text style={bubbleStyles.aiLabel}>Sahayak AI</Text>
          {(!isStreaming) && (
            <TouchableOpacity
              style={bubbleStyles.speakButton}
              onPress={() => onPlayTTS(message.text)}
            >
              <MaterialCommunityIcons name="volume-high" size={20} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

// ─── Source Picker Bottom Sheet ───────────────────────────────────────────────
const ImageSourceSheet: React.FC<{
  visible: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}> = ({ visible, onCamera, onGallery, onClose }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={sheetStyles.backdrop} activeOpacity={1} onPress={onClose} />
    <View style={sheetStyles.sheet}>
      {/* Handle bar */}
      <View style={sheetStyles.handle} />
      <Text style={sheetStyles.sheetTitle}>Add Image</Text>

      <TouchableOpacity style={sheetStyles.option} onPress={onCamera} activeOpacity={0.75}>
        <View style={[sheetStyles.optionIcon, { backgroundColor: Colors.primaryFixed }]}>
          <MaterialCommunityIcons name="camera" size={24} color={Colors.onPrimaryFixed} />
        </View>
        <View style={sheetStyles.optionText}>
          <Text style={sheetStyles.optionLabel}>Take Photo</Text>
          <Text style={sheetStyles.optionSub}>Open camera to capture a new photo</Text>
        </View>
        <Text style={sheetStyles.optionChevron}>›</Text>
      </TouchableOpacity>

      <View style={sheetStyles.divider} />

      <TouchableOpacity style={sheetStyles.option} onPress={onGallery} activeOpacity={0.75}>
        <View style={[sheetStyles.optionIcon, { backgroundColor: Colors.secondaryContainer }]}>
          <MaterialCommunityIcons name="image-multiple" size={24} color={Colors.onSecondaryContainer} />
        </View>
        <View style={sheetStyles.optionText}>
          <Text style={sheetStyles.optionLabel}>Choose from Gallery</Text>
          <Text style={sheetStyles.optionSub}>Pick an existing photo from your device</Text>
        </View>
        <Text style={sheetStyles.optionChevron}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={sheetStyles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
        <Text style={sheetStyles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </Modal>
);

// ─── Staged Image Preview (above input bar) ───────────────────────────────────
const StagedImagePreview: React.FC<{
  uri: string;
  onRemove: () => void;
}> = ({ uri, onRemove }) => (
  <View style={stagedStyles.container}>
    <Image source={{ uri }} style={stagedStyles.thumb} resizeMode="cover" />
    <TouchableOpacity style={stagedStyles.removeBtn} onPress={onRemove} activeOpacity={0.8}>
      <Text style={stagedStyles.removeBtnText}>✕</Text>
    </TouchableOpacity>
    <View style={stagedStyles.badge}>
      <Text style={stagedStyles.badgeText}>Ready to send</Text>
    </View>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const ChatScreen: React.FC<ChatScreenProps> = ({ route, navigation }) => {
  // All hooks unconditionally first
  const modelService = useModelService();
  const [roomId, setRoomId] = useState<string | undefined>(route.params?.roomId);

  const [messages, setMessages] = useState<ExtendedChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Ready');
  const [isVoiceActive, setIsVoiceActive] = useState(false);

  // Image state
  const [showSourceSheet, setShowSourceSheet] = useState(false);
  const [stagedImageUri, setStagedImageUri] = useState<string | null>(null);
  const [stagedImageContext, setStagedImageContext] = useState<string>(''); // Extracted text
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const streamCancelRef = useRef<(() => void) | null>(null);
  const responseRef = useRef('');
  const voiceSessionRef = useRef<VoiceSessionHandle | null>(null);
  const inputRef = useRef(''); // Always has latest text (avoids Android state lag)

  const updateInputText = useCallback((val: string) => {
    inputRef.current = val;
    setInputText(val);
  }, []);

  // Load old messages from Kotlin backend
  useEffect(() => {
    const loadMessages = async () => {
      if (roomId) {
        const history = await ChatBackend.getRoomHistory(roomId);
        const formatted: ExtendedChatMessage[] = history.map((m) => ({
          text: m.text,
          isUser: m.isUser,
          timestamp: new Date(m.timestamp || Date.now()),
        }));
        setMessages(formatted);
      }
    };
    loadMessages();
  }, [roomId]);

  const scrollToBottom = useCallback((delay = 120) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), delay);
  }, []);

  useEffect(() => {
    if (messages.length > 0 || currentResponse) scrollToBottom();
  }, [messages, currentResponse, scrollToBottom]);

  const handleVoiceEvent = useCallback((event: VoiceSessionEvent) => {
    switch (event.type) {
      case 'started':
      case 'listening':
        setVoiceStatus('Listening...');
        break;
      case 'transcribed':
        if (event.transcription) updateInputText(event.transcription);
        setVoiceStatus('Transcribed');
        break;
      case 'responded':
        if (event.response) {
          setMessages(prev => [...prev, { text: event.response!, isUser: false, timestamp: new Date() }]);
        }
        setVoiceStatus('Assistant responded');
        break;
      case 'error':
        setVoiceStatus(`Voice Error: ${event.error || 'Unknown'}`);
        break;
      case 'stopped':
        setVoiceStatus('Stopped');
        setIsVoiceActive(false);
        break;
      default:
        break;
    }
  }, []);

  const startVoiceSession = useCallback(async () => {
    if (isVoiceActive) return;
    setIsVoiceActive(true);
    setVoiceStatus('Starting voice pipeline...');
    try {
      voiceSessionRef.current = await RunAnywhere.startVoiceSession({
        onEvent: handleVoiceEvent,
        continuousMode: true,
        autoPlayTTS: true,
        silenceDuration: 1.0,
      });
    } catch (error) {
      setVoiceStatus(`Voice session error: ${error}`);
      setIsVoiceActive(false);
    }
  }, [isVoiceActive, handleVoiceEvent]);

  const stopVoiceSession = useCallback(async () => {
    try {
      if (voiceSessionRef.current) {
        await voiceSessionRef.current.stop();
        voiceSessionRef.current = null;
      }
    } catch (error) {
      console.error('stopVoiceSession', error);
    } finally {
      setIsVoiceActive(false);
      setVoiceStatus('Ready');
    }
  }, []);

  useEffect(() => {
    if (route.params && 'startVoice' in route.params && route.params.startVoice) {
      startVoiceSession();
    }
    return () => { stopVoiceSession().catch(console.error); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params]);

  // ── Image picking and OCR ───────────────────────────────────────────────────
  const pickerOptions = {
    mediaType: 'photo' as MediaType,
    includeBase64: false,
    maxHeight: 2000,
    maxWidth: 2000,
  };

  // OCR processing — text recognition + Kotlin-side cleaning
  const processImageForOCR = async (uri: string) => {
    try {
      setVoiceStatus('Extracting text from image...');
      const result = await TextRecognition.recognize(uri);
      if (result && result.text) {
        // Clean OCR text via Kotlin backend
        const cleaned = await ChatBackend.cleanOCRText(result.text);
        setStagedImageContext(cleaned);
        setVoiceStatus('AI READY');
      } else {
        setStagedImageContext('');
        setVoiceStatus('AI READY (No text found)');
      }
    } catch (err: any) {
      console.warn('OCR processing failed', err);
      setStagedImageContext('');
      setVoiceStatus('AI READY');
    }
  };

  const handlePickResult = useCallback((response: ImagePickerResponse) => {
    if (response.didCancel) return;
    if (response.errorMessage) {
      Alert.alert('Error', response.errorMessage);
      return;
    }
    const uri = response.assets?.[0]?.uri;
    if (uri) {
      setStagedImageUri(uri);
      processImageForOCR(uri);
    }
  }, []);

  const handleCamera = useCallback(() => {
    setShowSourceSheet(false);
    setTimeout(() => launchCamera(pickerOptions, handlePickResult), 300);
  }, [handlePickResult]);

  const handleGallery = useCallback(() => {
    setShowSourceSheet(false);
    setTimeout(() => launchImageLibrary(pickerOptions, handlePickResult), 300);
  }, [handlePickResult]);

  // ── TTS ─────────────────────────────────────────────────────────────────────
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

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    // Force keyboard to dismiss. On Android, this usually flushes the current
    // "composition" (underlined text) to the TextInput's value/onChangeText.
    Keyboard.dismiss();

    // Delay to allow Android TextInput to flush the last character/word 
    // to the ref/state after the keyboard dismiss.
    if (Platform.OS === 'android') {
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Capture text from both Ref and State. Pick the longest one to ensure 
    // nothing was dropped during the Android state sync delay.
    const textRef = inputRef.current.trim();
    const textState = inputText.trim();
    const text = textRef.length >= textState.length ? textRef : textState;

    const hasImage = !!stagedImageUri;
    if (!text && !hasImage) return;
    if (isGenerating) return;

    // The text the user sees in the bubble
    const displayText = text || (hasImage ? 'Sent an image' : '');

    // Add user message to screen
    const userMsg: ExtendedChatMessage = {
      text: displayText,
      isUser: true,
      timestamp: new Date(),
      imageUri: stagedImageUri ?? undefined,
      imageContext: stagedImageContext,
    };
    setMessages(prev => [...prev, userMsg]);

    // Auto-create room if this is a new chat
    let currentRoomId = roomId;
    if (!currentRoomId) {
      try {
        currentRoomId = await ChatBackend.createRoom('', displayText.substring(0, 50));
        setRoomId(currentRoomId);
      } catch (e) {
        console.error('Failed to create room:', e);
      }
    }

    // Save user message to Kotlin backend
    if (currentRoomId) {
      ChatBackend.saveMessage(currentRoomId, displayText, true).catch(console.error);
    }

    const currentImageContext = stagedImageContext;
    setInputText('');
    inputRef.current = '';
    setStagedImageUri(null);
    setStagedImageContext('');
    setIsGenerating(true);
    setCurrentResponse('');
    scrollToBottom(80);

    try {
      // Ask Kotlin backend to build the correct prompt (handles pipeline selection)
      const config = await ChatBackend.buildPrompt(text, currentImageContext);

      // Run LLM generation — plain text prompt, SDK handles chat template natively
      const streamResult = await RunAnywhere.generateStream(config.prompt, {
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        systemPrompt: config.systemPrompt,
      });
      streamCancelRef.current = streamResult.cancel;
      responseRef.current = '';
      for await (const token of streamResult.stream) {
        responseRef.current += token;
        setCurrentResponse(responseRef.current);
      }
      await streamResult.result;

      // Clean trailing template tokens
      let finalText = responseRef.current
        .replace(/<\|im_end\|>/g, '')
        .replace(/<\|im_start\|>/g, '')
        .trim();
      responseRef.current = '';

      // Track AI response in Kotlin session history
      await ChatBackend.trackAssistantResponse(finalText);

      // Save AI response to room
      if (currentRoomId) {
        ChatBackend.saveMessage(currentRoomId, finalText, false).catch(console.error);
      }

      // Update UI
      setCurrentResponse('');
      setIsGenerating(false);
      setMessages(prev => [...prev, {
        text: finalText,
        isUser: false,
        timestamp: new Date(),
      }]);
      scrollToBottom(150);
      scrollToBottom(500);
    } catch (error) {
      const errText = `Error: ${error}`;
      setCurrentResponse('');
      setIsGenerating(false);
      setMessages(prev => [...prev, {
        text: errText,
        isUser: false,
        timestamp: new Date(),
        isError: true,
      }]);
      scrollToBottom(150);
      scrollToBottom(500);
    }
  }, [inputText, stagedImageUri, stagedImageContext, isGenerating, roomId, scrollToBottom]);

  const handleStop = useCallback(() => {
    if (streamCancelRef.current) {
      streamCancelRef.current();
      const partial = responseRef.current;
      responseRef.current = '';
      setCurrentResponse('');
      setIsGenerating(false);
      if (partial) {
        setMessages(prev => [...prev, {
          text: partial,
          isUser: false,
          timestamp: new Date(),
          wasCancelled: true,
        }]);
        scrollToBottom(150);
        scrollToBottom(500);
      }
    }
  }, [scrollToBottom]);

  const handleClearChat = useCallback(() => {
    Alert.alert('Clear Chat', 'Are you sure you want to clear this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          setMessages([]);
          await ChatBackend.clearSessionHistory();
          if (roomId) {
            await ChatBackend.deleteRoom(roomId);
          }
        }
      }
    ])
  }, [roomId]);

  // ── Early return after all hooks ────────────────────────────────────────────
  // Only require LLM for text chat; STT/TTS are optional (for voice features)
  if (!modelService.isLLMLoaded) {
    return (
      <ModelLoaderWidget
        title="AI Model Required"
        subtitle="Download and load the AI model to start chatting"
        icon="chat"
        accentColor={Colors.primary}
        isDownloading={modelService.isLLMDownloading}
        isLoading={modelService.isLLMLoading}
        progress={modelService.llmDownloadProgress}
        onLoad={modelService.downloadAndLoadLLM}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarInner}>
            <View style={styles.topBarLeft}>
              <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#1B3A5C" />
              </TouchableOpacity>
              <View>
                <Text style={styles.topBarTitle}>Sahayak AI Chat</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: isVoiceActive ? Colors.error : Colors.secondary }]} />
                  <Text style={styles.statusLabel}>
                    {isVoiceActive ? voiceStatus.toUpperCase() : 'AI READY'}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.moreButton} activeOpacity={0.7} onPress={handleClearChat}>
              <MaterialCommunityIcons name="dots-vertical" size={24} color="#1B3A5C" />
            </TouchableOpacity>
          </View>
          <View style={styles.topBarDivider} />
        </View>

        {/* Decorative blobs */}
        <View style={styles.blobContainer} pointerEvents="none">
          <View style={[styles.blob, styles.blobTopLeft]} />
          <View style={[styles.blob, styles.blobBottomRight]} />
        </View>

        {/* Messages / Empty State */}
        {messages.length === 0 ? (
          <View style={styles.emptyContent} />
        ) : (
          <FlatList
            ref={flatListRef}
            style={{ flex: 1 }}
            data={[
              ...messages,
              ...(isGenerating
                ? [{ text: currentResponse || '...', isUser: false, timestamp: new Date() } as ExtendedChatMessage]
                : []),
            ]}
            renderItem={({ item, index }) => (
              <SahayakMessageBubble
                message={item}
                isStreaming={isGenerating && index === messages.length}
                onImagePress={uri => setPreviewImageUri(uri)}
                onPlayTTS={handlePlayTTS}
              />
            )}
            keyExtractor={(_, index) => index.toString()}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollToBottom(150)}
            onLayout={() => scrollToBottom(150)}
          />
        )}

        <ListeningPill visible={isVoiceActive && voiceStatus.toLowerCase().includes('listen')} />

        {/* Staged image preview strip (shown above input bar when image is picked) */}
        {stagedImageUri && (
          <StagedImagePreview
            uri={stagedImageUri}
            onRemove={() => { setStagedImageUri(null); setStagedImageContext(''); }}
          />
        )}

        {/* Bottom Input Bar */}
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarRow}>
            <View style={styles.inputPill}>
              <TouchableOpacity
                style={styles.pillIconButton}
                onPress={() => setShowSourceSheet(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="plus" size={24} color={Colors.primary} />
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder="Ask anything"
                placeholderTextColor={Colors.outline}
                value={inputText}
                onChangeText={updateInputText}
                onSubmitEditing={handleSend}
                editable={!isGenerating}
                multiline
                scrollEnabled
                blurOnSubmit={false}
                textAlignVertical="center"
              />

              {modelService.isVoiceAgentReady && (
                <TouchableOpacity
                  style={styles.pillIconButton}
                  onPress={isVoiceActive ? stopVoiceSession : startVoiceSession}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons 
                    name={isVoiceActive ? 'microphone-off' : 'microphone'} 
                    size={24} 
                    color={isVoiceActive ? Colors.error : Colors.primary} 
                  />
                </TouchableOpacity>
              )}
            </View>

            {isGenerating ? (
              <TouchableOpacity style={styles.sendButton} onPress={handleStop} activeOpacity={0.8}>
                <MaterialCommunityIcons name="stop" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  !inputText.trim() && !stagedImageUri && styles.sendButtonDisabled,
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() && !stagedImageUri}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="send" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Source picker bottom sheet (outside KAV so it covers full screen) */}
      <ImageSourceSheet
        visible={showSourceSheet}
        onCamera={handleCamera}
        onGallery={handleGallery}
        onClose={() => setShowSourceSheet(false)}
      />

      {/* Full-screen image preview */}
      <ImagePreviewModal
        uri={previewImageUri}
        onClose={() => setPreviewImageUri(null)}
      />
    </SafeAreaView>
  );
};

// ─── Main Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  keyboardView: { flex: 1 },
  topBar: {
    backgroundColor: 'rgba(246,250,255,0.92)',
    shadowColor: Colors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 50,
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 8 : 8,
    height: 64 + (Platform.OS === 'android' ? (StatusBar.currentHeight || 40) : 0),
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.surfaceContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { fontSize: 18, color: Colors.primary, fontWeight: '600' },
  topBarTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Manrope-SemiBold' : 'Manrope',
    fontWeight: '600', fontSize: 17, color: Colors.primary, letterSpacing: -0.3,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 9, fontWeight: '700', color: Colors.secondary, letterSpacing: 0.8, textTransform: 'uppercase' },
  moreButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceContainerLow, alignItems: 'center', justifyContent: 'center' },
  moreIcon: { fontSize: 20, color: Colors.primary, lineHeight: 22 },
  topBarDivider: { height: 1, backgroundColor: Colors.surfaceContainerLow, opacity: 0.6 },
  blobContainer: { ...StyleSheet.absoluteFillObject, zIndex: -1 },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.18 },
  blobTopLeft: { top: '-10%', left: '-15%', width: '55%', aspectRatio: 1, backgroundColor: Colors.primaryFixed },
  blobBottomRight: { bottom: '-5%', right: '-10%', width: '45%', aspectRatio: 1, backgroundColor: Colors.secondaryContainer },
  messageList: { padding: 16, paddingBottom: 8 },
  emptyContent: { flex: 1 },
  emptyIconContainer: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyIcon: { fontSize: 34 },
  emptySubtitle: { fontSize: 14, color: Colors.onSurfaceVariant, textAlign: 'center', fontWeight: '500', lineHeight: 20, maxWidth: 260, marginBottom: 28 },
  suggestionsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  suggestionChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: Colors.surfaceContainerHighest, borderRadius: 20, borderWidth: 1, borderColor: Colors.outlineVariant },
  suggestionText: { fontSize: 12, color: Colors.onSurface, fontWeight: '500' },
  listeningPill: {
    position: 'absolute', bottom: 90, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(12,29,40,0.90)', paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 999, shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 12, zIndex: 40,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  listeningDotWrapper: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  listeningDotOuter: { position: 'absolute', width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.error, opacity: 0.5 },
  listeningDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.error },
  listeningText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  bottomBar: {
    backgroundColor: 'rgba(246,250,255,0.97)',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: Colors.onSurface, shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06, shadowRadius: 24, elevation: 16,
    paddingHorizontal: 16, paddingTop: 12, 
    paddingBottom: Platform.OS === 'ios' ? 34 : 20, zIndex: 50,
  },
  bottomBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 999, paddingHorizontal: 10, minHeight: 52,
  },
  pillIconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  pillIcon: { fontSize: 18, color: Colors.onSurfaceVariant },
  pillIconActive: { color: Colors.error },
  textInput: {
    flex: 1, fontSize: 14, color: Colors.onSurface,
    maxHeight: 100, minHeight: 36,
    paddingVertical: 8, paddingHorizontal: 8, paddingRight: 4, textAlignVertical: 'center',
  },
  sendButton: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: '#0d1b2a',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 6,
  },
  sendButtonDisabled: { backgroundColor: '#3a4a5a', elevation: 0, shadowOpacity: 0 },
  sendIcon: { color: '#fff', fontSize: 18 },
  typingDots: { flexDirection: 'row', gap: 4, marginTop: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.secondary },
});

// ─── Bubble Styles ────────────────────────────────────────────────────────────
const IMAGE_BUBBLE_W = SCREEN_WIDTH * 0.62;

const bubbleStyles = StyleSheet.create({
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 16 },

  // Plain text bubble
  userBubble: {
    maxWidth: '85%', backgroundColor: Colors.primaryFixed,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 16, borderTopRightRadius: 4,
    shadowColor: Colors.onSurface, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  userText: { fontSize: 14, color: Colors.onPrimaryFixed },
  timestamp: { fontSize: 10, color: Colors.onSurface, opacity: 0.5, marginTop: 4, alignSelf: 'flex-end', fontWeight: '500' },

  attachmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  attachmentIcon: { fontSize: 12, marginRight: 4 },
  attachmentLabel: { fontSize: 11, color: Colors.onPrimaryFixed, fontWeight: '600' },

  // Image-only bubble
  imageBubble: {
    width: IMAGE_BUBBLE_W,
    borderRadius: 16, borderTopRightRadius: 4,
    overflow: 'hidden',
    shadowColor: Colors.onSurface, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 3,
  },
  inlineImage: {
    width: IMAGE_BUBBLE_W,
    height: IMAGE_BUBBLE_W * 0.72,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  imageOverlay: {
    position: 'absolute', top: 8, right: 8,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageOverlaySmall: {
    position: 'absolute', top: 6, right: 6,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  imageOverlayIcon: { fontSize: 13 },
  imageTimestamp: {
    position: 'absolute', bottom: 6, right: 10,
    fontSize: 10, color: '#fff',
    fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },

  // Image + text bubble
  userBubbleWithImage: {
    maxWidth: IMAGE_BUBBLE_W,
    backgroundColor: Colors.primaryFixed,
    borderRadius: 16, borderTopRightRadius: 4,
    overflow: 'hidden',
    shadowColor: Colors.onSurface, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  inlineImageWithText: {
    width: '100%', height: IMAGE_BUBBLE_W * 0.65,
    backgroundColor: Colors.surfaceContainerHighest,
  },
  userTextBelowImage: {
    fontSize: 14, color: Colors.onPrimaryFixed,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },

  // AI bubble
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.secondaryContainer, alignItems: 'center', justifyContent: 'center', marginTop: 4, flexShrink: 0, overflow: 'hidden' },
  aiAvatarImage: { width: 24, height: 24 },
  aiBubble: {
    maxWidth: '85%', backgroundColor: Colors.secondaryFixed,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 16, borderTopLeftRadius: 4,
    shadowColor: Colors.onSurface, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  aiText: { fontSize: 14, color: Colors.onSecondaryFixed },
  errorText: { color: Colors.error },
  cancelledText: { opacity: 0.7 },
  aiFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  aiLabel: { fontSize: 10, color: Colors.onSurface, opacity: 0.5, fontWeight: '500' },
  speakButton: { padding: 4, marginLeft: 'auto' },
  speakIcon: { fontSize: 15 },
});

// ─── Staged Preview Styles ────────────────────────────────────────────────────
const stagedStyles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  thumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerHighest,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  removeBtnText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  badge: {
    position: 'absolute',
    bottom: -6,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary,
    borderRadius: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
});

// ─── Bottom Sheet Styles ──────────────────────────────────────────────────────
const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(12,29,40,0.45)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.outlineVariant,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 16, fontWeight: '700', color: Colors.onSurface,
    marginBottom: 16, letterSpacing: -0.2,
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 14,
  },
  optionIcon: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  optionEmoji: { fontSize: 22 },
  optionText: { flex: 1 },
  optionLabel: { fontSize: 15, fontWeight: '600', color: Colors.onSurface },
  optionSub: { fontSize: 12, color: Colors.onSurfaceVariant, marginTop: 2 },
  optionChevron: { fontSize: 22, color: Colors.outline, marginRight: 4 },
  divider: { height: 1, backgroundColor: Colors.outlineVariant, opacity: 0.4, marginVertical: 4 },
  cancelBtn: {
    marginTop: 16, paddingVertical: 14,
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 16, alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: Colors.onSurfaceVariant },
});

// ─── Full-screen Preview Styles ───────────────────────────────────────────────
const imagePreviewStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
  image: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2, maxHeight: '85%' },
  closeBtn: {
    position: 'absolute', top: 52, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  closeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
