// The Live Activity's 📍 button. A LiveActivityIntent runs in the app's process (not the widget's), so it
// can write to the app's database. It has to exist in both the app and the widget: targets/_shared.

import AppIntents

@available(iOS 17.0, *)
struct RecordStopLiveActivityIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Record stop"
  static var description = IntentDescription("Marks a stop on the IncomeMeter route in progress.")
  static var isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    _ = await StopRecorder.record()
    return .result()
  }
}
