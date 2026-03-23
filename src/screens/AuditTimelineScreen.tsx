import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import { RootStackParamList } from '../navigation/types';
import { AuditTimelineEvent, AuditTimelineService, AuditEventType } from '../services/AuditTimelineService';
import { useToast } from '../services/ToastService';

const typeLabels: Record<AuditEventType, string> = {
  symptom_entry: 'Symptom Entry',
  emergency_warning_shown: 'Emergency Warning',
  sos_triggered: 'SOS Triggered',
  user_action_taken: 'User Action',
  analysis_completed: 'Analysis Completed',
  model_issue: 'Model Issue',
};

const severityColors = {
  info: '#0EA5E9',
  warning: '#F59E0B',
  critical: '#EF4444',
};

export const AuditTimelineScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { showToast } = useToast();
  const [events, setEvents] = useState<AuditTimelineEvent[]>([]);
  const [selectedType, setSelectedType] = useState<'all' | AuditEventType>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const load = useCallback(async () => {
    const loaded = await AuditTimelineService.getEvents();
    setEvents(loaded);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filteredEvents = useMemo(() => {
    if (selectedType === 'all') return events;
    return events.filter((event) => event.type === selectedType);
  }, [events, selectedType]);

  const handleClear = async () => {
    await AuditTimelineService.clearEvents();
    setEvents([]);
    showToast('Audit timeline cleared', 'success', 'bottom');
  };

  const renderEvent = ({ item }: { item: AuditTimelineEvent }) => {
    const time = new Date(item.timestamp).toLocaleString();
    return (
      <View style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <View style={styles.tagRow}>
            <View style={[styles.severityDot, { backgroundColor: severityColors[item.severity] }]} />
            <Text style={styles.eventType}>{typeLabels[item.type]}</Text>
          </View>
        </View>
        <Text style={styles.eventSummary}>{item.summary}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.eventSource}>{item.source.toUpperCase()}</Text>
          <Text style={styles.eventTime}>{time}</Text>
        </View>
      </View>
    );
  };

  const filterItems: Array<{ key: 'all' | AuditEventType; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'symptom_entry', label: 'Symptoms' },
    { key: 'emergency_warning_shown', label: 'Warnings' },
    { key: 'sos_triggered', label: 'SOS' },
    { key: 'user_action_taken', label: 'Actions' },
  ];

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
            <Text style={styles.title}>Audit Timeline</Text>
            <Text style={styles.subtitle}>Offline clinical trace</Text>
          </View>
        </View>
      </View>

      <View style={styles.heroWrap}>
        <LinearGradient colors={['#0F2544', '#1B3A5C']} style={styles.heroCard}>
          <View>
            <Text style={styles.heroTitle}>Recorded Events</Text>
            <Text style={styles.heroValue}>{filteredEvents.length}</Text>
            <Text style={styles.heroSub}>Filtered results</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <MaterialCommunityIcons name="timeline-text-outline" size={30} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity onPress={() => setShowClearConfirm(true)} style={styles.clearButton}>
          <MaterialCommunityIcons name="delete-outline" size={14} color="#DC2626" />
          <Text style={styles.clearText}>Clear Audit History</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {filterItems.map((item) => {
          const active = selectedType === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setSelectedType(item.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {filteredEvents.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="timeline-text-outline" size={58} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No audit events yet</Text>
          <Text style={styles.emptySub}>Critical actions and symptom events will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderEvent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={showClearConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearConfirm(false)}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIconWrap}>
              <MaterialCommunityIcons name="delete-alert-outline" size={18} color="#B42318" />
            </View>
            <Text style={styles.confirmTitle}>Clear Audit Timeline?</Text>
            <Text style={styles.confirmMessage}>This will remove all recorded events from this device.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowClearConfirm(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={async () => {
                  setShowClearConfirm(false);
                  await handleClear();
                }}
              >
                <Text style={styles.deleteText}>Delete All</Text>
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#E8EEF4',
  },
  saveText: {
    color: '#0F2544',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 5,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FEE2E2',
  },
  clearText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 6,
  },
  heroWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  heroCard: {
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    fontSize: 13,
  },
  heroValue: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 32,
    marginTop: 2,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 8,
  },
  filterChip: {
    backgroundColor: '#E8EEF4',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: '#1B3A5C',
  },
  filterText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0F2544',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  eventType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 3,
  },
  eventTime: {
    fontSize: 11,
    color: '#64748B',
  },
  eventSummary: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
  },
  eventSource: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
  },
  emptySub: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  confirmIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmTitle: {
    fontSize: 17,
    color: '#0F172A',
    fontWeight: '800',
  },
  confirmMessage: {
    marginTop: 6,
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  confirmActions: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelBtn: {
    borderRadius: 10,
    backgroundColor: '#E8EEF4',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  cancelText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteBtn: {
    borderRadius: 10,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  deleteText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
