/**
 * ChatBackendBridge — Thin TypeScript wrapper for the Kotlin ChatBackendModule.
 *
 * This provides typed async methods that call into the native Kotlin layer
 * for room CRUD, prompt building, session management, and OCR text cleaning.
 */

import { NativeModules } from 'react-native';

const { ChatBackendModule } = NativeModules;

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

// ─── Bridge Methods ───────────────────────────────────────────────────────────

export const ChatBackend = {
  // ── Room CRUD ──────────────────────────────────────────────────────────────

  async createRoom(contextText: string, title?: string): Promise<string> {
    return ChatBackendModule.createRoom(contextText, title ?? '');
  },

  async getAllRooms(): Promise<ChatRoom[]> {
    const json = await ChatBackendModule.getAllRooms();
    try { return JSON.parse(json); } catch { return []; }
  },

  async getRoomHistory(roomId: string): Promise<ChatMessage[]> {
    const json = await ChatBackendModule.getRoomHistory(roomId);
    try { return JSON.parse(json); } catch { return []; }
  },

  async saveMessage(roomId: string, text: string, isUser: boolean): Promise<void> {
    await ChatBackendModule.saveMessage(roomId, text, isUser);
  },

  async deleteRoom(roomId: string): Promise<void> {
    await ChatBackendModule.deleteRoom(roomId);
  },

  // ── Pipeline Prompt Builder ────────────────────────────────────────────────

  /**
   * Builds the correct LLM prompt based on pipeline type.
   * - imageContext non-empty → OCR pipeline (no history, document prompt)
   * - text only → Text pipeline (session history, conversational prompt)
   */
  async buildPrompt(text: string, imageContext?: string): Promise<PromptConfig> {
    const json = await ChatBackendModule.buildPrompt(text, imageContext ?? '');
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
    await ChatBackendModule.trackAssistantResponse(text);
  },

  async clearSessionHistory(): Promise<void> {
    await ChatBackendModule.clearSessionHistory();
  },

  // ── OCR ─────────────────────────────────────────────────────────────────────

  async cleanOCRText(rawText: string): Promise<string> {
    return ChatBackendModule.cleanOCRText(rawText);
  },
};
