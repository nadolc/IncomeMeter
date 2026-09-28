// Records a stop on the route in progress, natively: used by the Shortcuts "Record stop" action
// (native/ios/RecordStopIntent.swift) and the Live Activity's 📍 button (RecordStopLiveActivityIntent).
// Both run in the app's process, so the app's own database is available without an app group.
// Linked into the app and the widget extension by @bacons/apple-targets (targets/_shared).

import ActivityKit
import CoreLocation
import Foundation
import SQLite3

enum StopRecorder {
  /// Records the stop and returns a short message (shown by Shortcuts).
  @MainActor
  static func record() async -> String {
    guard let store = StopStore() else { return "IncomeMeter: open the app once first." }
    let zh = store.usesChinese()
    guard let routeId = store.routeInProgress() else {
      return zh ? "IncomeMeter：未有進行中嘅路線" : "IncomeMeter: no route in progress"
    }
    let finder = OneShotLocation()
    guard let location = await finder.current() else {
      return zh ? "IncomeMeter：攞唔到位置" : "IncomeMeter: location unavailable"
    }
    if store.repeatsLastStop(routeId: routeId, location: location) {
      return zh ? "IncomeMeter：呢個位置啱啱記錄咗" : "IncomeMeter: stop already recorded"
    }
    let address = await address(for: location)
    store.insertStop(routeId: routeId, location: location, address: address)
    await refreshLiveActivity(stops: store.stopCount(routeId: routeId))
    let place = address.map { " – \($0)" } ?? ""
    return (zh ? "IncomeMeter：已記錄位置" : "IncomeMeter: stop recorded") + place
  }

  /// Show the new stop count on the Lock Screen straight away (the app refreshes the rest later).
  static func refreshLiveActivity(stops: Int) async {
    for activity in Activity<RouteActivityAttributes>.activities {
      var state = activity.content.state
      state.stops = stops
      await activity.update(.init(state: state, staleDate: nil))
    }
  }

  /// "Rose And Crown, Swarkestone Road, Derby" – best effort, nil offline.
  private static func address(for location: CLLocation) async -> String? {
    guard let p = try? await CLGeocoder().reverseGeocodeLocation(location).first else { return nil }
    let street = [p.subThoroughfare, p.thoroughfare].compactMap { $0 }.joined(separator: " ")
    var parts: [String] = []
    if let name = p.name, name != street { parts.append(name) }
    if !street.isEmpty { parts.append(street) }
    if let area = p.subLocality ?? p.locality { parts.append(area) }
    return parts.isEmpty ? nil : parts.joined(separator: ", ")
  }
}

/// One location fix: a recent one from the route recording if there is one, else a fresh request (15 s max).
@MainActor
final class OneShotLocation: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var continuation: CheckedContinuation<CLLocation?, Never>?

  func current() async -> CLLocation? {
    if let recent = manager.location, recent.timestamp.timeIntervalSinceNow > -20,
       recent.horizontalAccuracy >= 0, recent.horizontalAccuracy <= 50 {
      return recent
    }
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
    return await withCheckedContinuation { cont in
      continuation = cont
      manager.requestLocation()
      Task { @MainActor in
        try? await Task.sleep(nanoseconds: 15_000_000_000)
        self.finish(self.manager.location)
      }
    }
  }

  private func finish(_ location: CLLocation?) {
    continuation?.resume(returning: location)
    continuation = nil
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    let last = locations.last
    Task { @MainActor in self.finish(last) }
  }

  nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    Task { @MainActor in self.finish(self.manager.location) }
  }
}

/// The app's SQLite database (expo-sqlite: Documents/SQLite/incomemeter.db), same tables as src/db.
final class StopStore {
  private var db: OpaquePointer?
  private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
  /// Same rule as the app and the API: this close in time and place is the same stop.
  private static let sameStopSeconds: TimeInterval = 5 * 60
  private static let sameStopMetres: CLLocationDistance = 150

