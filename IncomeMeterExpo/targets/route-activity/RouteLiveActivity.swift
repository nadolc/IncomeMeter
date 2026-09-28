// Live Activity for the route in progress. All text arrives in the ContentState in the app's language;
// the elapsed time is a SwiftUI timer, so it ticks without updates from the app.

import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

struct RouteLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RouteActivityAttributes.self) { context in
      LockScreenView(state: context.state)
        .activityBackgroundTint(Color.black.opacity(0.75))
        .activitySystemActionForegroundColor(.white)
        .widgetURL(context.attributes.url.flatMap(URL.init(string:)))
    } dynamicIsland: { context in
      let s = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text(s.elapsedLabel).font(.caption2).foregroundStyle(.secondary)
            ElapsedText(state: s).font(.title3.bold())
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 2) {
            Text(s.distanceLabel).font(.caption2).foregroundStyle(.secondary)
            Text(s.distance).font(.title3.bold()).monospacedDigit()
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          HStack {
            Text("\(s.stops) \(s.stopsWord)").font(.subheadline)
            Spacer()
            RecordStopButton(state: s)
          }
        }
      } compactLeading: {
        Image(systemName: s.symbol).foregroundStyle(.blue)
      } compactTrailing: {
        Text(s.distance).monospacedDigit().font(.caption.bold())
      } minimal: {
        Image(systemName: s.symbol).foregroundStyle(.blue)
      }
      .widgetURL(context.attributes.url.flatMap(URL.init(string:)))
    }
  }
}

private struct LockScreenView: View {
  let state: RouteActivityAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack {
        Image(systemName: state.symbol).foregroundStyle(.blue)
        Text(state.title).font(.headline).lineLimit(1)
        Spacer()
        if state.ended {
          Text(state.endedText).font(.subheadline)
        } else {
          ElapsedText(state: state).font(.headline)
        }
      }
      HStack(alignment: .firstTextBaseline) {
        Text(state.distance).font(.system(size: 28, weight: .bold)).monospacedDigit()
        Spacer()
        Text("\(state.stops) \(state.stopsWord)").font(.subheadline).foregroundStyle(.secondary)
      }
      RecordStopButton(state: state)
    }
    .foregroundStyle(.white)
    .padding(14)
  }
}

private struct ElapsedText: View {
  let state: RouteActivityAttributes.ContentState

  var body: some View {
    Text(Date(timeIntervalSince1970: state.startedAt), style: .timer)
      .monospacedDigit()
      .multilineTextAlignment(.trailing)
  }
}

/// iOS 17+: tapping runs RecordStopLiveActivityIntent in the app's process.
private struct RecordStopButton: View {
  let state: RouteActivityAttributes.ContentState

  var body: some View {
    if !state.ended {
      if #available(iOS 17.0, *) {
        Button(intent: RecordStopLiveActivityIntent()) {
          Label(state.recordLabel, systemImage: "mappin.and.ellipse")
            .font(.subheadline.bold())
        }
        .buttonStyle(.bordered)
        .tint(.blue)
      }
    }
  }
}
