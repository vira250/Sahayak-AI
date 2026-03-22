import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  NativeModules,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import RNFS from 'react-native-fs';
import { RunAnywhere, VoiceSessionEvent, VoiceSessionHandle } from '@runanywhere/core';
import { AppColors } from '../theme';
import { useModelService } from '../services/ModelService';
import { ModelLoaderWidget, AudioVisualizer } from '../components';

// Audio playback modules (same as VoicePipelineScreen)
let Sound: any = null;
if (Platform.OS === 'android') {
  try {
    Sound = require('react-native-sound').default;
  } catch (e) {
    console.log('react-native-sound not available');
  }
}
const { NativeAudioModule } = NativeModules;

interface Note {
  transcript: string;
  summary: string;
  timestamp: Date;
}

const MODEL_IDS = {
  llm: 'lfm2-350m-q8_0',
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
};

export const SmartNotesScreen: React.FC = () => {
  const modelService = useModelService();
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState<string>('Ready to record');
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentSummary, setCurrentSummary] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const sessionRef = useRef<VoiceSessionHandle | null>(null);
  const currentSoundRef = useRef<any>(null);
  const isPlayingRef = useRef<boolean>(false);

  // Handle voice session events
  const handleVoiceEvent = useCallback((event: any) => {
    switch (event.type) {
      case 'sessionStarted':
        setStatus('Listening...');
        setAudioLevel(0.2);
        break;
      case 'speechDetected':
        setStatus('Hearing you...');
        setAudioLevel(0.7);
        break;
      case 'transcribing':
        setStatus('Transcribing...');
        setAudioLevel(0.4);
        break;
      case 'transcriptionComplete':
        if (event.data?.transcript) {
          setCurrentTranscript(event.data.transcript);
        }
        setStatus('Summarizing note...');
        break;
      case 'generating':
        setStatus('Analyzing...');
        break;
      case 'generationComplete':
        if (event.data?.response) {
          setCurrentSummary(event.data.response);
        }
        setStatus('Synthesizing confirmation...');
        break;
      case 'synthesisComplete':
        setStatus('Done');
        if (event.data?.audio) {
          playAudio(event.data.audio);
        }
        break;
      case 'turnComplete':
        setIsActive(false);
        setStatus('Saved');
        // Add to list if we have content
        if (currentTranscript && currentSummary) {
           setNotes(prev => [{
             transcript: currentTranscript,
             summary: currentSummary,
             timestamp: new Date()
           }, ...prev]);
        }
        break;
      case 'error':
        setStatus(`Error: ${event.data?.error}`);
        setIsActive(false);
        break;
    }
  }, [currentTranscript, currentSummary]);

  // Convert base64 float32 PCM to WAV format
  const createWavFromBase64Float32 = (base64Audio: string, sampleRate: number): string => {
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const float32Samples = new Float32Array(bytes.buffer);
    const numSamples = float32Samples.length;

    const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(wavBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, numSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < float32Samples.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    const uint8Array = new Uint8Array(wavBuffer);
    let result = '';
    for (let i = 0; i < uint8Array.length; i++) {
      result += String.fromCharCode(uint8Array[i]);
    }
    return btoa(result);
  };

  // Utility for audio playback
  const playAudio = async (base64Audio: string) => {
    try {
      if (Platform.OS === 'ios' && NativeAudioModule) {
        isPlayingRef.current = true;
        setAudioLevel(0.8);
        await NativeAudioModule.playAudioBase64(base64Audio, 22050);
        isPlayingRef.current = false;
        setAudioLevel(0.3);
      } else if (Platform.OS === 'android' && Sound) {
        const wavData = createWavFromBase64Float32(base64Audio, 22050);
        const tempPath = `${RNFS.TemporaryDirectoryPath}/note_confirm_${Date.now()}.wav`;
        await RNFS.writeFile(tempPath, wavData, 'base64');

        const sound = new Sound(tempPath, '', (error: any) => {
          if (error) {
            console.error('Failed to load sound:', error);
            return;
          }
          
          currentSoundRef.current = sound;
          setAudioLevel(0.8);
          
          sound.play(() => {
            sound.release();
            currentSoundRef.current = null;
            setAudioLevel(0.3);
          });
        });
      }
    } catch (e) {
      console.error(e);
      isPlayingRef.current = false;
      setAudioLevel(0.3);
    }
  };

  const startRecording = async () => {
    setCurrentTranscript('');
    setCurrentSummary('');
    setIsActive(true);
    setStatus('Initializing...');

    try {
      sessionRef.current = await (RunAnywhere as any).startVoiceSession(
        {
          agentConfig: {
            llmModelId: MODEL_IDS.llm,
            sttModelId: MODEL_IDS.stt,
            ttsModelId: MODEL_IDS.tts,
            systemPrompt: 'You are a smart note-taker. Extract a 1-sentence summary and 3 key bullet points from the following speech. Format your response clearly.',
          },
          enableVAD: true,
          vadSensitivity: 0.6,
          speechTimeout: 2000,
        },
        handleVoiceEvent
      );
    } catch (error) {
      console.error(error);
      setIsActive(false);
    }
  };

  const stopRecording = async () => {
    if (sessionRef.current) {
      await sessionRef.current.stop();
      sessionRef.current = null;
    }
    setIsActive(false);
    setStatus('Ready to record');
  };

  if (!modelService.isVoiceAgentReady) {
    return (
      <ModelLoaderWidget
        title="Smart Notes Requires Models"
        subtitle="Download and load all models to start taking voice notes"
        icon="mic"
        accentColor={AppColors.accentOrange}
        isDownloading={modelService.isLLMDownloading || modelService.isSTTDownloading || modelService.isTTSDownloading}
        isLoading={modelService.isLLMLoading || modelService.isSTTLoading || modelService.isTTSLoading}
        progress={(modelService.llmDownloadProgress + modelService.sttDownloadProgress + modelService.ttsDownloadProgress) / 3}
        onLoad={modelService.downloadAndLoadAllModels}
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.recordSection}>
          <AudioVisualizer level={isActive ? audioLevel : 0} />
          <Text style={styles.statusText}>{status}</Text>
          <TouchableOpacity
            onPress={isActive ? stopRecording : startRecording}
            style={[styles.recordButton, isActive && styles.activeButton]}
          >
            <MaterialCommunityIcons 
              name={isActive ? 'stop' : 'microphone'} 
              size={32} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>

        {currentTranscript ? (
          <View style={styles.resultCard}>
            <Text style={styles.cardLabel}>STT Transcript:</Text>
            <Text style={styles.transcriptText}>{currentTranscript}</Text>
            
            {currentSummary ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.cardLabel}>AI Summary:</Text>
                <Text style={styles.summaryText}>{currentSummary}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.historyTitle}>Recent Notes</Text>
        {notes.length === 0 ? (
          <Text style={styles.emptyText}>No notes yet. Start recording!</Text>
        ) : (
          notes.map((note, idx) => (
            <View key={idx} style={styles.noteItem}>
              <Text style={styles.noteDate}>{note.timestamp.toLocaleTimeString()}</Text>
              <Text style={styles.noteSummary} numberOfLines={2}>{note.summary}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { padding: 20 },
  recordSection: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#F0F4F8',
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusText: { color: AppColors.textPrimary, fontSize: 18, marginVertical: 15, fontWeight: '600' },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1B3A5C',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#1B3A5C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  activeButton: { backgroundColor: AppColors.error },
  recordIcon: { fontSize: 32, color: '#fff' },
  resultCard: {
    backgroundColor: '#F0F4F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLabel: { color: '#1B3A5C', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  transcriptText: { color: AppColors.textPrimary, fontSize: 14, lineHeight: 20 },
  summaryText: { color: AppColors.textPrimary, fontSize: 15, fontWeight: '500', lineHeight: 22 },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  historyTitle: { color: AppColors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 15 },
  emptyText: { color: AppColors.textMuted, textAlign: 'center', marginTop: 20 },
  noteItem: {
    backgroundColor: '#F0F4F8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteDate: { color: AppColors.textMuted, fontSize: 10, marginBottom: 4 },
  noteSummary: { color: AppColors.textSecondary, fontSize: 14 },
});
