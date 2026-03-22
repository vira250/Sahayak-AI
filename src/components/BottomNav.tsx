import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

type NavigationProp = StackNavigationProp<RootStackParamList>;

interface BottomNavProps {
  activeTab: 'Home' | 'History' | 'Scan' | 'Settings';
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
  const navigation = useNavigation<NavigationProp>();

  return (
    <View style={styles.bottomNav}>
      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => navigation.navigate('Home')}
      >
        <View style={[styles.navIconContainer, activeTab === 'Home' && styles.navItemActive]}>
          <MaterialCommunityIcons 
            name="home" 
            size={24} 
            color={activeTab === 'Home' ? '#1B3A5C' : '#94A3B8'} 
          />
        </View>
        <Text style={[styles.navLabel, activeTab === 'Home' && styles.navLabelActive]}>HOME</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => navigation.navigate('History')}
      >
        <View style={[styles.navIconContainer, activeTab === 'History' && styles.navItemActive]}>
          <MaterialCommunityIcons 
            name="history" 
            size={24} 
            color={activeTab === 'History' ? '#1B3A5C' : '#94A3B8'} 
          />
        </View>
        <Text style={[styles.navLabel, activeTab === 'History' && styles.navLabelActive]}>HISTORY</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => navigation.navigate('Scan')}
      >
        <View style={[styles.navIconContainer, activeTab === 'Scan' && styles.navItemActive]}>
          <MaterialCommunityIcons 
            name="magnify" 
            size={24} 
            color={activeTab === 'Scan' ? '#1B3A5C' : '#94A3B8'} 
          />
        </View>
        <Text style={[styles.navLabel, activeTab === 'Scan' && styles.navLabelActive]}>SCAN</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.navItem} 
        onPress={() => navigation.navigate('Settings')}
      >
        <View style={[styles.navIconContainer, activeTab === 'Settings' && styles.navItemActive]}>
          <MaterialCommunityIcons 
            name="account-outline" 
            size={24} 
            color={activeTab === 'Settings' ? '#1B3A5C' : '#94A3B8'} 
          />
        </View>
        <Text style={[styles.navLabel, activeTab === 'Settings' && styles.navLabelActive]}>PROFILE</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bottomNav: {
    height: 85,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  navItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconContainer: {
    width: 44,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    marginBottom: 4,
  },
  navItemActive: {
    backgroundColor: '#E8EEF4',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  navLabelActive: {
    color: '#1B3A5C',
    fontWeight: '800',
  },
});
