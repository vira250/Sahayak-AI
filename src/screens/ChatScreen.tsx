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
} from 'react-native';
import { launchImageLibrary, launchCamera, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { RunAnywhere, VoiceSessionEvent, VoiceSessionHandle } from '@runanywhere/core';
import { useModelService } from '../services/ModelService';
import { ChatMessage, ModelLoaderWidget } from '../components';
import { RoomService } from '../services/RoomService';
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
              <Text style={bubbleStyles.imageOverlayIcon}>🔍</Text>
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
                <Text style={bubbleStyles.imageOverlayIcon}>🔍</Text>
              </View>
            </TouchableOpacity>
            {hasImageContext && (
              <View style={bubbleStyles.attachmentBadge}>
                <Text style={bubbleStyles.attachmentIcon}>📄</Text>
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
               <Text style={bubbleStyles.attachmentIcon}>📸</Text>
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
        <Text style={bubbleStyles.aiAvatarIcon}>⚡</Text>
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
              <Text style={bubbleStyles.speakIcon}>🔊</Text>
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
          <Text style={sheetStyles.optionEmoji}>📷</Text>
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
          <Text style={sheetStyles.optionEmoji}>🖼️</Text>
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
  const roomId = route.params?.roomId;

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

  // Load old messages from RoomService
  useEffect(() => {
    const loadMessages = async () => {
      if (roomId) {
        const history = await RoomService.getRoomHistory(roomId);
        const formatted: ExtendedChatMessage[] = history.map((m: ChatMessage) => ({
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
        if (event.transcription) setInputText(event.transcription);
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

  const processImageForOCR = async (uri: string) => {
    try {
      setVoiceStatus('Extracting text from image...');
      const result = await TextRecognition.recognize(uri);
      if (result && result.text) {
        setStagedImageContext(result.text);
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
    const text = inputText.trim();
    const hasImage = !!stagedImageUri;
    if (!text && !hasImage) return;
    if (isGenerating) return;

    // The text the user sees in the bubble (clean, no OCR dump)
    const displayText = text || (hasImage ? 'Sent an image' : '');

    // The text sent to the LLM (includes silent OCR context if available)
    let llmUserText = text || 'Please analyze and describe what you see in the attached context.';
    if (stagedImageContext) {
      llmUserText = `[Image OCR Context]\n${stagedImageContext}\n[End Image Context]\n\n${llmUserText}`;
    }

    // Add user message to screen (display text only — no OCR dump visible)
    const userMsg: ExtendedChatMessage = {
      text: displayText,
      isUser: true,
      timestamp: new Date(),
      imageUri: stagedImageUri ?? undefined,
      imageContext: stagedImageContext, // kept for internal reference
    };
    
    // Capture updated messages INCLUDING the new user message for history building
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    
    // Save to RoomService (background)
    if (roomId) {
      RoomService.addMessageToRoom(roomId, {
        text: llmUserText,
        isUser: true,
        timestamp: new Date()
      }).catch((e: any) => console.error(e));
    }

    setInputText('');
    setStagedImageUri(null);
    setStagedImageContext('');
    setIsGenerating(true);
    setCurrentResponse('');
    scrollToBottom(80);

    // ── Build full conversation history from in-memory messages ──
    try {
      // System prompt gives the LLM its identity and response style
      let fullPrompt = 'You are Sahayak AI, a helpful, friendly on-device assistant. '
        + 'IMPORTANT RULES:\n'
        + '- Match your answer length to the question complexity. For simple yes/no questions, answer in one short sentence.\n'
        + '- For factual questions, give a brief, direct answer first, then a short explanation only if needed.\n'
        + '- Only give long detailed answers when the user asks for explanations, lists, or detailed help.\n'
        + '- Stay on topic and remember the conversation context.\n'
        + '- When the user shares image context, use it naturally without mentioning OCR or extracted text.\n\n';

      // Build multi-turn history from ALL in-memory messages (last 10 turns max)
      const historyWindow = updatedMessages.slice(-10);
      for (const msg of historyWindow) {
        if (msg.isUser) {
          // For user messages that had image context, reconstruct what the LLM should see
          let content = msg.text;
          if (msg.imageContext) {
            content = `[Image OCR Context]\n${msg.imageContext}\n[End Image Context]\n\n${msg.text}`;
          }
          fullPrompt += `User: ${content}\n\n`;
        } else {
          fullPrompt += `Assistant: ${msg.text}\n\n`;
        }
      }
      fullPrompt += 'Assistant:';

      const streamResult = await RunAnywhere.generateStream(fullPrompt, {
        maxTokens: 512,
        temperature: 0.7,
      });
      streamCancelRef.current = streamResult.cancel;
      responseRef.current = '';
      for await (const token of streamResult.stream) {
        responseRef.current += token;
        setCurrentResponse(responseRef.current);
      }
      await streamResult.result;
      const finalText = responseRef.current;
      responseRef.current = '';
      
      // Save assistant response
      if (roomId) {
        RoomService.addMessageToRoom(roomId, {
          text: finalText,
          isUser: false,
          timestamp: new Date()
        }).catch((e: any) => console.error(e));
      }

      // Settle streaming state
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
      { text: 'Clear', style: 'destructive', onPress: async () => {
        setMessages([]);
        if (roomId) {
          // Just reset visually, no easy way to clear RoomService besides deleteRoom
          await RoomService.deleteRoom(roomId);
        }
      }}
    ])
  }, [roomId]);

  // ── Early return after all hooks ────────────────────────────────────────────
  if (!modelService.isVoiceAgentReady) {
    return (
      <ModelLoaderWidget
        title="Voice Models Required"
        subtitle="Download and load speech-to-text and text-to-speech models to use voice features"
        icon="chat"
        accentColor={Colors.primary}
        isDownloading={modelService.isSTTDownloading || modelService.isTTSDownloading || modelService.isLLMDownloading}
        isLoading={modelService.isSTTLoading || modelService.isTTSLoading || modelService.isLLMLoading}
        progress={Math.max(modelService.sttDownloadProgress, modelService.ttsDownloadProgress, modelService.llmDownloadProgress)}
        onLoad={modelService.downloadAndLoadAllModels}
      />
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Top Bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarInner}>
            <View style={styles.topBarLeft}>
              <TouchableOpacity style={styles.backButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
                <Text style={styles.backIcon}>←</Text>
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
              <Text style={styles.moreIcon}>⋮</Text>
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
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Text style={styles.emptyIcon}>🤖</Text>
            </View>
            <Text style={styles.emptySubtitle}>
              Start a conversation or send an image to interact with Sahayak AI.
            </Text>
            <View style={styles.suggestionsContainer}>
              {(['Tell me a joke', 'What is AI?', 'Write a haiku'] as const).map(chip => (
                <TouchableOpacity
                  key={chip}
                  style={styles.suggestionChip}
                  onPress={() => setInputText(chip)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
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
                <Text style={styles.pillIcon}>⬆</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                placeholder="Ask anything"
                placeholderTextColor={Colors.outline}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                editable={!isGenerating}
                multiline
                scrollEnabled
                blurOnSubmit={false}
                textAlignVertical="center"
              />

              <TouchableOpacity
                style={styles.pillIconButton}
                onPress={isVoiceActive ? stopVoiceSession : startVoiceSession}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillIcon, isVoiceActive && styles.pillIconActive]}>
                  {isVoiceActive ? '🔴' : '🎙'}
                </Text>
              </TouchableOpacity>
            </View>

            {isGenerating ? (
              <TouchableOpacity style={styles.sendButton} onPress={handleStop} activeOpacity={0.8}>
                <Text style={styles.sendIcon}>⏹</Text>
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
                <Text style={styles.sendIcon}>➤</Text>
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
    height: 64,
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
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingBottom: 60 },
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
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, zIndex: 50,
  },
  bottomBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inputPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceContainerHighest,
    borderRadius: 999, paddingHorizontal: 6, minHeight: 52,
  },
  pillIconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  pillIcon: { fontSize: 18, color: Colors.onSurfaceVariant },
  pillIconActive: { color: Colors.error },
  textInput: {
    flex: 1, fontSize: 14, color: Colors.onSurface,
    maxHeight: 100, minHeight: 36,
    paddingVertical: 8, paddingHorizontal: 4, textAlignVertical: 'center',
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
  userText: { fontSize: 14, color: Colors.onPrimaryFixed, lineHeight: 20 },
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
    fontSize: 14, color: Colors.onPrimaryFixed, lineHeight: 20,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4,
  },

  // AI bubble
  aiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 16 },
  aiAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.secondaryContainer, alignItems: 'center', justifyContent: 'center', marginTop: 4, flexShrink: 0 },
  aiAvatarIcon: { fontSize: 14 },
  aiBubble: {
    maxWidth: '85%', backgroundColor: Colors.secondaryFixed,
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 16, borderTopLeftRadius: 4,
    shadowColor: Colors.onSurface, shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  aiText: { fontSize: 14, color: Colors.onSecondaryFixed, lineHeight: 20 },
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
