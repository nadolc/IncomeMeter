import ActivityKit
import ExpoModulesCore

/// JS side: src/widgets/liveActivity.ts. The layout is native SwiftUI in targets/route-activity, so nothing
/// has to be shared through an app group (sideloaded builds signed with a free Apple ID don't get one).
public class RouteLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RouteLiveActivity")

    Function("isEnabled") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    Function("count") { () -> Int in
      Activity<RouteActivityAttributes>.activities.count
    }

    /// Ends any previous route's activity, then starts one for this route. `state` is ContentState as JSON.
    AsyncFunction("start") { (routeId: String, url: String?, state: String) async throws -> String in
      let content = try Self.decode(state)
      for old in Activity<RouteActivityAttributes>.activities {
        await old.end(nil, dismissalPolicy: .immediate)
      }
      let activity = try Activity.request(
        attributes: RouteActivityAttributes(routeId: routeId, url: url),
        content: .init(state: content, staleDate: nil),
        pushType: nil
      )
      return activity.id
    }

    AsyncFunction("update") { (state: String) async throws in
      let content = try Self.decode(state)
      for activity in Activity<RouteActivityAttributes>.activities {
        await activity.update(.init(state: content, staleDate: nil))
      }
    }

    /// Shows the final state for `dismissAfterSeconds`, then iOS removes it.
    AsyncFunction("end") { (state: String, dismissAfterSeconds: Double) async throws in
      let content = try Self.decode(state)
      for activity in Activity<RouteActivityAttributes>.activities {
        await activity.end(
          .init(state: content, staleDate: nil),
          dismissalPolicy: .after(Date().addingTimeInterval(dismissAfterSeconds))
        )
      }
    }
  }

  private static func decode(_ json: String) throws -> RouteActivityAttributes.ContentState {
    try JSONDecoder().decode(RouteActivityAttributes.ContentState.self, from: Data(json.utf8))
  }
}
