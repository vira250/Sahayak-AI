import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AndroidImportance,
  Event,
  EventType,
  TriggerType,
  TimestampTrigger,
} from '@notifee/react-native';
import { PermissionsAndroid, Platform } from 'react-native';

const STORAGE_KEYS = {
  schedules: '@medicine_schedules_v1',
  adherenceLogs: '@medicine_adherence_logs_v1',
  notificationIds: '@medicine_notification_ids_v1',
};

const DEFAULT_SNOOZE_MINUTES = 5;
const DEFAULT_REPEAT_CAP = 5;
const MAX_IOS_PENDING = 60;
const HORIZON_DAYS = 7;

const WEEK_DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface MedicineSchedule {
  id: string;
  name: string;
  dosageNotes?: string;
  times: string[]; // HH:mm, 24h
  days: number[]; // 0..6 (Sun..Sat)
  enabled: boolean;
  snoozeMinutes: number;
  repeatCap: number;
  createdAt: number;
  updatedAt: number;
}

export interface MedicineAdherenceLog {
  doseKey: string; // `${medicineId}_${baseTs}`
  medicineId: string;
  medicineName: string;
  dueAt: number;
  status: 'taken' | 'missed';
  acknowledgedAt?: number;
  lastUpdatedAt: number;
}

export interface NotificationDebugInfo {
  scheduledCount: number;
  nextReminderAt: number | null;
}

const MISSED_RECONCILE_DAYS = 3;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(task: () => Promise<T>, retries = 1): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await wait(200);
      }
    }
  }
  throw lastError;
};

const parseJson = <T>(json: string | null, fallback: T): T => {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('MedicineSchedule parse error:', error);
    return fallback;
  }
};

const safeGetItem = async (key: string): Promise<string | null> => {
  try {
    return await withRetry(() => AsyncStorage.getItem(key), 1);
  } catch (error) {
    console.error(`Failed to read storage key: ${key}`, error);
    return null;
  }
};

