// Register the background location task before the router mounts, so the OS can wake the app
// headlessly to deliver GPS fixes for a route in progress.
import './src/tracking/tracker';
import 'expo-router/entry';
