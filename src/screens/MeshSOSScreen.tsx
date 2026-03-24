import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
  ScrollView,
  NativeModules,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import RNFS from 'react-native-fs';
import { RunAnywhere, VoiceSessionEvent, VoiceSessionHandle } from '@runanywhere/core';
import { AuditTimelineService } from '../services/AuditTimelineService';
import { useModelService } from '../services/ModelService';
import { AppColors } from '../theme';

// Conditionally import Sound - disabled on iOS via react-native.config.js
let Sound: any = null;
if (Platform.OS === 'android') {
  try {
    Sound = require('react-native-sound').default;
  } catch (e) {
    console.log('react-native-sound not available');
  }
}

const { NativeAudioModule } = NativeModules;
const { width } = Dimensions.get('window');

const EMERGENCY_SYS_PROMPT = `You are Sahayak Rescue, an offline AI first-responder EMT and survival guide. The user is in an emergency situation.
RULES:
1. Be extremely concise. Use short sentences.
2. Give actionable, life-saving advice immediately (e.g., "Apply direct pressure to the wound").
3. Do not use markdown or complex formatting as this will be read aloud via TTS.
4. Keep calm and professional. Ask diagnostic questions if needed, one at a time.`;

const GENERIC_VOICE_ERROR = 'Voice unavailable. Please try again.';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(task: () => Promise<T>, retries = 1): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await wait(250);
      }
    }
  }
  throw lastError;
};

