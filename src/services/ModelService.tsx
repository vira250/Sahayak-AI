import React, { createContext, useContext, useState, useCallback } from 'react';
import { RunAnywhere, ModelCategory } from '@runanywhere/core';
import { LlamaCPP } from '@runanywhere/llamacpp';
import { ONNX, ModelArtifactType } from '@runanywhere/onnx';

// Model IDs - matching sample app model registry
// See: /Users/shubhammalhotra/Desktop/test-fresh/runanywhere-sdks/examples/react-native/RunAnywhereAI/App.tsx
const MODEL_IDS = {
  llm: 'smollm2-360m-q8_0',
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
  img: 'nanollava-q4_0',
} as const;

interface ModelServiceState {
  // Download state
  isLLMDownloading: boolean;
  isSTTDownloading: boolean;
  isTTSDownloading: boolean;
  isIMGDownloading: boolean;
  
  llmDownloadProgress: number;
  sttDownloadProgress: number;
  ttsDownloadProgress: number;
  imgDownloadProgress: number;
  
  // Load state
  isLLMLoading: boolean;
  isSTTLoading: boolean;
  isTTSLoading: boolean;
  isIMGLoading: boolean;
  
  // Loaded state
  isLLMLoaded: boolean;
  isSTTLoaded: boolean;
  isTTSLoaded: boolean;
  isIMGLoaded: boolean;
  
  isVoiceAgentReady: boolean;
  
  // Actions
  downloadAndLoadLLM: () => Promise<void>;
  downloadAndLoadSTT: () => Promise<void>;
  downloadAndLoadTTS: () => Promise<void>;
  downloadAndLoadIMG: () => Promise<void>;
  downloadAndLoadAllModels: () => Promise<void>;
  unloadAllModels: () => Promise<void>;
  checkAllModelsDownloaded: () => Promise<boolean>;
  completeSetup: () => Promise<void>;
  isAllDownloaded: boolean;
  hasCompletedSetup: boolean;
  isSetupReady: boolean;
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
  const [isIMGDownloading, setIsIMGDownloading] = useState(false);
  
  const [llmDownloadProgress, setLLMDownloadProgress] = useState(0);
  const [sttDownloadProgress, setSTTDownloadProgress] = useState(0);
  const [ttsDownloadProgress, setTTSDownloadProgress] = useState(0);
  const [imgDownloadProgress, setIMGDownloadProgress] = useState(0);
  
