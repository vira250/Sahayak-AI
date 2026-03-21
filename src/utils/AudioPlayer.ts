import { Platform, NativeModules } from 'react-native';
import RNFS from 'react-native-fs';

let Sound: any = null;
if (Platform.OS === 'android') {
  try {
    Sound = require('react-native-sound').default;
  } catch (e) {
    console.log('react-native-sound not available');
  }
}

const { NativeAudioModule } = NativeModules;

// Convert base64 float32 PCM to WAV format
export const createWavFromBase64Float32 = (base64Audio: string, sampleRate: number): string => {
  const binaryStr = atob(base64Audio);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const float32Samples = new Float32Array(bytes.buffer);
  const numSamples = float32Samples.length;

  const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < float32Samples.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const uint8Array = new Uint8Array(wavBuffer);
  let result = '';
  for (let i = 0; i < uint8Array.length; i++) {
    result += String.fromCharCode(uint8Array[i]);
  }
  return btoa(result);
};

export const playBase64Audio = async (base64Audio: string): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      if (Platform.OS === 'ios' && NativeAudioModule) {
        await NativeAudioModule.playAudioBase64(base64Audio, 22050);
        resolve();
      } else if (Platform.OS === 'android' && Sound) {
        const wavData = createWavFromBase64Float32(base64Audio, 22050);
        const tempPath = `${RNFS.TemporaryDirectoryPath}/tts_playback_${Date.now()}.wav`;
        await RNFS.writeFile(tempPath, wavData, 'base64');

        const sound = new Sound(tempPath, '', (error: any) => {
          if (error) {
            console.error('Failed to load sound:', error);
            reject(error);
            return;
          }
          sound.play(() => {
            sound.release();
            RNFS.unlink(tempPath).catch(console.error); // cleanup
            resolve();
          });
        });
      } else {
        reject(new Error('Audio playback not supported on this device/configuration.'));
      }
    } catch (e) {
      reject(e);
    }
  });
};
