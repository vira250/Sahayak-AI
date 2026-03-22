import 'react-native-gesture-handler'; // Must be at the top!
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator, TransitionPresets, CardStyleInterpolators } from '@react-navigation/stack';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Note: react-native-screens is shimmed in index.js for iOS New Architecture compatibility
import { RunAnywhere, SDKEnvironment } from '@runanywhere/core';
import { LlamaCPP, LlamaCppProvider, isNativeLlamaModuleAvailable } from '@runanywhere/llamacpp';
import { ONNX, ONNXProvider, isNativeONNXModuleAvailable } from '@runanywhere/onnx';
import { ModelServiceProvider, registerDefaultModels } from './services/ModelService';
import { AppColors } from './theme';
import {
  HomeScreen,
  HistoryScreen,
  ChatScreen,
  ScanScreen,
  ToolCallingScreen,
  SpeechToTextScreen,
  TextToSpeechScreen,
  VoicePipelineScreen,
  SmartNotesScreen,
  SplashScreen,
  ModelDownloadScreen,
} from './screens';
import { RootStackParamList } from './navigation/types';

// Using JS-based stack navigator instead of native-stack
// to avoid react-native-screens setColor crash with New Architecture
const Stack = createStackNavigator<RootStackParamList>();

const App: React.FC = () => {
  useEffect(() => {
    // Initialize SDK
    const initializeSDK = async () => {
      try {
        // Initialize RunAnywhere SDK (Development mode doesn't require API key)
        await RunAnywhere.initialize({
          environment: SDKEnvironment.Development,
        });

        // Verify native modules are available via Nitro
        console.log('LlamaCPP available:', isNativeLlamaModuleAvailable());
        console.log('ONNX available:', isNativeONNXModuleAvailable());

        // Register backends with static imports (must await to complete native registration)
        const llamaRegistered = await LlamaCppProvider.register();
        const onnxRegistered = await ONNXProvider.register();
        
        console.log('LlamaCPP registered:', llamaRegistered);
        console.log('ONNX registered:', onnxRegistered);

        // Register default models
        await registerDefaultModels();

        console.log('RunAnywhere SDK initialized successfully');
      } catch (error) {
        console.error('Failed to initialize RunAnywhere SDK:', error);
      }
    };

    initializeSDK();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ModelServiceProvider>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{
              headerShown: false,
              cardStyle: {
                backgroundColor: '#FFFFFF',
              },
              // Default: iOS-like slide for push screens
              ...TransitionPresets.SlideFromRightIOS,
            }}
          >
            <Stack.Screen
              name="Splash"
              component={SplashScreen}
              options={{ ...TransitionPresets.FadeFromBottomAndroid }}
            />
            <Stack.Screen
              name="ModelDownload"
              component={ModelDownloadScreen}
              options={{ ...TransitionPresets.FadeFromBottomAndroid }}
            />
            {/* Tab-like screens: instant fade for bottom nav switching */}
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              options={{
                headerShown: false,
                cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
                transitionSpec: {
                  open: { animation: 'timing', config: { duration: 0 } },
                  close: { animation: 'timing', config: { duration: 0 } },
                },
              }}
            />
            <Stack.Screen
              name="History"
              component={HistoryScreen}
              options={{
                headerShown: false,
                cardStyleInterpolator: CardStyleInterpolators.forNoAnimation,
                transitionSpec: {
                  open: { animation: 'timing', config: { duration: 0 } },
                  close: { animation: 'timing', config: { duration: 0 } },
                },
              }}
            />
            {/* Push screens: slide animation */}
            <Stack.Screen
              name="Chat"
              component={ChatScreen}
              options={{ title: 'Chat' }}
            />
            <Stack.Screen
              name="Scan"
              component={ScanScreen}
              options={{ title: 'Scan' }}
            />
            <Stack.Screen
              name="ToolCalling"
              component={ToolCallingScreen}
              options={{ title: 'Tool Calling' }}
            />
            <Stack.Screen
              name="SpeechToText"
              component={SpeechToTextScreen}
              options={{ title: 'Speech to Text' }}
            />
            <Stack.Screen
              name="TextToSpeech"
              component={TextToSpeechScreen}
              options={{ title: 'Text to Speech' }}
            />
            <Stack.Screen
              name="VoicePipeline"
              component={VoicePipelineScreen}
              options={{ title: 'Voice Pipeline' }}
            />
            <Stack.Screen
              name="SmartNotes"
              component={SmartNotesScreen}
              options={{ title: 'Smart Voice Notes' }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </ModelServiceProvider>
    </GestureHandlerRootView>
  );
};

export default App;
