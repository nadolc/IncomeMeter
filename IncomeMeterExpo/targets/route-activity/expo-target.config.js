/** Widget extension holding the route Live Activity (Lock Screen + Dynamic Island). Built by @bacons/apple-targets. */
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'RouteActivity',
  displayName: 'IncomeMeter',
  bundleIdentifier: '.routeactivity',
  deploymentTarget: '16.4',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit', 'AppIntents'],
};
