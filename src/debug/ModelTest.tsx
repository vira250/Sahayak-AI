/**
 * ModelTest.tsx - Debug screen to test each model independently
 * 
 * This screen helps diagnose why models aren't producing output
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { RunAnywhere } from '@runanywhere/core';
import { useModelService } from '../services/ModelService';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  testButton: {
    backgroundColor: '#005da7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  output: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    minHeight: 100,
  },
  outputText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export const ModelTest: React.FC = () => {
  const modelService = useModelService();
  const [output, setOutput] = useState('Ready for testing...');

  const log = (msg: string) => {
    setOutput((prev) => prev + '\n' + msg);
  };

  const testLLM = async () => {
    setOutput('Testing LLM...');
    try {
      log('Checking if model is loaded...');
      const isLoaded = await RunAnywhere.isModelLoaded();
      log(`isModelLoaded: ${isLoaded}`);

      log('Generating response for prompt: "Hello"');
      const response = await RunAnywhere.generate('Hello, say one word to test', { maxTokens: 50 });
      log(`Response type: ${typeof response}`);
      log(`Response: ${JSON.stringify(response, null, 2)}`);

      if ((response as any).text) {
        log(`Extracted text: ${(response as any).text}`);
      }
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testSTT = async () => {
    setOutput('Testing STT...');
    try {
      log('Checking if STT model is loaded...');
      const isLoaded = await RunAnywhere.isSTTModelLoaded();
      log(`isSTTModelLoaded: ${isLoaded}`);

      log('Starting voice session for 5 seconds...');
      const session = await RunAnywhere.startVoiceSession({ continuousMode: false });
      log('Voice session started, listening for input...');

      let transcript = '';
      for await (const event of session.events()) {
        log(`Event: ${event.type}`);
        if (event.type === 'transcribed' && (event as any).transcription) {
          transcript = (event as any).transcription;
          log(`Transcribed: ${transcript}`);
        } else if (event.type === 'turnCompleted' && (event as any).transcription) {
          transcript = (event as any).transcription;
          log(`Turn completed with: ${transcript}`);
          break;
        } else if (event.type === 'stopped') {
          break;
        }
      }

      if (!transcript) {
        log('No transcript captured');
      }
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testTTS = async () => {
    setOutput('Testing TTS...');
    try {
      log('Checking if TTS model is loaded...');
      const isLoaded = await RunAnywhere.isTTSModelLoaded();
      log(`isTTSModelLoaded: ${isLoaded}`);

      log('Synthesizing text: "Hello world"');
      const result = await RunAnywhere.synthesize('Hello world', { language: 'en-US' });
      log(`Result type: ${typeof result}`);
      log(`Result keys: ${Object.keys(result)}`);
      log(`Audio data length: ${(result as any).audioData?.length ?? 'N/A'}`);
      log(`Format: ${(result as any).format}`);
      log(`Duration: ${(result as any).duration}`);
    } catch (error) {
      log(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const clearOutput = () => {
    setOutput('Cleared.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Model Diagnostics</Text>

      <Text style={styles.title}>Status</Text>
      <Text>{`LLM Loaded: ${modelService.isLLMLoaded}`}</Text>
      <Text>{`STT Loaded: ${modelService.isSTTLoaded}`}</Text>
      <Text>{`TTS Loaded: ${modelService.isTTSLoaded}`}</Text>

      <Text style={styles.title}>Tests</Text>
      <TouchableOpacity style={styles.testButton} onPress={testLLM}>
        <Text style={styles.testButtonText}>Test LLM Generation</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.testButton} onPress={testSTT}>
        <Text style={styles.testButtonText}>Test STT</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.testButton} onPress={testTTS}>
        <Text style={styles.testButtonText}>Test TTS</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.testButton, { backgroundColor: '#999' }]} onPress={clearOutput}>
        <Text style={styles.testButtonText}>Clear Output</Text>
      </TouchableOpacity>

      <View style={styles.output}>
        <ScrollView>
          <Text style={styles.outputText}>{output}</Text>
        </ScrollView>
      </View>
    </View>
  );
};
