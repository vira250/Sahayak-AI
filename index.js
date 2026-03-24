/**
 * @format
 */
import 'react-native-gesture-handler';
import notifee from '@notifee/react-native';
import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';
import { handleMedicineNotificationEvent } from './src/services/MedicineScheduleService';

notifee.onBackgroundEvent(handleMedicineNotificationEvent);

AppRegistry.registerComponent(appName, () => App);
