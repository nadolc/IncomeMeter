// Extends app.json with values that come from the build environment.
// GOOGLE_MAPS_API_KEY: Android builds need it to draw maps (set it with `eas env:create`).
// Without it the Android app still works; route screens just show the list of points instead of a map.
module.exports = ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY;
  return {
    ...config,
    android: {
      ...config.android,
      ...(mapsKey ? { config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } } : {}),
    },
    extra: {
      ...config.extra,
      androidMaps: !!mapsKey,
    },
  };
};
