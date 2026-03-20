import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useModelService } from '../services/ModelService';
import { AppColors } from '../theme';

const { width } = Dimensions.get('window');

export const SplashScreen: React.FC = () => {
  const navigation = useNavigation();
  const { checkAllModelsDownloaded, isSetupReady } = useModelService();
  
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Check models and navigate
    const initApp = async () => {
      // Show splash for at least 2.5 seconds for branding
      const startTime = Date.now();
      
      try {
        const isReady = await checkAllModelsDownloaded();
        const elapsedTime = Date.now() - startTime;
        // If ready, show splash for 1.5s, otherwise 2.5s
        const minTime = isReady ? 1500 : 2500;
        const remainingTime = Math.max(0, minTime - elapsedTime);
        
        setTimeout(() => {
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                { name: isReady ? 'Home' : 'ModelDownload' }
              ],
            })
          );
        }, remainingTime);
      } catch (error) {
        console.error('Splash init error:', error);
        // Fallback to home if something goes wrong
        navigation.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] })
        );
      }
    };

    initApp();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[AppColors.primaryDark, '#1A1A2E', '#16213E']}
        style={styles.gradient}
      >
        <Animated.View 
          style={[
            styles.logoContainer, 
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
          ]}
        >
          <LinearGradient
            colors={[AppColors.accentCyan, AppColors.accentViolet]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoCircle}
          >
            <Text style={styles.logoText}>SA</Text>
          </LinearGradient>
          
          <Text style={styles.appName}>Sahayak AI</Text>
          <Text style={styles.tagline}>Your On-Device AI Companion</Text>
        </Animated.View>
        
        <View style={styles.footer}>
          <Text style={styles.version}>v1.0.0</Text>
          <Text style={styles.poweredBy}>Powered by RunAnywhere SDK</Text>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 20,
    shadowColor: AppColors.accentCyan,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '900',
    color: AppColors.textPrimary,
    letterSpacing: 2,
  },
  appName: {
    fontSize: 42,
    fontWeight: '700',
    color: AppColors.textPrimary,
    marginTop: 24,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: AppColors.textSecondary,
    marginTop: 8,
    opacity: 0.8,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  version: {
    color: AppColors.textSecondary,
    fontSize: 12,
    opacity: 0.5,
  },
  poweredBy: {
    color: AppColors.textSecondary,
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
    opacity: 0.7,
  },
});
