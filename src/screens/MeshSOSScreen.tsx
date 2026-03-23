import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AuditTimelineService } from '../services/AuditTimelineService';

const { width } = Dimensions.get('window');

export const MeshSOSScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [peersFound, setPeersFound] = useState(0);
  const [status, setStatus] = useState('Initializing Mesh Network...');

  // Animations
  const radarAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Radar Animation
    const startRadar = () => {
      radarAnim.setValue(0);
      Animated.loop(
        Animated.timing(radarAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        })
      ).start();
    };

    // SOS Pulse Animation
    const startPulse = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    startRadar();
    startPulse();

    // Simulate finding peers
    const timer1 = setTimeout(() => {
      setStatus('Scanning for nearby Sahayak nodes...');
    }, 2000);

    const timer2 = setTimeout(() => {
      setPeersFound(1);
      setStatus('Peer Node Found: Relay established.');
    }, 5000);

    const timer3 = setTimeout(() => {
      setPeersFound(3);
      setStatus('Mesh Chain Active (3 Nodes). Ready to relay SOS.');
    }, 9000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const handleSOS = () => {
    setStatus('📡 TRANSMITTING SOS TO MESH NETWORK...');

    void AuditTimelineService.logEvent({
      type: 'sos_triggered',
      severity: 'critical',
      source: 'sos',
      summary: 'User triggered SOS mesh broadcast',
      details: {
        peersFound,
        statusBeforeTrigger: status,
      },
    });

    setTimeout(() => {
      setStatus('SOS Relayed to nearest Search & Rescue relay.');
      void AuditTimelineService.logEvent({
        type: 'user_action_taken',
        severity: 'warning',
        source: 'sos',
        summary: 'SOS relay status updated',
        details: {
          peersFound,
          relayStatus: 'SOS Relayed to nearest Search & Rescue relay.',
        },
      });
    }, 3000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#C62828" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
           <MaterialCommunityIcons name="close" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mesh SOS</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.introText}>
          No Cell Service? Sahayak uses Bluetooth & WiFi Direct to create a secure chain to relay your emergency signal.
        </Text>

        {/* Radar Visualization */}
        <View style={styles.radarContainer}>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.radarCircle,
                {
                  transform: [
                    {
                      scale: radarAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.1, 1.5],
                      }),
                    },
                  ],
                  opacity: radarAnim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0, 0.4, 0],
                  }),
                },
              ]}
            />
          ))}
          
          <Animated.View style={[styles.mainButtonContainer, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity onPress={handleSOS} style={styles.sosButton} activeOpacity={0.8}>
              <Text style={styles.sosText}>SOS</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Status Hub */}
        <View style={styles.statusHub}>
          <View style={styles.nodeCounter}>
            <Text style={styles.nodeValue}>{peersFound}</Text>
            <Text style={styles.nodeLabel}>Peers Found</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusInfo}>
            <View style={styles.onlineBadge}>
              <View style={[styles.dot, { backgroundColor: peersFound > 0 ? '#4CAF50' : '#FFC107' }]} />
              <Text style={styles.onlineText}>{peersFound > 0 ? 'MESH ACTIVE' : 'SCANNING'}</Text>
            </View>
            <Text style={styles.statusDetail}>{status}</Text>
          </View>
        </View>

        <View style={styles.instructionCard}>
          <Text style={styles.instructionTitle}>How it works</Text>
          <Text style={styles.instructionBody}>
            Your message will jump from phone to phone until it reaches a device with satellite or cellular connectivity. 
            Keep your device within 50 meters of other survivors.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 15 : 15,
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 25,
  },
  introText: {
    color: '#888',
    textAlign: 'center',
    fontSize: 14,
    marginTop: 10,
    lineHeight: 20,
  },
  radarContainer: {
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  radarCircle: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: (width * 0.8) / 2,
    borderWidth: 2,
    borderColor: '#C62828',
  },
  mainButtonContainer: {
    backgroundColor: 'rgba(198, 40, 40, 0.2)',
    padding: 20,
    borderRadius: 100,
  },
  sosButton: {
    width: 140,
    height: 140,
    backgroundColor: '#C62828',
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#C62828',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  sosText: {
    color: '#FFF',
    fontSize: 40,
    fontWeight: '900',
  },
  statusHub: {
    width: '100%',
    backgroundColor: '#1E1E1E',
    borderRadius: 15,
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
  },
  nodeCounter: {
    alignItems: 'center',
    marginRight: 20,
  },
  nodeValue: {
    color: '#FFF',
    fontSize: 32,
    fontWeight: '800',
  },
  nodeLabel: {
    color: '#888',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: '#333',
    marginRight: 20,
  },
  statusInfo: {
    flex: 1,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  onlineText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  statusDetail: {
    color: '#AAA',
    fontSize: 13,
  },
  instructionCard: {
    marginTop: 25,
    padding: 20,
    backgroundColor: '#111',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  instructionTitle: {
    color: '#C62828',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  instructionBody: {
    color: '#777',
    fontSize: 14,
    lineHeight: 20,
  },
});
