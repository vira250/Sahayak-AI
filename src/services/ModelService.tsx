import React, { createContext, useContext, useState, useCallback } from 'react';
import { RunAnywhere, ModelCategory } from '@runanywhere/core';
import { LlamaCPP } from '@runanywhere/llamacpp';
import { ONNX, ModelArtifactType } from '@runanywhere/onnx';
import TextRecognition from '@react-native-ml-kit/text-recognition';

// Model IDs - matching sample app model registry
// See: /Users/shubhammalhotra/Desktop/test-fresh/runanywhere-sdks/examples/react-native/RunAnywhereAI/App.tsx
const MODEL_IDS = {
  llm: 'lfm2-350m-q8_0', // LiquidAI LFM2 - fast and efficient
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
  ocr: 'paddle-ocr-det',
} as const;

interface ModelServiceState {
  // Download state
  isLLMDownloading: boolean;
  isSTTDownloading: boolean;
  isTTSDownloading: boolean;
  isOCRDownloading: boolean;
  
  llmDownloadProgress: number;
  sttDownloadProgress: number;
  ttsDownloadProgress: number;
  ocrDownloadProgress: number;
  
  // Load state
  isLLMLoading: boolean;
  isSTTLoading: boolean;
  isTTSLoading: boolean;
  isOCRLoading: boolean;
  
  // Loaded state
  isLLMLoaded: boolean;
  isSTTLoaded: boolean;
  isTTSLoaded: boolean;
  isOCRLoaded: boolean;
  
  isVoiceAgentReady: boolean;
  
  // Actions
  downloadAndLoadLLM: () => Promise<void>;
  downloadAndLoadSTT: () => Promise<void>;
  downloadAndLoadTTS: () => Promise<void>;
  downloadAndLoadOCR: () => Promise<void>;
  performOCR: (imagePath: string) => Promise<string>;
  performSTT?: () => Promise<string>;
  performTTS?: (text: string) => Promise<void>;
  generateLimitedResponse: (prompt: string, maxTokens: number) => Promise<string>;
  downloadAndLoadAllModels: () => Promise<void>;
  unloadAllModels: () => Promise<void>;
}

const ModelServiceContext = createContext<ModelServiceState | null>(null);

export const useModelService = () => {
  const context = useContext(ModelServiceContext);
  if (!context) {
    throw new Error('useModelService must be used within ModelServiceProvider');
  }
  return context;
};

interface ModelServiceProviderProps {
  children: React.ReactNode;
}

