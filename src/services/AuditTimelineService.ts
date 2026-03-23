import AsyncStorage from '@react-native-async-storage/async-storage';

const AUDIT_TIMELINE_KEY = '@sahayak_audit_timeline_v1';
const MAX_AUDIT_EVENTS = 1000;

export type AuditEventType =
  | 'symptom_entry'
  | 'emergency_warning_shown'
  | 'sos_triggered'
  | 'user_action_taken'
  | 'analysis_completed'
  | 'model_issue';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditTimelineEvent {
  id: string;
  timestamp: number;
  type: AuditEventType;
  severity: AuditSeverity;
  source: 'chat' | 'scan' | 'sos' | 'system' | 'settings';
  summary: string;
  details?: Record<string, unknown>;
}

export interface CreateAuditEventInput {
  type: AuditEventType;
  severity?: AuditSeverity;
  source: AuditTimelineEvent['source'];
  summary: string;
  details?: Record<string, unknown>;
}

const makeId = (): string => {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const safeParse = (raw: string | null): AuditTimelineEvent[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AuditTimelineEvent[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
};

export class AuditTimelineService {
  static async getEvents(): Promise<AuditTimelineEvent[]> {
    try {
      const raw = await AsyncStorage.getItem(AUDIT_TIMELINE_KEY);
      const events = safeParse(raw);
      return events.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('AuditTimelineService.getEvents failed', error);
      return [];
    }
  }

  static async logEvent(input: CreateAuditEventInput): Promise<void> {
    try {
      const current = await this.getEvents();
      const event: AuditTimelineEvent = {
        id: makeId(),
        timestamp: Date.now(),
        type: input.type,
        severity: input.severity ?? 'info',
        source: input.source,
        summary: input.summary,
        details: input.details,
      };

      const next = [event, ...current].slice(0, MAX_AUDIT_EVENTS);
      await AsyncStorage.setItem(AUDIT_TIMELINE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('AuditTimelineService.logEvent failed', error);
    }
  }

  static async clearEvents(): Promise<void> {
    try {
      await AsyncStorage.removeItem(AUDIT_TIMELINE_KEY);
    } catch (error) {
      console.error('AuditTimelineService.clearEvents failed', error);
    }
  }

  static async exportEventsAsText(): Promise<string> {
    const events = await this.getEvents();
    if (events.length === 0) {
      return 'No audit events available.';
    }

    return events
      .map((event) => {
        const stamp = new Date(event.timestamp).toLocaleString();
        const details = event.details ? ` | details=${JSON.stringify(event.details)}` : '';
        return `[${stamp}] [${event.severity.toUpperCase()}] [${event.type}] ${event.summary}${details}`;
      })
      .join('\n');
  }
}