  // Load state
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [isSTTLoading, setIsSTTLoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  const [isIMGLoading, setIsIMGLoading] = useState(false);
  
  // Loaded state
  const [isLLMLoaded, setIsLLMLoaded] = useState(false);
  const [isSTTLoaded, setIsSTTLoaded] = useState(false);
  const [isTTSLoaded, setIsTTSLoaded] = useState(false);
  const [isIMGLoaded, setIsIMGLoaded] = useState(false);
  const [hasCompletedSetup, setHasCompletedSetup] = useState(false);
  
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
  
  // Helper: download and load a single LLM model by ID
  const tryDownloadAndLoadLLM = useCallback(async (modelId: string): Promise<boolean> => {
    let modelPath: string | null = null;

    // Check if model is already downloaded
    const modelInfo = await RunAnywhere.getModelInfo(modelId);
    const isDownloaded = !!modelInfo?.localPath;
    console.log(`LLM Model ${modelId} downloaded:`, isDownloaded);

    if (!isDownloaded) {
      setIsLLMDownloading(true);
      setLLMDownloadProgress(0);
      console.log(`Starting download for ${modelId}...`);
      modelPath = await RunAnywhere.downloadModel(modelId, (progress) => {
        setLLMDownloadProgress(progress.progress * 100);
      });
      setIsLLMDownloading(false);
    } else {
      modelPath = await RunAnywhere.getModelPath(modelId);
    }

    if (!modelPath) {
      throw new Error(`Model path not found for ${modelId}`);
    }

    // Try loading the model
    try {
      console.log(`Loading LLM model from path: ${modelPath}`);
      setIsLLMLoading(true);
      await RunAnywhere.loadModel(modelPath);
      console.log(`Successfully loaded LLM model: ${modelId}`);
      setIsLLMLoaded(true);
      setIsLLMLoading(false);
      return true;
    } catch (loadError: any) {
      console.warn(`Load failed for ${modelId} (${loadError?.message || loadError}), re-downloading...`);
      // Model file might be corrupted or missing — force re-download
      setIsLLMLoading(false);
      setIsLLMDownloading(true);
      setLLMDownloadProgress(0);
      modelPath = await RunAnywhere.downloadModel(modelId, (progress) => {
        setLLMDownloadProgress(progress.progress * 100);
      });
      setIsLLMDownloading(false);

      if (!modelPath) {
        throw new Error(`Re-download failed for ${modelId}`);
      }

      console.log(`Re-loading LLM model from path: ${modelPath}`);
      setIsLLMLoading(true);
      await RunAnywhere.loadModel(modelPath);
      console.log(`Successfully loaded LLM model on retry: ${modelId}`);
      setIsLLMLoaded(true);
      setIsLLMLoading(false);
      return true;
    }
  }, []);

  // Download and load LLM (with fallback to alternative model)
  const downloadAndLoadLLM = useCallback(async () => {
    if (isLLMDownloading || isLLMLoading) return;

    const modelsToTry = [MODEL_IDS.llm, 'lfm2-350m-q8_0'];

    for (const modelId of modelsToTry) {
      try {
        const success = await tryDownloadAndLoadLLM(modelId);
        if (success) return; // loaded successfully
      } catch (error) {
        console.error(`LLM error for ${modelId}:`, error);
        // Reset states and try next model
        setIsLLMDownloading(false);
        setIsLLMLoading(false);
      }
    }

    // All models failed
    console.error('All LLM models failed to load');
    setIsLLMDownloading(false);
    setIsLLMLoading(false);
  }, [isLLMDownloading, isLLMLoading, tryDownloadAndLoadLLM]);
  
  // Download and load STT
  const downloadAndLoadSTT = useCallback(async () => {
    if (isSTTDownloading || isSTTLoading) return;
    
    try {
      let modelPath: string | null = null;
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.stt);
      
      if (!isDownloaded) {
        setIsSTTDownloading(true);
        setSTTDownloadProgress(0);
        
        modelPath = await RunAnywhere.downloadModel(MODEL_IDS.stt, (progress) => {
          setSTTDownloadProgress(progress.progress * 100);
        });
        
        setIsSTTDownloading(false);
      } else {
        modelPath = await RunAnywhere.getModelPath(MODEL_IDS.stt);
      }
      
      if (modelPath) {
        setIsSTTLoading(true);
        await RunAnywhere.loadSTTModel(modelPath, 'whisper');
        setIsSTTLoaded(true);
        setIsSTTLoading(false);
      } else {
        console.error('STT model path not found after download');
      }
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
      let modelPath: string | null = null;
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.tts);
      
      if (!isDownloaded) {
        setIsTTSDownloading(true);
        setTTSDownloadProgress(0);
        
        modelPath = await RunAnywhere.downloadModel(MODEL_IDS.tts, (progress) => {
          setTTSDownloadProgress(progress.progress * 100);
        });
        
        setIsTTSDownloading(false);
      } else {
        modelPath = await RunAnywhere.getModelPath(MODEL_IDS.tts);
      }
      
      if (modelPath) {
        setIsTTSLoading(true);
        await RunAnywhere.loadTTSModel(modelPath, 'piper');
        setIsTTSLoaded(true);
        setIsTTSLoading(false);
      } else {
        console.error('TTS model path not found after download');
      }
    } catch (error) {
      console.error('TTS download/load error:', error);
      setIsTTSDownloading(false);
      setIsTTSLoading(false);
    }
  }, [isTTSDownloading, isTTSLoading, checkModelDownloaded]);
  
  // Download and load Image Model
  // NOTE: llama.cpp can only hold one model at a time.
  // The IMG model is downloaded only and loaded on-demand when needed for vision tasks.
  const downloadAndLoadIMG = useCallback(async () => {
    if (isIMGDownloading || isIMGLoading) return;
    
    try {
      const isDownloaded = await checkModelDownloaded(MODEL_IDS.img);
      
      if (!isDownloaded) {
        setIsIMGDownloading(true);
        setIMGDownloadProgress(0);
        
        await RunAnywhere.downloadModel(MODEL_IDS.img, (progress) => {
          setIMGDownloadProgress(progress.progress * 100);
        });
        
        setIsIMGDownloading(false);
      }
      
      // Mark as ready (download-only; loaded on-demand for vision tasks)
      setIsIMGLoaded(true);
      setIsIMGLoading(false);
      console.log('IMG model downloaded and ready for on-demand use');
    } catch (error) {
      console.error('IMG download error:', error);
      // Mark as loaded anyway so user can proceed - IMG is optional
      setIsIMGLoaded(true);
      setIsIMGDownloading(false);
      setIsIMGLoading(false);
    }
  }, [isIMGDownloading, isIMGLoading, checkModelDownloaded]);
  
  // Check if all models are downloaded
  const [isAllDownloaded, setIsAllDownloadedState] = useState(false);
  
  const checkAllModelsDownloaded = useCallback(async (): Promise<boolean> => {
    const llm = await checkModelDownloaded(MODEL_IDS.llm);
    const stt = await checkModelDownloaded(MODEL_IDS.stt);
    const tts = await checkModelDownloaded(MODEL_IDS.tts);
    const img = await checkModelDownloaded(MODEL_IDS.img);
    const all = llm && stt && tts && img;
    setIsAllDownloadedState(all);
    return all;
  }, [checkModelDownloaded]);
  
  const isSetupReady = isAllDownloaded || hasCompletedSetup;
  
  // Download and load all models
  const downloadAndLoadAllModels = useCallback(async () => {
    await Promise.all([
      downloadAndLoadLLM(),
      downloadAndLoadSTT(),
      downloadAndLoadTTS(),
      downloadAndLoadIMG(),
    ]);
  }, [downloadAndLoadLLM, downloadAndLoadSTT, downloadAndLoadTTS, downloadAndLoadIMG]);
  
  // Unload all models
  const unloadAllModels = useCallback(async () => {
    try {
      await RunAnywhere.unloadModel();
      await RunAnywhere.unloadSTTModel();
      await RunAnywhere.unloadTTSModel();
      setIsLLMLoaded(false);
      setIsSTTLoaded(false);
      setIsTTSLoaded(false);
      setIsIMGLoaded(false);
    } catch (error) {
      console.error('Error unloading models:', error);
    }
  }, []);
  
  // Mark setup as complete
  const completeSetup = useCallback(async () => {
    // We can also use AsyncStorage here if needed, but for now 
    // we'll rely on the isAllDownloaded check and this memory state
    setHasCompletedSetup(true);
  }, []);
  
  const value: ModelServiceState = {
    isLLMDownloading,
    isSTTDownloading,
    isTTSDownloading,
    isIMGDownloading,
    llmDownloadProgress,
    sttDownloadProgress,
    ttsDownloadProgress,
    imgDownloadProgress,
    isLLMLoading,
    isSTTLoading,
    isTTSLoading,
    isIMGLoading,
    isLLMLoaded,
    isSTTLoaded,
    isTTSLoaded,
    isIMGLoaded,
    isVoiceAgentReady,
    isSetupReady,
    hasCompletedSetup,
    downloadAndLoadLLM,
    downloadAndLoadSTT,
    downloadAndLoadTTS,
    downloadAndLoadIMG,
    downloadAndLoadAllModels,
    unloadAllModels,
    checkAllModelsDownloaded,
    completeSetup,
    isAllDownloaded,
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
  // LLM Model - SmolLM2 360M (standard Llama-based architecture, highly compatible)
  await LlamaCPP.addModel({
    id: MODEL_IDS.llm,
    name: 'SmolLM2 360M Q8_0',
    url: 'https://huggingface.co/prithivMLmods/SmolLM2-360M-GGUF/resolve/main/SmolLM2-360M.Q8_0.gguf',
    memoryRequirement: 500_000_000,
  });
  
  // Also add LiquidAI LFM2 as alternative if supported
  await LlamaCPP.addModel({
    id: 'lfm2-350m-q8_0',
    name: 'LiquidAI LFM2 350M Q8_0',
    url: 'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q8_0.gguf',
    memoryRequirement: 400_000_000,
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
  
  // TTS Model - Piper TTS (US English - Medium quality)
  await ONNX.addModel({
    id: MODEL_IDS.tts,
    name: 'Piper TTS (US English - Medium)',
    url: 'https://github.com/RunanywhereAI/sherpa-onnx/releases/download/runanywhere-models-v1/vits-piper-en_US-lessac-medium.tar.gz',
    modality: ModelCategory.SpeechSynthesis,
    artifactType: ModelArtifactType.TarGzArchive,
    memoryRequirement: 65_000_000,
  });
  
  // Image/Vision Model - NanoLLaVA (tiny multimodal, ~600MB text model)
  // Downloaded only; loaded on-demand when user opens vision features
  await LlamaCPP.addModel({
    id: MODEL_IDS.img,
    name: 'NanoLLaVA Vision F16',
    url: 'https://huggingface.co/abetlen/nanollava-gguf/resolve/main/nanollava-text-model-f16.gguf',
    memoryRequirement: 700_000_000,
  });
};
