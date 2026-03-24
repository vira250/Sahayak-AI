import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import { useToast } from '../services/ToastService';
import {
  ensureMedicineNotificationPermission,
  getWeekdayLabels,
  loadMedicineAdherenceLogs,
  loadMedicineSchedules,
  markMedicineTakenNow,
  MedicineAdherenceLog,
  MedicineSchedule,
  reconcileMedicineAdherenceLogs,
  rescheduleMedicineNotifications,
  saveMedicineSchedules,
} from '../services/MedicineScheduleService';

const DEFAULT_SNOOZE_MINUTES = 5;
const DEFAULT_REPEAT_CAP = 5;
const DELETE_CONFIRM_WINDOW_MS = 10_000;

const formatTime24 = (date: Date) => {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
};

const formatDays = (days: number[]) => {
  const labels = getWeekdayLabels();
  return days
    .slice()
    .sort((a, b) => a - b)
    .map(day => labels[day])
    .join(', ');
};

const formatDateTime = (ts: number) => {
  const date = new Date(ts);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};

type FormState = {
  editingId: string | null;
  name: string;
  dosageNotes: string;
  times: string[];
  days: number[];
  enabled: boolean;
};

const initialFormState: FormState = {
  editingId: null,
  name: '',
  dosageNotes: '',
  times: [],
  days: [],
  enabled: true,
};