  init?() {
    guard let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return nil }
    let path = docs.appendingPathComponent("SQLite/incomemeter.db").path
    guard FileManager.default.fileExists(atPath: path),
          sqlite3_open_v2(path, &db, SQLITE_OPEN_READWRITE, nil) == SQLITE_OK else { return nil }
    sqlite3_busy_timeout(db, 3000)
  }

  deinit { sqlite3_close(db) }

  func usesChinese() -> Bool {
    (text("SELECT value FROM kv WHERE key = 'settings'") ?? "").contains("\"zh-HK\"")
  }

  func routeInProgress() -> String? {
    text("""
      SELECT id FROM docs WHERE collection = 'routes' AND deleted = 0
        AND json_extract(data, '$.status') = 'in_progress'
      ORDER BY json_extract(data, '$.actualStartTime') DESC LIMIT 1
      """) ?? text("SELECT value FROM kv WHERE key = 'tracking.activeRouteId'")
  }

  func stopCount(routeId: String) -> Int {
    var stmt: OpaquePointer?
    defer { sqlite3_finalize(stmt) }
    guard sqlite3_prepare_v2(db, "SELECT COUNT(*) FROM locations WHERE route_id = ? AND kind = 'stop'", -1, &stmt, nil) == SQLITE_OK else { return 0 }
    sqlite3_bind_text(stmt, 1, routeId, -1, Self.transient)
    return sqlite3_step(stmt) == SQLITE_ROW ? Int(sqlite3_column_int(stmt, 0)) : 0
  }

  func repeatsLastStop(routeId: String, location: CLLocation) -> Bool {
    var stmt: OpaquePointer?
    defer { sqlite3_finalize(stmt) }
    let sql = "SELECT latitude, longitude, timestamp FROM locations WHERE route_id = ? AND kind = 'stop' ORDER BY timestamp DESC LIMIT 1"
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return false }
    sqlite3_bind_text(stmt, 1, routeId, -1, Self.transient)
    guard sqlite3_step(stmt) == SQLITE_ROW, let ts = sqlite3_column_text(stmt, 2),
          let when = Self.iso.date(from: String(cString: ts)) else { return false }
    let last = CLLocation(latitude: sqlite3_column_double(stmt, 0), longitude: sqlite3_column_double(stmt, 1))
    return Date().timeIntervalSince(when) <= Self.sameStopSeconds && last.distance(from: location) <= Self.sameStopMetres
  }

  func insertStop(routeId: String, location: CLLocation, address: String?) {
    var stmt: OpaquePointer?
    defer { sqlite3_finalize(stmt) }
    let sql = """
      INSERT INTO locations (id, route_id, latitude, longitude, timestamp, accuracy, speed, address, distance_km, distance_mi, dirty, kind, altitude)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, 1, 'stop', ?)
      """
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
    sqlite3_bind_text(stmt, 1, Self.newId(), -1, Self.transient)
    sqlite3_bind_text(stmt, 2, routeId, -1, Self.transient)
    sqlite3_bind_double(stmt, 3, (location.coordinate.latitude * 1e6).rounded() / 1e6)
    sqlite3_bind_double(stmt, 4, (location.coordinate.longitude * 1e6).rounded() / 1e6)
    sqlite3_bind_text(stmt, 5, Self.iso.string(from: Date()), -1, Self.transient)
    if location.horizontalAccuracy >= 0 { sqlite3_bind_double(stmt, 6, location.horizontalAccuracy) } else { sqlite3_bind_null(stmt, 6) }
    if let address { sqlite3_bind_text(stmt, 7, address, -1, Self.transient) } else { sqlite3_bind_null(stmt, 7) }
    if location.verticalAccuracy >= 0 { sqlite3_bind_double(stmt, 8, location.altitude) } else { sqlite3_bind_null(stmt, 8) }
    sqlite3_step(stmt)
  }

  private func text(_ sql: String) -> String? {
    var stmt: OpaquePointer?
    defer { sqlite3_finalize(stmt) }
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK, sqlite3_step(stmt) == SQLITE_ROW,
          let value = sqlite3_column_text(stmt, 0) else { return nil }
    return String(cString: value)
  }

  /// Same timestamp format as JavaScript's toISOString(), so ordering by text works.
  private static let iso: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
  }()

  /// 24-hex id in MongoDB ObjectId layout, like newId() in src/db/database.ts.
  private static func newId() -> String {
    let seconds = String(format: "%08x", UInt32(Date().timeIntervalSince1970))
    let random = (0..<8).map { _ in String(format: "%02x", UInt8.random(in: 0...255)) }.joined()
    return seconds + random
  }
}
