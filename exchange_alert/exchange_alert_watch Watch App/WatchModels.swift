import Foundation

// MARK: - Exchange Rate Model
struct ExchangeRate: Codable, Identifiable {
    let id = UUID()
    let result: Int
    let curUnit: String?
    let curNm: String?
    let ttb: String?
    let tts: String?
    let dealBasR: String?
    let bkpr: String?
    let yyEfeeR: String?
    let tenDdEfeeR: String?
    let kftcBkpr: String?
    let kftcDealBasR: String?
    
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

// MARK: - Currency Types
enum CurrencyType: String, CaseIterable, Codable {
    case USD = "USD"
    case EUR = "EUR"
    case GBP = "GBP"
    case JPY = "JPY"
    case CNH = "CNH"
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
    case AED = "AED"
    case BHD = "BHD"
    case BND = "BND"
    case KWD = "KWD"
    case SAR = "SAR"
    
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
        }
    }
    
    var symbol: String {
        switch self {
        case .USD: return "$"
        case .EUR: return "€"
        case .GBP: return "£"
        case .JPY: return "¥"
        case .CNH: return "元"
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
        }
    }
}

// MARK: - Daily Change Model
struct DailyChange: Codable {
    let changeValue: Double
    let changePercent: Double
    let previousValue: Double
    let currentValue: Double
    
    var isPositive: Bool {
        return changeValue >= 0
    }
}

// MARK: - Alert Settings
struct AlertSettings: Codable {
    var isEnabled: Bool
    var threshold: Double
    var thresholdType: ThresholdType
    var lastNotificationTime: Date?
}

enum ThresholdType: String, CaseIterable, Codable {
    case upper = "상한선"
    case lower = "하한선"
    case both3 = "3% 변동"
    case both = "5% 변동"
}

struct CurrencyAlertSettings: Codable {
    var settings: [CurrencyType: AlertSettings] = [:]
}
