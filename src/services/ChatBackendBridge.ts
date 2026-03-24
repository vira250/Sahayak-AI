/**
 * ChatBackendBridge — Thin TypeScript wrapper for the Kotlin ChatBackendModule.
 *
 * This provides typed async methods that call into the native Kotlin layer
 * for room CRUD, prompt building, session management, and OCR text cleaning.
 */

import { NativeModules } from 'react-native';

const { ChatBackendModule } = NativeModules;
const RETRY_DELAY_MS = 250;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatRoom {
  id: string;
  title: string;
  createdAt: number;
  lastUpdatedAt: number;
  context: string;
}

export interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: number;
}

export interface PromptConfig {
  prompt: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
}

const ensureModule = () => {
  if (!ChatBackendModule) {
    throw new Error('Chat backend native module unavailable');
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(label: string, task: () => Promise<T>, retries = 1): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await wait(RETRY_DELAY_MS);
      }
    }
  }
  console.error(`ChatBackend failure: ${label}`, lastError);
  throw lastError;
};

const parseJsonArray = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('ChatBackend parse error:', error);
    return fallback;
  }
};

// ─── Bridge Methods ───────────────────────────────────────────────────────────

export const ChatBackend = {
  // ── Room CRUD ──────────────────────────────────────────────────────────────

  async createRoom(contextText: string, title?: string): Promise<string> {
    ensureModule();
    return withRetry('createRoom', () => ChatBackendModule.createRoom(contextText, title ?? ''));
  },

  async getAllRooms(): Promise<ChatRoom[]> {
    ensureModule();
    const json = await withRetry('getAllRooms', () => ChatBackendModule.getAllRooms());
    return parseJsonArray<ChatRoom[]>(json, []);
  },

  async getRoomHistory(roomId: string): Promise<ChatMessage[]> {
    ensureModule();
    const json = await withRetry('getRoomHistory', () => ChatBackendModule.getRoomHistory(roomId));
    return parseJsonArray<ChatMessage[]>(json, []);
  },

  async saveMessage(roomId: string, text: string, isUser: boolean): Promise<void> {
    ensureModule();
    await withRetry('saveMessage', () => ChatBackendModule.saveMessage(roomId, text, isUser));
  },

  async deleteRoom(roomId: string): Promise<void> {
    ensureModule();
    await withRetry('deleteRoom', () => ChatBackendModule.deleteRoom(roomId));
  },

  // ── Pipeline Prompt Builder ────────────────────────────────────────────────

  /**
   * Builds the correct LLM prompt based on pipeline type.
   * - imageContext non-empty → OCR pipeline (no history, document prompt)
   * - text only → Text pipeline (session history, conversational prompt)
   */
  async buildPrompt(text: string, imageContext?: string): Promise<PromptConfig> {
    ensureModule();
    const json = await withRetry('buildPrompt', () => ChatBackendModule.buildPrompt(text, imageContext ?? ''));
    const parsed = JSON.parse(json);
    return {
      prompt: parsed.prompt,
      systemPrompt: parsed.systemPrompt || '',
      maxTokens: parsed.maxTokens,
      temperature: parsed.temperature,
    };
  },

  /**
   * Track the AI response in session history (called after LLM responds).
   */
  async trackAssistantResponse(text: string): Promise<void> {
    ensureModule();
    await withRetry('trackAssistantResponse', () => ChatBackendModule.trackAssistantResponse(text));
  },

  async clearSessionHistory(): Promise<void> {
    ensureModule();
    await withRetry('clearSessionHistory', () => ChatBackendModule.clearSessionHistory());
  },

  // ── OCR ─────────────────────────────────────────────────────────────────────

  async cleanOCRText(rawText: string): Promise<string> {
    ensureModule();
    return withRetry('cleanOCRText', () => ChatBackendModule.cleanOCRText(rawText));
  },

  async extractTextFromPdf(pdfUri: string, maxPages = 3): Promise<string> {
    ensureModule();
    return withRetry('extractTextFromPdf', () => ChatBackendModule.extractTextFromPdf(pdfUri, maxPages));
  },
};
