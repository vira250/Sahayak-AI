import React, { createContext, useContext, useState, useCallback } from 'react';
import { RunAnywhere, ModelCategory } from '@runanywhere/core';
import { LlamaCPP } from '@runanywhere/llamacpp';
import { ONNX, ModelArtifactType } from '@runanywhere/onnx';

// Model IDs - matching sample app model registry
const MODEL_IDS = {
  llm: 'qwen2.5-1.5b-instruct-q4km',
  stt: 'sherpa-onnx-whisper-tiny.en',
  tts: 'vits-piper-en_US-lessac-medium',
} as const;

interface ModelServiceState {
  // Download state
  isLLMDownloading: boolean;
  isSTTDownloading: boolean;
  isTTSDownloading: boolean;

  llmDownloadProgress: number;
  sttDownloadProgress: number;
  ttsDownloadProgress: number;

  // Load state
  isLLMLoading: boolean;
  isSTTLoading: boolean;
  isTTSLoading: boolean;

  // Loaded state
  isLLMLoaded: boolean;
  isSTTLoaded: boolean;
  isTTSLoaded: boolean;

  isVoiceAgentReady: boolean;

  // Actions
  downloadAndLoadLLM: () => Promise<void>;
  downloadAndLoadSTT: () => Promise<void>;
  downloadAndLoadTTS: () => Promise<void>;
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

  const [llmDownloadProgress, setLLMDownloadProgress] = useState(0);
  const [sttDownloadProgress, setSTTDownloadProgress] = useState(0);
  const [ttsDownloadProgress, setTTSDownloadProgress] = useState(0);

  // Load state
  const [isLLMLoading, setIsLLMLoading] = useState(false);
  const [isSTTLoading, setIsSTTLoading] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);

  // Loaded state
  const [isLLMLoaded, setIsLLMLoaded] = useState(false);
  const [isSTTLoaded, setIsSTTLoaded] = useState(false);
  const [isTTSLoaded, setIsTTSLoaded] = useState(false);
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
      console.warn(`Load failed for ${modelId} (${loadError?.message || loadError}), checking fallbacks or re-downloading...`);
      setIsLLMLoading(false);
      
      // If qwen failed, we might want to let the fallback loop in downloadAndLoadLLM handle it
      // unless this is a retry of a fallback model.
      
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

    const modelsToTry = [MODEL_IDS.llm, 'smollm2-360m-q8_0', 'lfm2-350m-q8_0'];

    for (const modelId of modelsToTry) {
      try {
        const success = await tryDownloadAndLoadLLM(modelId);
        if (success) return;
      } catch (error) {
        console.error(`LLM error for ${modelId}:`, error);
        setIsLLMDownloading(false);
        setIsLLMLoading(false);
      }
    }

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



  // Check if all models are downloaded
  const [isAllDownloaded, setIsAllDownloadedState] = useState(false);

  const checkAllModelsDownloaded = useCallback(async (): Promise<boolean> => {
    const llm = await checkModelDownloaded(MODEL_IDS.llm);
    const stt = await checkModelDownloaded(MODEL_IDS.stt);
    const tts = await checkModelDownloaded(MODEL_IDS.tts);
    const all = llm && stt && tts;
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
    ]);
  }, [downloadAndLoadLLM, downloadAndLoadSTT, downloadAndLoadTTS]);

  // Unload all models
  const unloadAllModels = useCallback(async () => {
    try {
      await RunAnywhere.unloadModel();
      await RunAnywhere.unloadSTTModel();
      await RunAnywhere.unloadTTSModel();
      setIsLLMLoaded(false);
      setIsSTTLoaded(false);
      setIsTTSLoaded(false);
    } catch (error) {
      console.error('Error unloading models:', error);
    }
  }, []);

  // Mark setup as complete
  const completeSetup = useCallback(async () => {
    setHasCompletedSetup(true);
  }, []);

  const value: ModelServiceState = {
    isLLMDownloading,
    isSTTDownloading,
    isTTSDownloading,
    llmDownloadProgress,
    sttDownloadProgress,
    ttsDownloadProgress,
    isLLMLoading,
    isSTTLoading,
    isTTSLoading,
    isLLMLoaded,
    isSTTLoaded,
    isTTSLoaded,
    isVoiceAgentReady,
    isSetupReady,
    hasCompletedSetup,
    downloadAndLoadLLM,
    downloadAndLoadSTT,
    downloadAndLoadTTS,
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
 */
export const registerDefaultModels = async () => {
  // LLM Model - Qwen2.5 1.5B Instruct Q4_K_M (~1GB, excellent instruction following)
  await LlamaCPP.addModel({
    id: MODEL_IDS.llm,
    name: 'Qwen2.5 1.5B Instruct Q4_K_M',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    memoryRequirement: 1_000_000_000, // Reduced from 1.2B to be more inclusive
  });

  // Fallback: SmolLM2 360M (smaller, lower quality but works on low-RAM devices)
  await LlamaCPP.addModel({
    id: 'smollm2-360m-q8_0',
    name: 'SmolLM2 360M Q8_0',
    url: 'https://huggingface.co/prithivMLmods/SmolLM2-360M-GGUF/resolve/main/SmolLM2-360M.Q8_0.gguf',
    memoryRequirement: 500_000_000,
  });

  // Fallback: LiquidAI LFM2 350M
  await LlamaCPP.addModel({
    id: 'lfm2-350m-q8_0',
    name: 'LiquidAI LFM2 350M Q8_0',
    url: 'https://huggingface.co/LiquidAI/LFM2-350M-GGUF/resolve/main/LFM2-350M-Q8_0.gguf',
    memoryRequirement: 400_000_000,
  });

  // STT Model - Sherpa Whisper Tiny English
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

};