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
}

// MARK: - Alert Settings
struct AlertSettings: Codable {
    var isEnabled: Bool
    var threshold: Double
    var thresholdType: ThresholdType
    var lastNotificationTime: Date?
    
    static let `default` = AlertSettings(
        isEnabled: false,
        threshold: 1400.0,
        thresholdType: .upper,
        lastNotificationTime: nil
    )
}

struct CurrencyAlertSettings: Codable {
    var settings: [CurrencyType: AlertSettings] = [:]
    
    mutating func getSettings(for currency: CurrencyType) -> AlertSettings {
        if let existingSettings = settings[currency] {
            return existingSettings
        } else {
            let defaultSettings = AlertSettings.default
            settings[currency] = defaultSettings
            return defaultSettings
        }
    }
    
    mutating func updateSettings(for currency: CurrencyType, newSettings: AlertSettings) {
        settings[currency] = newSettings
    }
}

enum ThresholdType: String, CaseIterable, Codable {
    case upper = "상한선"     // 기준값 이상일 때 알림
    case lower = "하한선"     // 기준값 이하일 때 알림
    case both3 = "3% 변동"    // 기준값에서 3% 벗어날 때 알림
    case both = "5% 변동"     // 기준값에서 5% 벗어날 때 알림
    
    var description: String {
        switch self {
        case .upper:
            return "기준값 이상일 때 알림"
        case .lower:
            return "기준값 이하일 때 알림"
        case .both3:
            return "기준값에서 3% 벗어날 때 알림"
        case .both:
            return "기준값에서 5% 벗어날 때 알림"
        }
    }
}

// MARK: - Currency Types
enum CurrencyType: String, CaseIterable, Codable {
    // 기존 통화 (수출입은행 API 지원)
    case USD = "USD"
    case EUR = "EUR"
    case GBP = "GBP"
    case JPY = "JPY"
    case CNH = "CNH"  // 중국 위안화 (홍콩)
    case HKD = "HKD"
    case THB = "THB"
    case SGD = "SGD"
    case MYR = "MYR"
    case IDR = "IDR"
    case CHF = "CHF"
    case CAD = "CAD"
    case AUD = "AUD"
    case NZD = "NZD"
    case NOK = "NOK"
    case SEK = "SEK"
    case DKK = "DKK"
    
    // 추가 통화들 (수출입은행 API 지원)
    case AED = "AED"  // 아랍에미리트 디르함
    case BHD = "BHD"  // 바레인 디나르
    case BND = "BND"  // 브루나이 달러
    case KWD = "KWD"  // 쿠웨이트 디나르
    case SAR = "SAR"  // 사우디 리얄
    
    // 추가 요청된 통화들 (수출입은행 API 지원)
    case INR = "INR"  // 인도 루피
    case PLN = "PLN"  // 폴란드 즐로티
    
    var displayName: String {
        switch self {
        case .USD: return "미국달러"
        case .EUR: return "유로"
        case .GBP: return "영국파운드"
        case .JPY: return "일본엔"
        case .CNH: return "중국위안"
        case .HKD: return "홍콩달러"
        case .THB: return "태국바트"
        case .SGD: return "싱가포르달러"
        case .MYR: return "말레이시아링기트"
        case .IDR: return "인도네시아루피아"
        case .CHF: return "스위스프랑"
        case .CAD: return "캐나다달러"
        case .AUD: return "호주달러"
        case .NZD: return "뉴질랜드달러"
        case .NOK: return "노르웨이크로네"
        case .SEK: return "스웨덴크로나"
        case .DKK: return "덴마크크로네"
        case .AED: return "아랍에미리트디르함"
        case .BHD: return "바레인디나르"
        case .BND: return "브루나이달러"
        case .KWD: return "쿠웨이트디나르"
        case .SAR: return "사우디리얄"
        case .INR: return "인도루피"
        case .PLN: return "폴란드즐로티"
        }
    }
    
    var symbol: String {
        switch self {
        case .USD: return "$"
        case .EUR: return "€"
        case .GBP: return "£"
        case .JPY: return "¥"
        case .CNH: return "元"  // 중국 위안화는 元 사용
        case .HKD: return "HK$"
        case .THB: return "฿"
        case .SGD: return "S$"
        case .MYR: return "RM"
        case .IDR: return "Rp"
        case .CHF: return "CHF"
        case .CAD: return "C$"
        case .AUD: return "A$"
        case .NZD: return "NZ$"
        case .NOK: return "kr"
        case .SEK: return "kr"
        case .DKK: return "kr"
        case .AED: return "د.إ"
        case .BHD: return ".د.ب"
        case .BND: return "B$"
        case .KWD: return "د.ك"
        case .SAR: return "﷼"
        case .INR: return "₹"
        case .PLN: return "zł"
        }
    }
}

// MARK: - ExchangeRate-API Response Model
struct ExchangeRateAPIResponse: Codable {
    let base: String
    let date: String
    let rates: [String: Double]
}

// MARK: - Daily Change Model
struct DailyChange: Codable {
    let changeValue: Double        // 절대 변동값
    let changePercent: Double      // 변동률 (%)
    let previousValue: Double      // 이전 값
    let currentValue: Double       // 현재 값
    
    var isPositive: Bool {
        return changeValue >= 0
    }
    
    var changeValueString: String {
        let sign = isPositive ? "+" : ""
        return "\(sign)\(String(format: "%.2f", changeValue))"
    }
    
    var changePercentString: String {
        let sign = isPositive ? "+" : ""
        return "(\(sign)\(String(format: "%.2f", changePercent))%)"
    }
}