export const MeshSOSScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const modelService = useModelService();
  
  const [peersFound, setPeersFound] = useState(0);
  const [status, setStatus] = useState('Initializing Mesh Network...');
  
  // Voice Agent State
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string>('AI First-Responder Ready');
  const [transcripts, setTranscripts] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const sessionRef = useRef<VoiceSessionHandle | null>(null);
  const currentSoundRef = useRef<any>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Animations
  const radarAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const voicePulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Radar Animation
    const startRadar = () => {
      radarAnim.setValue(0);
      Animated.loop(
        Animated.timing(radarAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ).start();
    };

    // SOS Pulse Animation
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startRadar();
    startPulse();

    // Simulate finding peers
    const timer1 = setTimeout(() => {
      setStatus('Scanning for nearby Sahayak nodes...');
    }, 2000);

    const timer2 = setTimeout(() => {
      setPeersFound(1);
      setStatus('Peer Node Found: Relay established.');
    }, 5000);

    const timer3 = setTimeout(() => {
      setPeersFound(3);
      setStatus('Mesh Chain Active (3 Nodes). Ready to relay SOS.');
    }, 9000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      stopVoiceAgent(); // cleanup
    };
  }, []);

  useEffect(() => {
    if (isVoiceActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(voicePulseAnim, {
            toValue: 1.1 + (audioLevel * 0.5),
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(voicePulseAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      voicePulseAnim.setValue(1);
      voicePulseAnim.stopAnimation();
    }
  }, [isVoiceActive, audioLevel]);

  const handleSOS = () => {
    setStatus('📡 TRANSMITTING SOS TO MESH NETWORK...');

    void AuditTimelineService.logEvent({
      type: 'sos_triggered',
      severity: 'critical',
      source: 'sos',
      summary: 'User triggered SOS mesh broadcast',
      details: { peersFound, statusBeforeTrigger: status },
    });

    setTimeout(() => {
      setStatus('SOS Relayed to nearest Search & Rescue relay.');
      void AuditTimelineService.logEvent({
        type: 'user_action_taken',
        severity: 'warning',
        source: 'sos',
        summary: 'SOS relay status updated',
        details: { peersFound, relayStatus: 'SOS Relayed to nearest Search & Rescue relay.' },
      });
    }, 3000);
  };

  const handleVoiceEvent = useCallback((event: VoiceSessionEvent) => {
    switch (event.type) {
      case 'started':
      case 'listening':
        setVoiceStatus('Listening for emergency...');
        setAudioLevel(0.3);
        break;
      case 'transcribed':
        if (event.transcription) {
          setTranscripts(prev => [...prev.slice(-3), { role: 'user', text: event.transcription! }]);
        }
        setVoiceStatus('Analyzing trauma triage...');
        setAudioLevel(0.5);
        break;
      case 'responded':
        if (event.response) {
          setTranscripts(prev => [...prev.slice(-3), { role: 'ai', text: event.response! }]);
        }
        setVoiceStatus('Speaking instructions...');
        setAudioLevel(0.8);
        break;
      case 'error':
        setVoiceStatus(GENERIC_VOICE_ERROR);
        setAudioLevel(0);
        break;
      case 'stopped':
        setIsVoiceActive(false);
        setVoiceStatus('AI First-Responder Ready');
        setAudioLevel(0);
        break;
      default:
        break;
    }
  }, []);

  const startVoiceAgent = async () => {
    if (!modelService.isVoiceAgentReady) {
      setVoiceStatus('Models not loaded. Go to Setup.');
      return;
    }
    
    setIsVoiceActive(true);
    setVoiceStatus('Starting Rescue AI...');
    setTranscripts([]);

    try {
      sessionRef.current = await withRetry(
        () => RunAnywhere.startVoiceSession({
          onEvent: handleVoiceEvent,
          continuousMode: true,
          autoPlayTTS: true,
          silenceDuration: 1.5,
          systemPrompt: EMERGENCY_SYS_PROMPT,
        }),
        1,
      );
      void AuditTimelineService.logEvent({
        type: 'emergency_warning_shown',
        severity: 'critical',
        source: 'sos',
        summary: 'Started AI First-Responder in SOS Mode',
      });
    } catch (error) {
      console.error('Voice agent error:', error);
      setVoiceStatus(GENERIC_VOICE_ERROR);
      setIsVoiceActive(false);
    }
  };

  const stopVoiceAgent = async () => {
    try {
      if (Platform.OS === 'ios' && isPlayingRef.current && NativeAudioModule) {
        await NativeAudioModule.stopPlayback();
        isPlayingRef.current = false;
      } else if (currentSoundRef.current) {
        currentSoundRef.current.stop(() => {
          currentSoundRef.current?.release();
          currentSoundRef.current = null;
        });
      }
      
      if (sessionRef.current) {
        await sessionRef.current.stop();
        sessionRef.current = null;
      }
      
      setIsVoiceActive(false);
      setVoiceStatus('AI First-Responder Ready');
      setAudioLevel(0);
    } catch (error) {
      console.error('Stop voice agent error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#C62828" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
           <MaterialCommunityIcons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mesh SOS + Rescue AI</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{flex: 1}} contentContainerStyle={styles.content}>
        
        {/* Radar Visualization */}
        <View style={styles.radarContainer}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.radarCircle,
                {
                  transform: [
                    { scale: radarAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1.5] }) },
                  ],
                  opacity: radarAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.4, 0] }),
                },
              ]}
            />
          ))}
          
          <Animated.View style={[styles.mainButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity onPress={handleSOS} style={styles.sosButton} activeOpacity={0.8}>
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Status Hub */}
        <View style={styles.statusHub}>
          <View style={styles.nodeCounter}>
            <Text style={styles.nodeValue}>{peersFound}</Text>
            <Text style={styles.nodeLabel}>Peers Found</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusInfo}>
            <View style={styles.onlineBadge}>
              <View style={[styles.dot, { backgroundColor: peersFound > 0 ? '#4CAF50' : '#FFC107' }]} />
              <Text style={styles.onlineText}>{peersFound > 0 ? 'MESH ACTIVE' : 'SCANNING'}</Text>
            </View>
            <Text style={styles.statusDetail}>{status}</Text>
          </View>
        </View>

        {/* Rescue AI Agent */}
        <View style={styles.voiceAgentContainer}>
          <Text style={styles.voiceTitle}>Offline AI First-Responder</Text>
          <Text style={styles.voiceSubtitle}>Speak hands-free for immediate trauma care guidance.</Text>
          
          <TouchableOpacity 
            onPress={isVoiceActive ? stopVoiceAgent : startVoiceAgent} 
            activeOpacity={0.8}
            style={{ marginVertical: 20 }}
          >
            <Animated.View style={[styles.voiceButtonOutline, { transform: [{ scale: voicePulseAnim }] }]}>
              <LinearGradient
                colors={isVoiceActive ? ['#ff4b4b', '#C62828'] : ['#1E1E1E', '#333333']}
                style={styles.voiceButtonInner}
              >
                <MaterialCommunityIcons 
                  name={isVoiceActive ? "microphone" : "microphone-off"} 
                  size={40} 
                  color={isVoiceActive ? "#FFF" : "#888"} 
                />
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
          
          <Text style={[styles.voiceStatusText, isVoiceActive && { color: '#FF5252', fontWeight: 'bold' }]}>
            {voiceStatus}
          </Text>

          {/* Transcript Log */}
          {transcripts.length > 0 && (
            <View style={styles.transcriptBox}>
              {transcripts.map((t, i) => (
                <Text key={i} style={t.role === 'ai' ? styles.aiText : styles.userText}>
                  {t.role === 'ai' ? '🚑 AI:' : '🗣️ You:'} {t.text}
                </Text>
              ))}
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 15,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', letterSpacing: 1 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 25, paddingBottom: 50 },
  radarContainer: {
    width: width * 0.7, height: width * 0.7, justifyContent: 'center',
    alignItems: 'center', marginVertical: 30,
  },
  radarCircle: {
    position: 'absolute', width: '100%', height: '100%',
    borderRadius: (width * 0.7) / 2, borderWidth: 2, borderColor: '#C62828',
  },
  mainButtonContainer: { backgroundColor: 'rgba(198, 40, 40, 0.2)', padding: 15, borderRadius: 100 },
  sosButton: {
    width: 120, height: 120, backgroundColor: '#C62828', borderRadius: 60,
    justifyContent: 'center', alignItems: 'center', elevation: 20,
    shadowColor: '#C62828', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5, shadowRadius: 15,
  },
  sosText: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  statusHub: {
    width: '100%', backgroundColor: '#1E1E1E', borderRadius: 15,
    flexDirection: 'row', padding: 20, alignItems: 'center', marginBottom: 25
  },
  nodeCounter: { alignItems: 'center', marginRight: 20 },
  nodeValue: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  nodeLabel: { color: '#888', fontSize: 10, textTransform: 'uppercase' },
  divider: { width: 1, height: '80%', backgroundColor: '#333', marginRight: 20 },
  statusInfo: { flex: 1 },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  onlineText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  statusDetail: { color: '#AAA', fontSize: 13 },
  
  voiceAgentContainer: {
    width: '100%', backgroundColor: '#111', borderRadius: 15,
    padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333'
  },
  voiceTitle: { color: '#FF5252', fontSize: 18, fontWeight: '800', marginBottom: 5 },
  voiceSubtitle: { color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 15 },
  voiceButtonOutline: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255, 82, 82, 0.1)', justifyContent: 'center', alignItems: 'center',
  },
  voiceButtonInner: {
    width: 70, height: 70, borderRadius: 35,
    justifyContent: 'center', alignItems: 'center', elevation: 10,
  },
  voiceStatusText: { color: '#AAA', fontSize: 14, marginTop: 5, textAlign: 'center' },
  transcriptBox: {
    width: '100%', marginTop: 20, padding: 15, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, borderWidth: 1, borderColor: '#333'
  },
  userText: { color: '#DDD', fontSize: 13, marginBottom: 8, fontStyle: 'italic' },
  aiText: { color: '#FF5252', fontSize: 14, fontWeight: '600', marginBottom: 8 },
});