export const MedicineScheduleScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();

  const [schedules, setSchedules] = useState<MedicineSchedule[]>([]);
  const [logs, setLogs] = useState<MedicineAdherenceLog[]>([]);
  const [form, setForm] = useState<FormState>(initialFormState);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; expiresAt: number } | null>(null);
  const [activeSection, setActiveSection] = useState<'scheduled' | 'adherence'>('scheduled');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickedTime, setPickedTime] = useState<Date>(() => {
    const initial = new Date();
    initial.setHours(8, 0, 0, 0);
    return initial;
  });

  const weekdays = useMemo(() => getWeekdayLabels(), []);

  const sortedSchedules = useMemo(
    () => schedules.slice().sort((a, b) => b.updatedAt - a.updatedAt),
    [schedules],
  );

  const adherenceSummary = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const start = now.getTime();

    let taken = 0;
    let missed = 0;

    logs.forEach(log => {
      if (log.dueAt < start) return;
      if (log.status === 'taken') taken += 1;
      if (log.status === 'missed') missed += 1;
    });

    return { taken, missed };
  }, [logs]);

  const refreshAll = useCallback(async () => {
    try {
      const savedSchedules = await loadMedicineSchedules();
      await reconcileMedicineAdherenceLogs(savedSchedules);
      const savedLogs = await loadMedicineAdherenceLogs();

      setSchedules(savedSchedules);
      setLogs(savedLogs.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt).slice(0, 40));
    } catch (error) {
      console.error('Failed to load medicine schedule data:', error);
      showToast('Something went wrong. Please try again.', 'error', 'bottom');
    }
  }, [showToast]);

  useEffect(() => {
    refreshAll();

    const setup = async () => {
      const permissionGranted = await ensureMedicineNotificationPermission();
      if (!permissionGranted) {
        showToast('Notifications are off. Reminders may not alert.', 'info', 'bottom');
      }
      const savedSchedules = await loadMedicineSchedules();
      await rescheduleMedicineNotifications(savedSchedules);
      await reconcileMedicineAdherenceLogs(savedSchedules);
      await refreshAll();
    };

    setup().catch(error => {
      console.error('Medicine schedule setup failed:', error);
      showToast('Setup failed. Please reopen this screen.', 'error', 'bottom');
    });
  }, [refreshAll, showToast]);

  const updateForm = (patch: Partial<FormState>) => {
    setForm(prev => ({ ...prev, ...patch }));
  };

  const resetForm = () => {
    setForm(initialFormState);
    setShowFormModal(false);
  };

  const openCreateModal = () => {
    setForm(initialFormState);
    const initial = new Date();
    initial.setHours(8, 0, 0, 0);
    setPickedTime(initial);
    setShowTimePicker(false);
    setShowFormModal(true);
  };

  const openEditModal = (item: MedicineSchedule) => {
    setForm({
      editingId: item.id,
      name: item.name,
      dosageNotes: item.dosageNotes || '',
      times: item.times,
      days: item.days,
      enabled: item.enabled,
    });
    if (item.times.length > 0) {
      const [h, m] = item.times[0].split(':');
      const initial = new Date();
      initial.setHours(Number(h), Number(m), 0, 0);
      setPickedTime(initial);
    }
    setShowTimePicker(false);
    setShowFormModal(true);
    setSelectedId(item.id);
  };

  const toggleDay = (day: number) => {
    updateForm({
      days: form.days.includes(day)
        ? form.days.filter(item => item !== day)
        : [...form.days, day].sort((a, b) => a - b),
    });
  };

  const onTimePickerChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (!selected) {
      return;
    }
    setPickedTime(selected);
    if (Platform.OS === 'ios') {
      setShowTimePicker(false);
    }
  };

  const addTime = () => {
    const value = formatTime24(pickedTime);
    if (form.times.includes(value)) {
      showToast('Time already added', 'info', 'bottom');
      return;
    }

    updateForm({
      times: [...form.times, value].sort(),
    });
    showToast(`Added ${value}`, 'success', 'bottom');
  };

  const removeTime = (value: string) => {
    updateForm({ times: form.times.filter(item => item !== value) });
  };

  const persistSchedules = async (nextSchedules: MedicineSchedule[]) => {
    await saveMedicineSchedules(nextSchedules);
    await rescheduleMedicineNotifications(nextSchedules);
    await reconcileMedicineAdherenceLogs(nextSchedules);
    setSchedules(nextSchedules);
  };

  const saveForm = async () => {
    if (!form.name.trim()) {
      showToast('Medicine name is required', 'info', 'bottom');
      return;
    }
    if (form.times.length === 0) {
      showToast('Add at least one time', 'info', 'bottom');
      return;
    }
    if (form.days.length === 0) {
      showToast('Select at least one day', 'info', 'bottom');
      return;
    }

    try {
      const now = Date.now();
      const newItem: MedicineSchedule = {
        id: form.editingId ?? `med_${now}`,
        name: form.name.trim(),
        dosageNotes: form.dosageNotes.trim(),
        times: form.times,
        days: form.days,
        enabled: form.enabled,
        snoozeMinutes: DEFAULT_SNOOZE_MINUTES,
        repeatCap: DEFAULT_REPEAT_CAP,
        createdAt: now,
        updatedAt: now,
      };

      const nextSchedules = form.editingId
        ? schedules.map(item => item.id === form.editingId
          ? { ...item, ...newItem, createdAt: item.createdAt }
          : item)
        : [newItem, ...schedules];

      await persistSchedules(nextSchedules);
      await refreshAll();
      showToast(form.editingId ? 'Medicine updated' : 'Medicine saved', 'success', 'bottom');
      resetForm();
    } catch (error) {
      console.error('Failed to save medicine schedule:', error);
      showToast('Something went wrong. Please try again.', 'error', 'bottom');
    }
  };

  const toggleEnabled = async (item: MedicineSchedule, value: boolean) => {
    try {
      const nextSchedules = schedules.map(current => current.id === item.id
        ? { ...current, enabled: value, updatedAt: Date.now() }
        : current,
      );
      await persistSchedules(nextSchedules);
      await refreshAll();
    } catch (error) {
      console.error('Failed to toggle medicine schedule:', error);
      showToast('Something went wrong. Please try again.', 'error', 'bottom');
    }
  };

  const requestDelete = async (item: MedicineSchedule) => {
    const now = Date.now();

    if (deleteConfirm?.id === item.id && deleteConfirm.expiresAt > now) {
      try {
        const nextSchedules = schedules.filter(current => current.id !== item.id);
        await persistSchedules(nextSchedules);
        await refreshAll();
        setDeleteConfirm(null);
        setSelectedId(null);
        showToast('Medicine deleted', 'success', 'bottom');
      } catch (error) {
        console.error('Failed to delete medicine schedule:', error);
        showToast('Something went wrong. Please try again.', 'error', 'bottom');
      }
      return;
    }

    setDeleteConfirm({ id: item.id, expiresAt: now + DELETE_CONFIRM_WINDOW_MS });
    showToast('Tap Delete again within 10s to confirm', 'error', 'bottom');
  };

  const handleLongPress = (item: MedicineSchedule) => {
    setSelectedId(item.id);
  };

  const markTakenNow = async (item: MedicineSchedule) => {
    try {
      await markMedicineTakenNow(item.id, item.name);
      await refreshAll();
      showToast('Marked as taken', 'success', 'bottom');
    } catch (error) {
      console.error('Failed to mark taken manually:', error);
      showToast('Something went wrong. Please try again.', 'error', 'bottom');
    }
  };

  const renderSchedule = ({ item }: { item: MedicineSchedule }) => {
    const selected = selectedId === item.id;
    const deleteArmed = deleteConfirm?.id === item.id && deleteConfirm.expiresAt > Date.now();

    return (
      <TouchableOpacity
        style={[styles.eventCard, selected && styles.eventCardSelected]}
        activeOpacity={0.86}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={250}
      >
        <View style={styles.eventHead}>
          <View style={styles.tagRow}>
            <View style={[styles.dot, { backgroundColor: item.enabled ? '#16A34A' : '#94A3B8' }]} />
            <Text style={styles.eventType}>{item.enabled ? 'Active' : 'Paused'}</Text>
          </View>
          <Switch
            value={item.enabled}
            onValueChange={value => toggleEnabled(item, value)}
            trackColor={{ true: '#1B3A5C' }}
          />
        </View>

        <Text style={styles.eventSummary}>{item.name}</Text>
        {!!item.dosageNotes && <Text style={styles.eventDetails}>{item.dosageNotes}</Text>}

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Times: {item.times.join(', ')}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Days: {formatDays(item.days)}</Text>
        </View>

        {selected ? (
          <View style={styles.inlineActions}>
            <TouchableOpacity style={styles.inlineTaken} onPress={() => markTakenNow(item)}>
              <MaterialCommunityIcons name="check" size={14} color="#166534" />
              <Text style={styles.inlineTakenText}>Mark Taken</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inlineEdit} onPress={() => openEditModal(item)}>
              <MaterialCommunityIcons name="pencil-outline" size={14} color="#1B3A5C" />
              <Text style={styles.inlineEditText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inlineDelete, deleteArmed && styles.inlineDeleteArmed]}
              onPress={() => requestDelete(item)}
            >
              <MaterialCommunityIcons name="delete-outline" size={14} color={deleteArmed ? '#FFFFFF' : '#B91C1C'} />
              <Text style={[styles.inlineDeleteText, deleteArmed && styles.inlineDeleteTextArmed]}>
                {deleteArmed ? 'Delete Now' : 'Delete'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderLog = ({ item }: { item: MedicineAdherenceLog }) => (
    <View style={styles.logCard}>
      <View style={styles.logHead}>
        <Text style={styles.logName}>{item.medicineName}</Text>
        <Text style={[styles.logStatus, item.status === 'taken' ? styles.logTaken : styles.logMissed]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.logMeta}>Due: {formatDateTime(item.dueAt)}</Text>
      {item.acknowledgedAt ? <Text style={styles.logMeta}>Taken: {formatDateTime(item.acknowledgedAt)}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#1B3A5C" />
          </TouchableOpacity>
          <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          <View>
            <Text style={styles.title}>Medicine Schedule</Text>
            <Text style={styles.subtitle}>Offline reminders and adherence timeline</Text>
          </View>
        </View>
      </View>

      <View style={styles.heroWrap}>
        <LinearGradient colors={['#0F2544', '#1B3A5C']} style={styles.heroCard}>
          <View>
            <Text style={styles.heroTitle}>Today Adherence</Text>
            <Text style={styles.heroValue}>{adherenceSummary.taken}</Text>
            <Text style={styles.heroSub}>Taken • {adherenceSummary.missed} missed</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="pill" size={30} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </View>

      <View style={styles.sectionToggleRow}>
        <TouchableOpacity
          onPress={() => setActiveSection('scheduled')}
          style={[styles.sectionToggleChip, activeSection === 'scheduled' && styles.sectionToggleChipActive]}
        >
          <Text
            style={[
              styles.sectionToggleText,
              activeSection === 'scheduled' && styles.sectionToggleTextActive,
            ]}
          >
            Scheduled Medicines
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveSection('adherence')}
          style={[styles.sectionToggleChip, activeSection === 'adherence' && styles.sectionToggleChipActive]}
        >
          <Text
            style={[
              styles.sectionToggleText,
              activeSection === 'adherence' && styles.sectionToggleTextActive,
            ]}
          >
            Adherence Log
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.fab} onPress={openCreateModal} activeOpacity={0.9}>
        <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
        <Text style={styles.fabText}>Add Medicine</Text>
      </TouchableOpacity>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {activeSection === 'scheduled' ? (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Scheduled Medicines</Text>
            {sortedSchedules.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="pill" size={44} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No medicines scheduled</Text>
              </View>
            ) : (
              <FlatList
                data={sortedSchedules}
                keyExtractor={item => item.id}
                renderItem={renderSchedule}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
              />
            )}
          </View>
        ) : (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionTitle}>Adherence Log</Text>
            {logs.length === 0 ? (
              <Text style={styles.emptySub}>No taken/missed events yet.</Text>
            ) : (
              <FlatList
                data={logs}
                keyExtractor={item => item.doseKey}
                renderItem={renderLog}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              />
            )}
          </View>
        )}

        <View style={{ height: 70 }} />
      </ScrollView>

      <Modal
        visible={showFormModal}
        transparent
        animationType="slide"
        statusBarTranslucent
        hardwareAccelerated
        onRequestClose={resetForm}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{form.editingId ? 'Edit Medicine' : 'Add Medicine'}</Text>

            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={value => updateForm({ name: value })}
              placeholder="Medicine name"
              placeholderTextColor="#94A3B8"
            />

            <TextInput
              style={styles.input}
              value={form.dosageNotes}
              onChangeText={value => updateForm({ dosageNotes: value })}
              placeholder="Dosage / notes (optional)"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.timeRowModal}>
              <TouchableOpacity
                style={styles.timePickerButton}
                activeOpacity={0.9}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.timePickerLabel}>Dose time</Text>
                <Text style={styles.timePickerValue}>
                  {pickedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.timePickerHint}>Tap to pick time</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addTimeButton} onPress={addTime}>
                <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {showTimePicker ? (
              <View style={styles.timePickerWrap}>
                <DateTimePicker
                  mode="time"
                  value={pickedTime}
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimePickerChange}
                />
              </View>
            ) : null}

            <View style={styles.chipsWrap}>
              {form.times.map(time => (
                <TouchableOpacity key={time} style={styles.timeChip} onPress={() => removeTime(time)}>
                  <Text style={styles.timeChipText}>{time}</Text>
                  <MaterialCommunityIcons name="close" size={13} color="#1B3A5C" />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.daysLabel}>Days</Text>
            <View style={styles.daysWrap}>
              {weekdays.map((day, index) => {
                const selected = form.days.includes(index);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, selected && styles.dayChipActive]}
                    onPress={() => toggleDay(index)}
                  >
                    <Text style={[styles.dayChipText, selected && styles.dayChipTextActive]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.enabledRow}>
              <Text style={styles.daysLabel}>Enabled</Text>
              <Switch
                value={form.enabled}
                onValueChange={value => updateForm({ enabled: value })}
                trackColor={{ true: '#1B3A5C' }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={resetForm}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSave} onPress={saveForm}>
                <Text style={styles.modalSaveText}>{form.editingId ? 'Update' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 40) + 8 : 14,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#E8EEF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logo: {
    width: 30,
    height: 30,
    marginRight: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F2544',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  heroWrap: {
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  heroCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroTitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '700',
  },
  heroValue: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 34,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionToggleRow: {
    paddingHorizontal: 16,
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  sectionToggleChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionToggleChipActive: {
    borderColor: '#1B3A5C',
    backgroundColor: '#1B3A5C',
  },
  sectionToggleText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionToggleTextActive: {
    color: '#FFFFFF',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B3A5C',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 100,
  },
  fabText: {
    marginLeft: 8,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  sectionWrap: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#0F2544',
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  emptyTitle: {
    marginTop: 8,
    color: '#334155',
    fontSize: 14,
    fontWeight: '700',
  },
  emptySub: {
    marginTop: 3,
    color: '#64748B',
    fontSize: 12,
  },
  eventCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FCFDFF',
  },
  eventCardSelected: {
    borderColor: '#1B3A5C',
    backgroundColor: '#F3F8FF',
  },
  eventHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventType: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
  },
  eventSummary: {
    marginTop: 6,
    color: '#0F2544',
    fontSize: 15,
    fontWeight: '800',
  },
  eventDetails: {
    marginTop: 2,
    color: '#475569',
    fontSize: 12,
  },
  metaRow: {
    marginTop: 4,
  },
  metaText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineActions: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  inlineTaken: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineTakenText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8EEF4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineEditText: {
    color: '#1B3A5C',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineDelete: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inlineDeleteArmed: {
    backgroundColor: '#B91C1C',
  },
  inlineDeleteText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  inlineDeleteTextArmed: {
    color: '#FFFFFF',
  },
  logCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
  },
  logHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logName: {
    color: '#0F2544',
    fontSize: 14,
    fontWeight: '700',
  },
  logStatus: {
    fontSize: 11,
    fontWeight: '800',
  },
  logTaken: {
    color: '#166534',
  },
  logMissed: {
    color: '#B91C1C',
  },
  logMeta: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F2544',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
  },
  inputNoMargin: {
    marginBottom: 0,
  },
  timeRowModal: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  timePickerButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  timePickerLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  timePickerValue: {
    marginTop: 2,
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
  },
  timePickerHint: {
    marginTop: 2,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  timePickerWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 4,
    backgroundColor: '#F8FAFC',
  },
  addTimeButton: {
    width: 48,
    borderRadius: 10,
    backgroundColor: '#1B3A5C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipsWrap: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E8EEF4',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timeChipText: {
    color: '#1B3A5C',
    fontSize: 12,
    fontWeight: '700',
  },
  daysLabel: {
    marginTop: 12,
    marginBottom: 7,
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  daysWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dayChipActive: {
    backgroundColor: '#1B3A5C',
    borderColor: '#1B3A5C',
  },
  dayChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  enabledRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
  },
  modalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  modalCancelText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 13,
  },
  modalSave: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1B3A5C',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
