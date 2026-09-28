// Keep identical to targets/_shared/RouteActivityAttributes.swift: ActivityKit matches the app's activity
// to the widget's layout by this type's name and shape.
import ActivityKit
import Foundation

struct RouteActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var title: String
    /// SF Symbol for the travel mode.
    var symbol: String
    /// Route start, seconds since 1970 – the Lock Screen timer counts up from it by itself.
    var startedAt: Double
    var distance: String
    var stops: Int
    var stopsWord: String
    var elapsedLabel: String
    var distanceLabel: String
    var recordLabel: String
    var ended: Bool
    var endedText: String
  }

  var routeId: String
  var url: String?
}
