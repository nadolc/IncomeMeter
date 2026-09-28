// "Record stop" action for the Shortcuts app (e.g. a "When CarPlay connects" automation).
// Runs in the background without opening IncomeMeter; the work is done by StopRecorder
// (targets/_shared/StopRecorder.swift). Added to the iOS app target by plugins/withRecordStopIntent.js.

import AppIntents

struct RecordStopIntent: AppIntent {
  static var title: LocalizedStringResource = "Record stop"
  static var description = IntentDescription("Marks a stop on the IncomeMeter route in progress at the phone's location, without opening the app.")
  static var openAppWhenRun: Bool = false

  @MainActor
  func perform() async throws -> some IntentResult & ProvidesDialog {
    .result(dialog: IntentDialog(stringLiteral: await StopRecorder.record()))
  }
}
