import Foundation

// 위젯용 시장 환율(UniRateAPI) 읽기.
// 앱과 같은 Firestore `rates/live` 문서를 읽는다. 약관상 재배포 금지라 공개 파일에는 없고,
// 로그인한 사용자만 읽을 수 있어서 위젯도 익명 로그인 후 읽는다.
// 위젯은 메모리 한도가 작아 Firebase SDK 대신 REST로 부른다.

struct WidgetMarketSnapshot {
    let rates: [String: Double]
    let fetchedAt: Date

    /// 앱·서버와 같은 기준: 장중 30분, 외환시장이 닫힌 주말에는 72시간 이내.
    func isUsable(now: Date = .now) -> Bool {
        guard rates["USD"] != nil else { return false }
        let minutes = now.timeIntervalSince(fetchedAt) / 60
        if minutes < -5 { return false }
        return Self.isFxMarketOpen(now) ? minutes <= 30 : minutes <= 72 * 60
    }

    /// 국제 외환시장: 일요일 21:00 ~ 금요일 22:00 (UTC)
    static func isFxMarketOpen(_ now: Date) -> Bool {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let weekday = calendar.component(.weekday, from: now)
        let hour = calendar.component(.hour, from: now)
        switch weekday {
        case 7: return false
        case 1: return hour >= 21
        case 6: return hour < 22
        default: return true
        }
    }
}

enum WidgetMarketLoader {
    private static let appBundleID = "com.greego86.exchange-alert"
    private static let defaults = UserDefaults(suiteName: "group.com.giroklabs.exchangealert")
    private static let refreshTokenKey = "widgetAuthRefreshToken"
    private static let idTokenKey = "widgetAuthIDToken"
    private static let idTokenExpiryKey = "widgetAuthIDTokenExpiry"

    /// 실패하면 nil (위젯은 고시 환율로 대신한다).
    static func load() async -> WidgetMarketSnapshot? {
        guard let config = FirebaseConfig.load() else { return nil }
        guard let token = await idToken(config) else { return nil }
        var request = URLRequest(url: URL(string: "https://firestore.googleapis.com/v1/projects/\(config.projectID)/databases/(default)/documents/rates/live")!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue(appBundleID, forHTTPHeaderField: "X-Ios-Bundle-Identifier")
        request.timeoutInterval = 15
        guard let json = await sendJSON(request) else { return nil }
        if json["error"] != nil {
            // 토큰이 막혔을 수 있다. 다음 번에 새로 받는다.
            defaults?.removeObject(forKey: idTokenKey)
            return nil
        }
        return parse(json)
    }

    static func parse(_ json: [String: Any]) -> WidgetMarketSnapshot? {
        guard let fields = json["fields"] as? [String: Any],
              let rateFields = ((fields["rates"] as? [String: Any])?["mapValue"] as? [String: Any])?["fields"] as? [String: Any],
              let stamp = (fields["fetchedAt"] as? [String: Any])?["timestampValue"] as? String,
              let fetchedAt = parseTimestamp(stamp) else { return nil }
        var rates: [String: Double] = [:]
        for (code, value) in rateFields {
            guard let value = value as? [String: Any] else { continue }
            if let number = value["doubleValue"] as? Double {
                rates[code] = number
            } else if let text = value["integerValue"] as? String, let number = Double(text) {
                rates[code] = number
            } else if let number = value["integerValue"] as? Int {
                rates[code] = Double(number)
            }
        }
        return rates.isEmpty ? nil : WidgetMarketSnapshot(rates: rates, fetchedAt: fetchedAt)
    }

    private static func parseTimestamp(_ text: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return withFraction.date(from: text) ?? ISO8601DateFormatter().date(from: text)
    }

    // MARK: - 익명 로그인 (토큰은 App Group에 보관해 매번 새 사용자를 만들지 않는다)

    private static func idToken(_ config: FirebaseConfig) async -> String? {
        if let token = defaults?.string(forKey: idTokenKey),
           let expiry = defaults?.object(forKey: idTokenExpiryKey) as? Date,
           expiry.timeIntervalSinceNow > 120 {
            return token
        }
        if let refresh = defaults?.string(forKey: refreshTokenKey) {
            var request = URLRequest(url: URL(string: "https://securetoken.googleapis.com/v1/token?key=\(config.apiKey)")!)
            request.httpMethod = "POST"
            request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
            let encoded = refresh.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? refresh
            request.httpBody = "grant_type=refresh_token&refresh_token=\(encoded)".data(using: .utf8)
            if let json = await send(request),
               let token = json["id_token"] as? String,
               let newRefresh = json["refresh_token"] as? String {
                save(token: token, refresh: newRefresh, expiresIn: json["expires_in"])
                return token
            }
        }
        var request = URLRequest(url: URL(string: "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=\(config.apiKey)")!)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = #"{"returnSecureToken":true}"#.data(using: .utf8)
        guard let json = await send(request),
              let token = json["idToken"] as? String,
              let refresh = json["refreshToken"] as? String else { return nil }
        save(token: token, refresh: refresh, expiresIn: json["expiresIn"])
        return token
    }

    private static func save(token: String, refresh: String, expiresIn: Any?) {
        let seconds = (expiresIn as? String).flatMap(Double.init) ?? (expiresIn as? Double) ?? 3600
        defaults?.set(token, forKey: idTokenKey)
        defaults?.set(refresh, forKey: refreshTokenKey)
        defaults?.set(Date().addingTimeInterval(seconds), forKey: idTokenExpiryKey)
    }

    /// 성공(200)일 때만 JSON을 돌려준다.
    private static func send(_ request: URLRequest) async -> [String: Any]? {
        var request = request
        request.setValue(appBundleID, forHTTPHeaderField: "X-Ios-Bundle-Identifier")
        request.timeoutInterval = 15
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    /// 오류 응답도 JSON으로 돌려준다 (토큰 정리용).
    private static func sendJSON(_ request: URLRequest) async -> [String: Any]? {
        guard let (data, _) = try? await URLSession.shared.data(for: request) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }
}

/// 앱 번들에 든 GoogleService-Info.plist를 읽는다. 위젯은 앱의 PlugIns 폴더 안에 있다.
private struct FirebaseConfig {
    let apiKey: String
    let projectID: String

    static func load() -> FirebaseConfig? {
        let appURL = Bundle.main.bundleURL.deletingLastPathComponent().deletingLastPathComponent()
        let candidates = [
            appURL.appendingPathComponent("GoogleService-Info.plist"),
            Bundle.main.bundleURL.appendingPathComponent("GoogleService-Info.plist"),
        ]
        for url in candidates {
            if let dict = NSDictionary(contentsOf: url),
               let apiKey = dict["API_KEY"] as? String,
               let projectID = dict["PROJECT_ID"] as? String {
                return FirebaseConfig(apiKey: apiKey, projectID: projectID)
            }
        }
        return nil
    }
}
