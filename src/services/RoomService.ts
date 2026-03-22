import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '../components'; // Assuming it's exported from here

const ROOMS_LIST_KEY = '@sahayak_rooms_list';
const ROOM_PREFIX = '@sahayak_room_';

export interface ChatRoom {
  id: string;
  title: string;
  createdAt: number;
  lastUpdatedAt: number;
  context: string; // The OCR text or initial context
}

export class RoomService {
  /**
   * Retrieves all chat rooms/sessions
   */
  static async getAllRooms(): Promise<ChatRoom[]> {
    try {
      const data = await AsyncStorage.getItem(ROOMS_LIST_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
    return [];
  }

  /**
   * Creates a new chat room with the given initial text (OCR scan)
   */
  static async createRoom(contextText: string, title?: string): Promise<string> {
    try {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = Date.now();

      const newRoom: ChatRoom = {
        id: roomId,
        title: title || 'Scanned Document Chat',
        createdAt: now,
        lastUpdatedAt: now,
        context: contextText,
      };

      // Add to rooms list
      const rooms = await this.getAllRooms();
      rooms.unshift(newRoom); // Add to top
      await AsyncStorage.setItem(ROOMS_LIST_KEY, JSON.stringify(rooms));

      const initialMessage: ChatMessage = {
        text: `I've extracted the following text from your scan:\n\n"${contextText}"\n\nWhat would you like to ask about it?`,
        isUser: false,
        timestamp: new Date(),
      };

      // Create message list for the room with the initial message
      await AsyncStorage.setItem(`${ROOM_PREFIX}${roomId}`, JSON.stringify([initialMessage]));

      return roomId;
    } catch (error) {
      console.error('Failed to create room:', error);
      throw error;
    }
  }

  /**
   * Gets the chat history for a specific room
   */
  static async getRoomHistory(roomId: string): Promise<ChatMessage[]> {
    try {
      const data = await AsyncStorage.getItem(`${ROOM_PREFIX}${roomId}`);
      if (data) {
        const parsed = JSON.parse(data);
        // Dates are serialized as strings in JSON, need to parse them back
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      }
    } catch (error) {
      console.error(`Failed to get history for room ${roomId}:`, error);
    }
    return [];
  }

  /**
   * Adds a new message to the given room
   */
  static async addMessageToRoom(roomId: string, message: ChatMessage): Promise<void> {
    try {
      const history = await this.getRoomHistory(roomId);
      history.push(message);
      await AsyncStorage.setItem(`${ROOM_PREFIX}${roomId}`, JSON.stringify(history));

      // Update room lastUpdatedAt
      const rooms = await this.getAllRooms();
      const roomIndex = rooms.findIndex((r) => r.id === roomId);
      if (roomIndex >= 0) {
        rooms[roomIndex].lastUpdatedAt = Date.now();
        // Move to top of the list
        const [room] = rooms.splice(roomIndex, 1);
        rooms.unshift(room);
        await AsyncStorage.setItem(ROOMS_LIST_KEY, JSON.stringify(rooms));
      }
    } catch (error) {
      console.error(`Failed to add message to room ${roomId}:`, error);
    }
  }

  /**
   * Gets room details and context
   */
  static async getRoomDetails(roomId: string): Promise<ChatRoom | null> {
    try {
      const rooms = await this.getAllRooms();
      return rooms.find((r) => r.id === roomId) || null;
    } catch (error) {
      console.error(`Failed to get details for room ${roomId}:`, error);
      return null;
    }
  }

  /**
   * Deletes a room and its history
   */
  static async deleteRoom(roomId: string): Promise<void> {
    try {
      const rooms = await this.getAllRooms();
      const newRooms = rooms.filter((r) => r.id !== roomId);
      await AsyncStorage.setItem(ROOMS_LIST_KEY, JSON.stringify(newRooms));
      await AsyncStorage.removeItem(`${ROOM_PREFIX}${roomId}`);
    } catch (error) {
      console.error(`Failed to delete room ${roomId}:`, error);
    }
  }
}