const safeSetItem = async (key: string, value: string) => {
  await withRetry(async () => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to write storage key: ${key}`, error);
      throw error;
    }
  }, 1);
};

const toSafeNumber = (value: unknown, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const clampInt = (value: number, min: number, max: number) => {
  const rounded = Math.floor(value);
  return Math.min(max, Math.max(min, rounded));
};

const makeDoseKey = (medicineId: string, baseTs: number) => `${medicineId}_${baseTs}`;

const buildDoseNotificationIds = (medicineId: string, baseTs: number, repeatCap: number) => {
  const ids: string[] = [];
  for (let i = 0; i <= repeatCap; i += 1) {
    ids.push(`med_${medicineId}_${baseTs}_${i}`);
  }
  return ids;
};

const toTimeParts = (hhmm: string): { hour: number; minute: number } | null => {
  const match = hhmm.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
};

const startOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
};

const getUpcomingDoseTimes = (schedule: MedicineSchedule, horizonDays = HORIZON_DAYS): number[] => {
  const now = Date.now();
  const today = startOfToday();
  const dueTimes: number[] = [];

  for (let offset = 0; offset <= horizonDays; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    const weekDay = day.getDay();

    if (!schedule.days.includes(weekDay)) {
      continue;
    }

    for (const time of schedule.times) {
      const parts = toTimeParts(time);
      if (!parts) continue;

      const due = new Date(day);
      due.setHours(parts.hour, parts.minute, 0, 0);
      const dueTs = due.getTime();

      if (dueTs > now + 30_000) {
        dueTimes.push(dueTs);
      }
    }
  }

  return dueTimes.sort((a, b) => a - b);
};

const getDoseTimesBetween = (schedule: MedicineSchedule, startTs: number, endTs: number): number[] => {
  const start = new Date(startTs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endTs);
  end.setHours(23, 59, 59, 999);

  const result: number[] = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    const weekDay = cursor.getDay();
    if (schedule.days.includes(weekDay)) {
      for (const time of schedule.times) {
        const parts = toTimeParts(time);
        if (!parts) continue;
        const due = new Date(cursor);
        due.setHours(parts.hour, parts.minute, 0, 0);
        const dueTs = due.getTime();
        if (dueTs >= startTs && dueTs <= endTs) {
          result.push(dueTs);
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
};

export const getNextReminderTimestamp = (schedules: MedicineSchedule[]): number | null => {
  const activeSchedules = schedules.filter(item => item.enabled);
  let nextTs: number | null = null;

  for (const schedule of activeSchedules) {
    const dueTimes = getUpcomingDoseTimes(schedule, HORIZON_DAYS);
    if (dueTimes.length === 0) continue;
    if (nextTs === null || dueTimes[0] < nextTs) {
      nextTs = dueTimes[0];
    }
  }

  return nextTs;
};

export const getWeekdayLabels = () => WEEK_DAYS_SHORT;

export const loadMedicineSchedules = async (): Promise<MedicineSchedule[]> => {
  const raw = await safeGetItem(STORAGE_KEYS.schedules);
  return parseJson<MedicineSchedule[]>(raw, []);
};

export const saveMedicineSchedules = async (schedules: MedicineSchedule[]) => {
  await safeSetItem(STORAGE_KEYS.schedules, JSON.stringify(schedules));
};

export const loadMedicineAdherenceLogs = async (): Promise<MedicineAdherenceLog[]> => {
  const raw = await safeGetItem(STORAGE_KEYS.adherenceLogs);
  return parseJson<MedicineAdherenceLog[]>(raw, []);
};

const saveMedicineAdherenceLogs = async (logs: MedicineAdherenceLog[]) => {
  await safeSetItem(STORAGE_KEYS.adherenceLogs, JSON.stringify(logs));
};

const upsertAdherenceLog = async (log: MedicineAdherenceLog) => {
  const existing = await loadMedicineAdherenceLogs();
  const index = existing.findIndex(item => item.doseKey === log.doseKey);
  if (index >= 0) {
    existing[index] = log;
  } else {
    existing.unshift(log);
  }
  await saveMedicineAdherenceLogs(existing.slice(0, 400));
};

export const ensureMedicineNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    }

    await notifee.requestPermission();

    await notifee.setNotificationCategories([
      {
        id: 'medicine-reminder',
        actions: [
          {
            id: 'taken',
            title: 'Taken',
          },
          {
            id: 'snooze_5',
            title: 'Snooze 5 min',
          },
        ],
      },
    ]);

    await notifee.createChannel({
      id: 'medicine-reminders',
      name: 'Medicine Reminders',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });

    return true;
  } catch (error) {
    console.error('Notification permission/setup failed:', error);
    return false;
  }
};

export const getMedicineNotificationDebugInfo = async (): Promise<NotificationDebugInfo> => {
  try {
    const ids = await notifee.getTriggerNotificationIds();
    const schedules = await loadMedicineSchedules();
    return {
      scheduledCount: ids.length,
      nextReminderAt: getNextReminderTimestamp(schedules),
    };
  } catch (error) {
    console.error('Failed to collect notification debug info:', error);
    return { scheduledCount: 0, nextReminderAt: null };
  }
};

export const sendMedicineTestNotification = async () => {
  const ok = await ensureMedicineNotificationPermission();
  if (!ok) {
    return;
  }

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + 10_000,
  };

  try {
    await notifee.createTriggerNotification(
      {
        id: `med_test_${Date.now()}`,
        title: 'Medicine Schedule',
        body: 'Test reminder in 10 seconds',
        android: {
          channelId: 'medicine-reminders',
          pressAction: { id: 'default' },
          actions: [
            { title: 'Taken', pressAction: { id: 'taken' } },
            { title: 'Snooze 5 min', pressAction: { id: 'snooze_5' } },
          ],
          smallIcon: 'ic_launcher',
        },
        ios: {
          categoryId: 'medicine-reminder',
        },
      },
      trigger,
    );
  } catch (error) {
    console.error('Failed to schedule test medicine notification:', error);
  }
};

const loadScheduledNotificationIds = async (): Promise<string[]> => {
  const raw = await safeGetItem(STORAGE_KEYS.notificationIds);
  return parseJson<string[]>(raw, []);
};

const saveScheduledNotificationIds = async (ids: string[]) => {
  await safeSetItem(STORAGE_KEYS.notificationIds, JSON.stringify(ids));
};

const cancelScheduledNotificationIds = async () => {
  const savedIds = await loadScheduledNotificationIds();
  const triggerIds = await notifee.getTriggerNotificationIds().catch(() => [] as string[]);
  const ids = Array.from(new Set([...savedIds, ...triggerIds]));

  for (const id of ids) {
    try {
      await notifee.cancelNotification(id);
    } catch {
      // Ignore cancel failures for stale IDs.
    }
  }
  await saveScheduledNotificationIds([]);
};

export const rescheduleMedicineNotifications = async (schedules?: MedicineSchedule[]) => {
  const ok = await ensureMedicineNotificationPermission();
  if (!ok) {
    console.warn('Skipping medicine scheduling: notification permission not granted');
    return;
  }

  await cancelScheduledNotificationIds();

  const activeSchedules = (schedules ?? await loadMedicineSchedules()).filter(item => item.enabled);
  const scheduledIds: string[] = [];
  let iosPendingCount = 0;

  for (const schedule of activeSchedules) {
    const dueTimes = getUpcomingDoseTimes(schedule);

    for (const baseTs of dueTimes) {
      for (let repeatIndex = 0; repeatIndex <= schedule.repeatCap; repeatIndex += 1) {
        if (Platform.OS === 'ios' && iosPendingCount >= MAX_IOS_PENDING) {
          break;
        }

        const triggerTs = baseTs + repeatIndex * schedule.snoozeMinutes * 60_000;
        const id = `med_${schedule.id}_${baseTs}_${repeatIndex}`;

        const trigger: TimestampTrigger = {
          type: TriggerType.TIMESTAMP,
          timestamp: triggerTs,
        };

        const reminderSuffix = repeatIndex > 0 ? ` • Reminder ${repeatIndex}/${schedule.repeatCap}` : '';

        try {
          await withRetry(() => notifee.createTriggerNotification(
            {
              id,
              title: 'Medicine Schedule',
              body: `Time to take ${schedule.name}${schedule.dosageNotes ? ` (${schedule.dosageNotes})` : ''}${reminderSuffix}`,
              data: {
                medicineId: schedule.id,
                medicineName: schedule.name,
                baseTs: String(baseTs),
                reminderIndex: String(repeatIndex),
                repeatCap: String(schedule.repeatCap),
                snoozeMinutes: String(schedule.snoozeMinutes),
              },
              android: {
                channelId: 'medicine-reminders',
                pressAction: { id: 'default' },
                actions: [
                  { title: 'Taken', pressAction: { id: 'taken' } },
                  { title: 'Snooze 5 min', pressAction: { id: 'snooze_5' } },
                ],
                importance: AndroidImportance.HIGH,
                autoCancel: false,
                smallIcon: 'ic_launcher',
              },
              ios: {
                categoryId: 'medicine-reminder',
              },
            },
            trigger,
          ));

          scheduledIds.push(id);
          iosPendingCount += 1;
        } catch (error) {
          console.error('Failed to schedule medicine reminder:', error);
        }
      }
    }
  }

  try {
    await saveScheduledNotificationIds(scheduledIds);
  } catch (error) {
    console.error('Failed to persist scheduled medicine notification IDs:', error);
  }
};

const markTaken = async (medicineId: string, medicineName: string, baseTs: number) => {
  const now = Date.now();
  const log: MedicineAdherenceLog = {
    doseKey: makeDoseKey(medicineId, baseTs),
    medicineId,
    medicineName,
    dueAt: baseTs,
    status: 'taken',
    acknowledgedAt: now,
    lastUpdatedAt: now,
  };
  await upsertAdherenceLog(log);
};

export const markMedicineTakenNow = async (medicineId: string, medicineName: string) => {
  const now = Date.now();
  const manualLog: MedicineAdherenceLog = {
    doseKey: `${medicineId}_manual_${now}`,
    medicineId,
    medicineName,
    dueAt: now,
    status: 'taken',
    acknowledgedAt: now,
    lastUpdatedAt: now,
  };
  await upsertAdherenceLog(manualLog);
};

const markMissedIfPending = async (medicineId: string, medicineName: string, baseTs: number) => {
  const doseKey = makeDoseKey(medicineId, baseTs);
  const logs = await loadMedicineAdherenceLogs();
  const existing = logs.find(item => item.doseKey === doseKey);
  if (existing?.status === 'taken') {
    return;
  }

  const now = Date.now();
  const log: MedicineAdherenceLog = {
    doseKey,
    medicineId,
    medicineName,
    dueAt: baseTs,
    status: 'missed',
    lastUpdatedAt: now,
  };
  await upsertAdherenceLog(log);
};

const cancelDoseNotifications = async (medicineId: string, baseTs: number, repeatCap: number) => {
  const ids = buildDoseNotificationIds(medicineId, baseTs, repeatCap);
  for (const id of ids) {
    try {
      await notifee.cancelNotification(id);
    } catch {
      // Ignore stale notification IDs.
    }
  }
};

const scheduleOneOffSnooze = async (
  medicineId: string,
  medicineName: string,
  baseTs: number,
  snoozeMinutes: number,
  repeatCap: number,
) => {
  const id = `med_${medicineId}_${baseTs}_snooze_${Date.now()}`;
  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + snoozeMinutes * 60_000,
  };

  await notifee.createTriggerNotification(
    {
      id,
      title: 'Medicine Schedule',
      body: `Reminder: time to take ${medicineName}`,
      data: {
        medicineId,
        medicineName,
        baseTs: String(baseTs),
        reminderIndex: String(repeatCap),
        repeatCap: String(repeatCap),
        snoozeMinutes: String(snoozeMinutes),
      },
      android: {
        channelId: 'medicine-reminders',
        pressAction: { id: 'default' },
        actions: [
          { title: 'Taken', pressAction: { id: 'taken' } },
          { title: 'Snooze 5 min', pressAction: { id: 'snooze_5' } },
        ],
        importance: AndroidImportance.HIGH,
        autoCancel: false,
        smallIcon: 'ic_launcher',
      },
      ios: {
        categoryId: 'medicine-reminder',
      },
    },
    trigger,
  );

  try {
    const ids = await loadScheduledNotificationIds();
    ids.push(id);
    await saveScheduledNotificationIds(ids);
  } catch (error) {
    console.error('Failed to persist snoozed notification ID:', error);
  }
};

export const handleMedicineNotificationEvent = async (event: Event) => {
  try {
    const data = event.detail.notification?.data;
    if (!data?.medicineId || !data?.baseTs) {
      return;
    }

    const medicineId = String(data.medicineId);
    const medicineName = String(data.medicineName || 'Medicine');
    const baseTs = toSafeNumber(data.baseTs, NaN);
    const repeatCap = clampInt(toSafeNumber(data.repeatCap, DEFAULT_REPEAT_CAP), 0, 12);
    const reminderIndex = clampInt(toSafeNumber(data.reminderIndex, 0), 0, 24);
    const snoozeMinutes = clampInt(toSafeNumber(data.snoozeMinutes, DEFAULT_SNOOZE_MINUTES), 1, 60);

    if (!Number.isFinite(baseTs) || baseTs <= 0) {
      return;
    }

    if (event.type === EventType.ACTION_PRESS) {
      const actionId = event.detail.pressAction?.id;

      if (actionId === 'taken') {
        await markTaken(medicineId, medicineName, baseTs);
        await cancelDoseNotifications(medicineId, baseTs, repeatCap);
        return;
      }

      if (actionId === 'snooze_5') {
        await scheduleOneOffSnooze(medicineId, medicineName, baseTs, snoozeMinutes, repeatCap);
        return;
      }
    }

    if (event.type === EventType.DELIVERED && reminderIndex >= repeatCap) {
      await markMissedIfPending(medicineId, medicineName, baseTs);
    }
  } catch (error) {
    console.error('Medicine notification event handling failed:', error);
  }
};

export const reconcileMedicineAdherenceLogs = async (schedulesInput?: MedicineSchedule[]) => {
  try {
    const schedules = schedulesInput ?? await loadMedicineSchedules();
    if (schedules.length === 0) return;

    const logs = await loadMedicineAdherenceLogs();
    const logByDoseKey = new Map(logs.map(item => [item.doseKey, item]));
    const now = Date.now();
    const rangeStart = now - MISSED_RECONCILE_DAYS * 24 * 60 * 60 * 1000;

    const newMissed: MedicineAdherenceLog[] = [];

    for (const schedule of schedules) {
      const doseTimes = getDoseTimesBetween(schedule, rangeStart, now);
      for (const baseTs of doseTimes) {
        const doseKey = makeDoseKey(schedule.id, baseTs);
        const existing = logByDoseKey.get(doseKey);
        if (existing) continue;

        const finalReminderTs = baseTs + schedule.repeatCap * schedule.snoozeMinutes * 60_000;
        const graceTs = finalReminderTs + 60_000;
        if (now < graceTs) continue;

        newMissed.push({
          doseKey,
          medicineId: schedule.id,
          medicineName: schedule.name,
          dueAt: baseTs,
          status: 'missed',
          lastUpdatedAt: now,
        });
      }
    }

    if (newMissed.length === 0) return;
    const merged = [...newMissed, ...logs].sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
    await saveMedicineAdherenceLogs(merged.slice(0, 400));
  } catch (error) {
    console.error('Failed to reconcile medicine adherence logs:', error);
  }
};