export const ModelServiceProvider: React.FC<ModelServiceProviderProps> = ({ children }) => {
  // Download state
  const [isLLMDownloading, setIsLLMDownloading] = useState(false);
  const [isSTTDownloading, setIsSTTDownloading] = useState(false);
  const [isTTSDownloading, setIsTTSDownloading] = useState(false);
  const [isOCRDownloading, setIsOCRDownloading] = useState(false);
  
  const [llmDownloadProgress, setLLMDownloadProgress] = useState(0);
  const [sttDownloadProgress, setSTTDownloadProgress] = useState(0);
  const [ttsDownloadProgress, setTTSDownloadProgress] = useState(0);
  const [ocrDownloadProgress, setOCRDownloadProgress] = useState(0);
  
  // Load state
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [isSTTLoading, setIsSTTLoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [isOCRLoading, setIsOCRLoading] = useState(false);
  
  // Loaded state
  const [isLLMLoaded, setIsLLMLoaded] = useState(false);
  const [isSTTLoaded, setIsSTTLoaded] = useState(false);
  const [isTTSLoaded, setIsTTSLoaded] = useState(false);
  const [isOCRLoaded, setIsOCRLoaded] = useState(false);
  
  const isVoiceAgentReady = isLLMLoaded && isSTTLoaded && isTTSLoaded;
  
  // Check if model is downloaded (per docs: use getModelInfo and check localPath)
  const checkModelDownloaded = useCallback(async (modelId: string): Promise<boolean> => {
    try {
      const modelInfo = await RunAnywhere.getModelInfo(modelId);
      return !!modelInfo?.localPath;
    } catch {
      return false;
    }
  }, []);
  
  // Download and load LLM
  const downloadAndLoadLLM = useCallback(async () => {
    console.log('=== Starting LLM Download/Load ===');
    if (isLLMDownloading || isLLMLoading) {
      console.log('Already downloading/loading, skipping');
      return;
    }
    
    try {
      console.log('Checking if LLM is already downloaded...');
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.llm);
      console.log(`LLM downloaded: ${isDownloaded}`);
      
      if (!isDownloaded) {
        console.log('Downloading LLM model...');
        setIsLLMDownloading(true);
        setLLMDownloadProgress(0);
        
        // Download with progress (per docs: progress.progress is 0-1)
        await RunAnywhere.downloadModel(MODEL_IDS.llm, (progress) => {
          console.log(`Download progress: ${(progress.progress * 100).toFixed(1)}%`);
          setLLMDownloadProgress(progress.progress * 100);
        });
        
        console.log('LLM download complete');
        setIsLLMDownloading(false);
      } else {
        console.log('LLM already downloaded, skipping download');
      }
      
      // Load the model (per docs: get localPath first, then load)
      console.log('Loading LLM model...');
      setIsLLMLoading(true);
      const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.llm);
      console.log('Model info:', {
        id: MODEL_IDS.llm,
        localPath: modelInfo?.localPath,
        category: (modelInfo as any)?.category,
      });
      
      if (modelInfo?.localPath) {
        console.log('Calling RunAnywhere.loadModel with:', modelInfo.localPath);
        const loadResult = await RunAnywhere.loadModel(modelInfo.localPath);
        console.log('Load result:', loadResult);
        
        // Verify it's loaded
        const isActuallyLoaded = await RunAnywhere.isModelLoaded();
        console.log('Verified with isModelLoaded():', isActuallyLoaded);
        
        setIsLLMLoaded(true);
        console.log('LLM model loaded and ready');
      } else {
        console.error('No localPath found for LLM model');
        setIsLLMLoaded(false);
      }
      setIsLLMLoading(false);
    } catch (error) {
      console.error('=== LLM Download/Load Error ===');
      console.error('Error:', error);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      setIsLLMDownloading(false);
      setIsLLMLoading(false);
      setIsLLMLoaded(false);
    }
  }, [isLLMDownloading, isLLMLoading, checkModelDownloaded]);
  
  // Download and load STT
  const downloadAndLoadSTT = useCallback(async () => {
    if (isSTTDownloading || isSTTLoading) return;
    
    try {
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.stt);
      
      if (!isDownloaded) {
        setIsSTTDownloading(true);
        setSTTDownloadProgress(0);
        
        await RunAnywhere.downloadModel(MODEL_IDS.stt, (progress) => {
          setSTTDownloadProgress(progress.progress * 100);
        });
        
        setIsSTTDownloading(false);
      }
      
      // Load the STT model (per docs: loadSTTModel(localPath, 'whisper'))
      setIsSTTLoading(true);
      const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.stt);
      if (modelInfo?.localPath) {
        await RunAnywhere.loadSTTModel(modelInfo.localPath, 'whisper');
        setIsSTTLoaded(true);
      }
      setIsSTTLoading(false);
    } catch (error) {
      console.error('STT download/load error:', error);
      setIsSTTDownloading(false);
      setIsSTTLoading(false);
    }
  }, [isSTTDownloading, isSTTLoading, checkModelDownloaded]);
  
  // Download and load TTS
  const downloadAndLoadTTS = useCallback(async () => {
    if (isTTSDownloading || isTTSLoading) return;
    
    try {
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.tts);
      
      if (!isDownloaded) {
        setIsTTSDownloading(true);
        setTTSDownloadProgress(0);
        
        await RunAnywhere.downloadModel(MODEL_IDS.tts, (progress) => {
          setTTSDownloadProgress(progress.progress * 100);
        });
        
        setIsTTSDownloading(false);
      }
      
      // Load the TTS model (per docs: loadTTSModel(localPath, 'piper'))
      setIsTTSLoading(true);
      const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.tts);
      if (modelInfo?.localPath) {
        await RunAnywhere.loadTTSModel(modelInfo.localPath, 'piper');
        setIsTTSLoaded(true);
      }
      setIsTTSLoading(false);
    } catch (error) {
      console.error('TTS download/load error:', error);
      setIsTTSDownloading(false);
      setIsTTSLoading(false);
    }
  }, [isTTSDownloading, isTTSLoading, checkModelDownloaded]);
  
  // Download and load OCR model (using ML Kit for text recognition)
  const downloadAndLoadOCR = useCallback(async () => {
    if (isOCRDownloading || isOCRLoading) return;

    try {
      // ML Kit doesn't require explicit download; just mark as loaded
      setIsOCRLoading(true);
      setIsOCRLoaded(true);
      setIsOCRLoading(false);
    } catch (error) {
      console.error('OCR initialization error:', error);
      setIsOCRLoading(false);
    }
  }, [isOCRDownloading, isOCRLoading]);

  // Perform OCR on selected image path using ML Kit
  const performOCR = useCallback(async (imagePath: string): Promise<string> => {
    try {
      // Use ML Kit's text recognition for OCR
      const result = await TextRecognition.recognize(imagePath);
      
      if (result && result.text) {
        return result.text;
      }
      
      return 'No text found in the image.';
    } catch (error) {
      console.error('performOCR error:', error);
      throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  // Generate a limited response from the LLM
  const generateLimitedResponse = useCallback(async (prompt: string, maxTokens: number): Promise<string> => {
    console.log('=== LLM Generation Start ===');
    console.log('Local isLLMLoaded state:', isLLMLoaded);
    console.log('Prompt length:', prompt.length);
    console.log('Prompt preview:', prompt.substring(0, 100) + '...');
    
    if (!isLLMLoaded) {
      const error = 'LLM model is not loaded yet. Please download and load it first.';
      console.error(error);
      throw new Error(error);
    }

    try {
      // Double-check with SDK API
      console.log('Checking SDK state...');
      const actuallyLoaded = await RunAnywhere.isModelLoaded();
      console.log('SDK isModelLoaded():', actuallyLoaded);
      
      if (!actuallyLoaded) {
        console.warn('SDK says model is not loaded, but local state says it is. Attempting anyway...');
      }
      
      // Get model info for debugging
      const modelInfo = await RunAnywhere.getModelInfo(MODEL_IDS.llm);
      console.log('Model info:', {
        id: MODEL_IDS.llm,
        localPath: modelInfo?.localPath,
        category: modelInfo?.category,
      });
      
      // Call generate with explicit options
      console.log('Calling RunAnywhere.generate() with options:', { maxTokens });
      const startTime = Date.now();
      const response = await RunAnywhere.generate(prompt, {
        maxTokens: Math.min(maxTokens, 500), // Cap at 500 tokens
        temperature: 0.7,
      });
      const duration = Date.now() - startTime;
      
      console.log('=== LLM Response Received ===');
      console.log('Duration:', duration, 'ms');
      console.log('Response type:', typeof response);
      console.log('Response keys:', response && typeof response === 'object' ? Object.keys(response) : 'N/A');
      console.log('Response value:', JSON.stringify(response).substring(0, 200));
      
      // Try to extract text from various response formats
      let text: string | null = null;
      
      if (typeof response === 'string') {
        console.log('Response is string');
        text = response;
      } else if (response && typeof response === 'object') {
        console.log('Response is object, attempting to extract text...');
        
        // Try various property names
        const candidates = ['text', 'content', 'response', 'answer', 'output'];
        for (const prop of candidates) {
          if (prop in response && typeof (response as any)[prop] === 'string') {
            console.log(`Found text in property "${prop}"`);
            text = (response as any)[prop];
            break;
          }
        }
        
        if (!text) {
          console.log('No text property found, checking for nested structure...');
          console.log('Full response object:', JSON.stringify(response, null, 2));
          // Last resort - stringify and hope
          text = JSON.stringify(response);
        }
      }
      
      if (!text) {
        console.warn('Failed to extract text from response');
        text = 'No response generated';
      }
      
      console.log('Extracted text length:', text.length);
      console.log('Extracted text preview:', text.substring(0, 100));
      console.log('=== LLM Generation Complete ===');
      
      return text;
    } catch (error) {
      console.error('=== LLM Generation Error ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Full error:', error);
      throw error;
    }
  }, [isLLMLoaded]);

  // Perform STT (Speech-to-Text) via Voice Session
  const performSTT = useCallback(async (): Promise<string> => {
    if (!isSTTLoaded) {
      throw new Error('STT model not loaded');
    }
    
    try {
      console.log('Starting STT voice session...');
      
      // Use voice session to capture speech
      let transcribedText = '';
      const voiceSession = await RunAnywhere.startVoiceSession({
        continuousMode: false,
        autoPlayTTS: false,
        silenceDuration: 1.5,
      });

      // Listen to events using async iteration with timeout
      const startTime = Date.now();
      const timeout = 10000; // 10 second timeout
      
      try {
        for await (const event of voiceSession.events()) {
          console.log('Voice event:', event.type, event);
          
          // Check for transcription in different event types
          if (event.type === 'transcribed' && event.transcription) {
            transcribedText = event.transcription;
            console.log('Got transcribed event:', transcribedText);
          } else if (event.type === 'turnCompleted' && event.transcription) {
            transcribedText = event.transcription;
            console.log('Got turnCompleted event:', transcribedText);
            break; // End of turn
          } else if (event.type === 'stopped') {
            console.log('Voice session stopped');
            break;
          }
          
          // Timeout safety check
          if (Date.now() - startTime > timeout) {
            console.log('STT timeout reached');
            voiceSession.stop();
            break;
          }
        }
      } catch (iterError) {
        console.log('Voice session iteration ended:', iterError);
      }

      console.log('STT result:', transcribedText);
      return transcribedText || 'No speech detected';
    } catch (error) {
      console.error('performSTT error:', error);
      return 'Error capturing speech';
    }
  }, [isSTTLoaded]);

  // Perform TTS (Text-to-Speech)
  const performTTS = useCallback(async (text: string): Promise<void> => {
    if (!isTTSLoaded) {
      console.log('TTS model not ready');
      return;
    }
    
    try {
      console.log('TTS triggered for:', text.substring(0, 50) + '...');
      
      // Use synthesize to generate speech
      await RunAnywhere.synthesize(text, {
        language: 'en-US',
      });

      console.log('TTS synthesis completed');
    } catch (error) {
      console.error('performTTS error:', error);
      // Don't throw - TTS failure shouldn't crash the chat
      console.log('TTS failed, continuing without audio');
    }
  }, [isTTSLoaded]);

  // Download and load all models
  const downloadAndLoadAllModels = useCallback(async () => {
    await Promise.all([
      downloadAndLoadLLM(),
      downloadAndLoadSTT(),
      downloadAndLoadTTS(),
      downloadAndLoadOCR(),
    ]);
  }, [downloadAndLoadLLM, downloadAndLoadSTT, downloadAndLoadTTS, downloadAndLoadOCR]);
  
  // Unload all models
  const unloadAllModels = useCallback(async () => {
    try {
      await RunAnywhere.unloadModel();
      await RunAnywhere.unloadSTTModel();
      await RunAnywhere.unloadTTSModel();
      setIsLLMLoaded(false);
      setIsSTTLoaded(false);
      setIsTTSLoaded(false);
      setIsOCRLoaded(false);
    } catch (error) {
      console.error('Error unloading models:', error);
    }
  }, []);
  
  const value: ModelServiceState = {
    isLLMDownloading,
    isSTTDownloading,
    isTTSDownloading,
    isOCRDownloading,
    llmDownloadProgress,
    sttDownloadProgress,
    ttsDownloadProgress,
    ocrDownloadProgress,
    isLLMLoading,
    isSTTLoading,
    isTTSLoading,
    isOCRLoading,
    isLLMLoaded,
    isSTTLoaded,
    isTTSLoaded,
    isOCRLoaded,
    isVoiceAgentReady,
    downloadAndLoadLLM,
    downloadAndLoadSTT,
    downloadAndLoadTTS,
    downloadAndLoadOCR,
    performOCR,
    performSTT,
    performTTS,
    generateLimitedResponse,
    downloadAndLoadAllModels,
    unloadAllModels,
  };
  
  return (
    <ModelServiceContext.Provider value={value}>
      {children}
    </ModelServiceContext.Provider>
  );
};

/**
 * Register default models with the SDK
 * Models match the sample app: /Users/shubhammalhotra/Desktop/test-fresh/runanywhere-sdks/examples/react-native/RunAnywhereAI/App.tsx
 */
export const registerDefaultModels = async () => {
  // LLM Model - LiquidAI LFM2 350M (fast, efficient, great for mobile)
  await LlamaCPP.addModel({
    id: MODEL_IDS.llm,
    name: 'LiquidAI LFM2 350M Q8_0',
    url: 'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q8_0.gguf',
    memoryRequirement: 400_000_000,
  });
  
  // Also add SmolLM2 as alternative smaller model
  await LlamaCPP.addModel({
    id: 'smollm2-360m-q8_0',
    name: 'SmolLM2 360M Q8_0',
    url: 'https://huggingface.co/prithivMLmods/SmolLM2-360M-GGUF/resolve/main/SmolLM2-360M.Q8_0.gguf',
    memoryRequirement: 500_000_000,
  });
  
  // STT Model - Sherpa Whisper Tiny English
  // Using tar.gz from RunanywhereAI/sherpa-onnx for fast native extraction
  await ONNX.addModel({
    id: MODEL_IDS.stt,
    name: 'Sherpa Whisper Tiny (ONNX)',
    url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/sherpa-onnx-whisper-tiny.en.tar.gz',
    modality: ModelCategory.SpeechRecognition,
    artifactType: ModelArtifactType.TarGzArchive,
    memoryRequirement: 75_000_000,
  });

  // OCR Model - PaddleOCR detection model
  await ONNX.addModel({
    id: MODEL_IDS.ocr,
    name: 'Medicine Detection',
    url: 'https://paddleocr.bj.bcebos.com/PP-OCRv3/chinese/ch_PP-OCRv3_det_slim_infer.tar',
    modality: ModelCategory.Vision,
    artifactType: ModelArtifactType.TarGzArchive,
    memoryRequirement: 5_000_000,
  });
  
  // TTS Model - Piper TTS (US English - Medium quality)
  await ONNX.addModel({
    id: MODEL_IDS.tts,
    name: 'Piper TTS (US English - Medium)',
    url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz',
    modality: ModelCategory.SpeechSynthesis,
    artifactType: ModelArtifactType.TarGzArchive,
    memoryRequirement: 65_000_000,
  });
};
