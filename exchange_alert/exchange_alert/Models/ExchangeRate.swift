import Foundation

// MARK: - Exchange Rate Model
struct ExchangeRate: Codable, Identifiable {
    let id = UUID()
    let result: Int
    let curUnit: String?
    let curNm: String?
    let ttb: String?        // 전신환(송금) 받으실때
    let tts: String?        // 전신환(송금) 보내실때
    let dealBasR: String?   // 매매 기준율
    let bkpr: String?       // 장부가격
    let yyEfeeR: String?    // 년환가료율
    let tenDdEfeeR: String? // 10일환가료율
    let kftcBkpr: String?   // 서울외국환중개 장부가격
    let kftcDealBasR: String? // 서울외국환중개 매매기준율
    
    enum CodingKeys: String, CodingKey {
        case result
        case curUnit = "cur_unit"
        case curNm = "cur_nm"
        case ttb
        case tts
        case dealBasR = "deal_bas_r"
        case bkpr
        case yyEfeeR = "yy_efee_r"
        case tenDdEfeeR = "ten_dd_efee_r"
        case kftcBkpr = "kftc_bkpr"
        case kftcDealBasR = "kftc_deal_bas_r"
    }
    
    // USD/KRW 환율을 Double로 반환
    var usdKrwRate: Double? {
        guard let rateString = dealBasR else { return nil }
        return Double(rateString)
    }
    
    // 환율 상태 (상승/하락/보합)
    var trend: ExchangeTrend {
        // 실제로는 이전 데이터와 비교해야 하지만, 여기서는 간단히 처리
        return .stable
    }
}

// MARK: - Exchange Trend
enum ExchangeTrend: String, CaseIterable {
    case rising = "상승"
    case falling = "하락"
    case stable = "보합"
    
    var color: String {
        switch self {
        case .rising: return "red"
        case .falling: return "blue"
        case .stable: return "gray"
        }
    }
    
    var icon: String {
        switch self {
        case .rising: return "arrow.up.right"
        case .falling: return "arrow.down.right"
        case .stable: return "minus"
        }
    }
}

// MARK: - Alert Settings
struct AlertSettings: Codable, Equatable {
    var isEnabled: Bool = false  // 알림 기본값: 꺼짐
    var threshold: Double = 1300.0  // 알림 기준값 (원)
    var thresholdType: ThresholdType = .both  // 알림 타입
    var lastNotificationDate: Date? = nil
    
    static let `default` = AlertSettings()
}

// MARK: - Currency Alert Settings
struct CurrencyAlertSettings: Codable, Equatable {
    var settings: [CurrencyType: AlertSettings] = [:]
    
    init() {
        // 각 통화별로 기본 설정 초기화 (알림 기본값: 꺼짐)
        for currency in CurrencyType.allCases {
            switch currency {
            case .USD:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 1300.0)
            case .EUR:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 1500.0)
            case .JPY:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 900.0)  // 100엔 기준
            case .CNY:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 190.0)
            case .GBP:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 1700.0)
            }
        }
    }
    
    func getSettings(for currency: CurrencyType) -> AlertSettings {
        return settings[currency] ?? AlertSettings.default
    }
    
    mutating func updateSettings(for currency: CurrencyType, newSettings: AlertSettings) {
        settings[currency] = newSettings
    }
}

enum ThresholdType: String, CaseIterable, Codable {
    case upper = "상한선"     // 기준값 이상일 때 알림
    case lower = "하한선"     // 기준값 이하일 때 알림
    case both = "상하한선"    // 기준값에서 일정 범위 벗어날 때 알림
    
    var description: String {
        switch self {
        case .upper:
            return "기준값 이상일 때 알림"
        case .lower:
            return "기준값 이하일 때 알림"
        case .both:
            return "기준값에서 ±100원 벗어날 때 알림"
        }
    }
}

// MARK: - Currency Types
enum CurrencyType: String, CaseIterable, Codable {
    case USD = "USD"
    case EUR = "EUR"
    case JPY = "JPY"
    case CNY = "CNY"
    case GBP = "GBP"
    
    var displayName: String {
        switch self {
        case .USD: return "미국 달러"
        case .EUR: return "유로"
        case .JPY: return "일본 엔"
        case .CNY: return "중국 위안"
        case .GBP: return "영국 파운드"
        }
    }
    
    var symbol: String {
        switch self {
        case .USD: return "$"
        case .EUR: return "€"
        case .JPY: return "¥"
        case .CNY: return "元"
        case .GBP: return "£"
        }
    }
}

// MARK: - ExchangeRate-API Response Model
struct ExchangeRateAPIResponse: Codable {
    let base: String
    let date: String
    let rates: [String: Double]
}
