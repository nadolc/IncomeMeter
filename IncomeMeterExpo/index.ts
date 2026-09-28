// Register the background location task before the router mounts, so the OS can wake the app
// headlessly to deliver GPS fixes for a route in progress. The Live Activity hooks into the same
// recording, so it is set up here too (also when iOS starts the app in the background).
import './src/tracking/tracker';
import 'expo-router/entry';
import { initLiveActivity } from './src/widgets/liveActivity';

initLiveActivity();
