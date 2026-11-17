import Foundation
import FirebaseFirestore

/// 시장 환율(UniRateAPI, 장중 15분 갱신).
/// 서버가 Firestore `rates/live`에 두고, 로그인한 앱만 읽는다. 약관상 재배포 금지라 공개 파일에는 없다.
/// 문서가 없거나 오래됐으면 화면은 수출입은행 고시 환율을 그대로 쓴다.
struct MarketSnapshot {
    /// 데이터 표기 통화 코드(CNY 등) → 원화 환율. 엔화·루피아는 100단위.
    let rates: [String: Double]
    let fetchedAt: Date

    static let attribution = "Exchange Rates By UniRateAPI"
    static let attributionURL = URL(string: "https://unirateapi.com")!

    /// 장중에는 30분, 외환시장이 닫힌 주말에는 72시간(금요일 마감값) 이내만 쓴다. 서버 판정과 같은 기준.
    func isUsable(now: Date = Date()) -> Bool {
        guard rates["USD"] != nil else { return false }
        let minutes = now.timeIntervalSince(fetchedAt) / 60
        if minutes < -5 { return false }
        return Self.isFxMarketOpen(now) ? minutes <= 30 : minutes <= 72 * 60
    }

    /// 국제 외환시장: 일요일 21:00 ~ 금요일 22:00 (UTC)
    static func isFxMarketOpen(_ now: Date) -> Bool {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let weekday = calendar.component(.weekday, from: now) // 1=일, 7=토
        let hour = calendar.component(.hour, from: now)
        switch weekday {
        case 7: return false
        case 1: return hour >= 21
        case 6: return hour < 22
        default: return true
        }
    }

    init(rates: [String: Double], fetchedAt: Date) {
        self.rates = rates
        self.fetchedAt = fetchedAt
    }

    init?(data: [String: Any]) {
        guard let raw = data["rates"] as? [String: Any],
              let timestamp = data["fetchedAt"] as? Timestamp else { return nil }
        var parsed: [String: Double] = [:]
        for (code, value) in raw {
            if let number = value as? NSNumber { parsed[code] = number.doubleValue }
        }
        guard !parsed.isEmpty else { return nil }
        rates = parsed
        fetchedAt = timestamp.dateValue()
    }

    /// 고시 환율 위에 시장 환율을 덮는다. 시장 값이 없는 통화는 고시 그대로 둔다.
    /// 살때·팔때는 화면에서 기준값의 ±1.8%로 계산하도록 비워 둔다.
    func applied(to notice: [CurrencyType: ExchangeRate]) -> [CurrencyType: ExchangeRate] {
        var result = notice
        for (currency, rate) in notice {
            let dataCode = currency == .CNH ? "CNY" : currency.rawValue
            guard let value = rates[dataCode], value > 0 else { continue }
            result[currency] = ExchangeRate(
                result: rate.result,
                curUnit: rate.curUnit,
                curNm: rate.curNm,
                ttb: nil,
                tts: nil,
                dealBasR: String(format: "%.2f", value),
                bkpr: nil,
                yyEfeeR: nil,
                tenDdEfeeR: nil,
                kftcBkpr: nil,
                kftcDealBasR: nil
            )
        }
        return result
    }

    static func fetch(completion: @escaping (MarketSnapshot?) -> Void) {
        #if DEBUG
        // 화면 확인용: 실행 인자 -previewMarket이면 가짜 시장 환율을 쓴다.
        if ProcessInfo.processInfo.arguments.contains("-previewMarket") {
            completion(MarketSnapshot(rates: ["USD": 1335.46, "JPY": 836.92, "EUR": 1471.38, "CNY": 200.30], fetchedAt: Date().addingTimeInterval(-300)))
            return
        }
        #endif
        Firestore.firestore().collection("rates").document("live").getDocument { document, error in
            if let error {
                // 규칙 미배포·로그인 전·오프라인이면 여기로 온다. 고시 환율로 계속 동작한다.
                print("ℹ️ [시장 환율] 읽기 실패: \(error.localizedDescription)")
                completion(nil)
                return
            }
            completion(document?.data().flatMap(MarketSnapshot.init(data:)))
        }
    }
}
