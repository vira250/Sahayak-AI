import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
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
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 15,
        friction: 7,
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
        const minTime = isReady ? 2000 : 3000;
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
        colors={['#FFFFFF', '#F8FAFC', '#F1F5F9']}
        style={styles.gradient}
      >
        <Animated.View
          style={[
            styles.logoContainer,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }
          ]}
        >
          <Image
            source={require('../assets/logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          <Text style={styles.appName}>Sahayak AI</Text>
          <Text style={styles.tagline}>Your Private On-Device AI Companion</Text>
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
    paddingHorizontal: 20,
  },
  logoImage: {
    width: width * 0.65,
    height: width * 0.65,
    marginBottom: 8,
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    color: '#0F2544',
    marginTop: 0,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 18,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  version: {
    color: '#94A3B8',
    fontSize: 12,
    opacity: 0.6,
  },
  poweredBy: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 6,
    fontWeight: '600',
    opacity: 0.8,
  },
});