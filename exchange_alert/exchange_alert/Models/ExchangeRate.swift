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
            // 기존 통화 (수출입은행 API 지원)
            case .USD:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 1300.0)
            case .EUR:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 1500.0)
            case .JPY:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 900.0)  // 100엔 기준
            // case .CNY:  // 수출입은행 API 미지원
            //     settings[currency] = AlertSettings(isEnabled: false, threshold: 190.0)
            case .GBP:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 1700.0)

            // 아시아 태평양 지역 (수출입은행 API 지원)
            case .AUD:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 900.0)
            case .SGD:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 1000.0)
            case .HKD:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 150.0)
            case .THB:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 35.0)
            // case .INR:  // 수출입은행 API 미지원
            //     settings[currency] = AlertSettings(isEnabled: false, threshold: 15.0)
            case .IDR:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 8.0)  // 100루피아 기준
            // case .VND:  // 수출입은행 API 미지원
            //     settings[currency] = AlertSettings(isEnabled: false, threshold: 0.05)  // 100동 기준
            // case .KHR:  // 수출입은행 API 미지원
            //     settings[currency] = AlertSettings(isEnabled: false, threshold: 0.025)  // 100리엘 기준

            // 유럽 지역 (수출입은행 API 지원)
            case .CHF:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 1200.0)
            case .SEK:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 120.0)
            case .NOK:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 130.0)
            case .DKK:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 200.0)
            // case .PLN:  // 수출입은행 API 미지원
            //     settings[currency] = AlertSettings(isEnabled: false, threshold: 320.0)

            // 아메리카 지역 (수출입은행 API 지원)
            case .CAD:
                settings[currency] = AlertSettings(isEnabled: false, threshold: 950.0)
            // case .MXN:  // 수출입은행 API 미지원
            //     settings[currency] = AlertSettings(isEnabled: false, threshold: 75.0)
            // case .BRL:  // 수출입은행 API 미지원
            //     settings[currency] = AlertSettings(isEnabled: false, threshold: 260.0)
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
    case both = "5% 변동"     // 기준값에서 5% 벗어날 때 알림
    
    var description: String {
        switch self {
        case .upper:
            return "기준값 이상일 때 알림"
        case .lower:
            return "기준값 이하일 때 알림"
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
    case JPY = "JPY"
    // case CNY = "CNY"  // 수출입은행 API 미지원 (CNH만 지원)
    case GBP = "GBP"

    // 아시아 태평양 지역 (수출입은행 API 지원)
    case AUD = "AUD"
    case SGD = "SGD"
    case HKD = "HKD"
    case THB = "THB"
    // case INR = "INR"  // 수출입은행 API 미지원
    case IDR = "IDR"
    // case VND = "VND"  // 수출입은행 API 미지원
    // case KHR = "KHR"  // 수출입은행 API 미지원

    // 유럽 지역 (수출입은행 API 지원)
    case CHF = "CHF"
    case SEK = "SEK"
    case NOK = "NOK"
    case DKK = "DKK"
    // case PLN = "PLN"  // 수출입은행 API 미지원

    // 아메리카 지역 (수출입은행 API 지원)
    case CAD = "CAD"
    // case MXN = "MXN"  // 수출입은행 API 미지원
    // case BRL = "BRL"  // 수출입은행 API 미지원

    var displayName: String {
        switch self {
        // 기존 통화 (수출입은행 API 지원)
        case .USD: return "미국 달러"
        case .EUR: return "유로"
        case .JPY: return "일본 엔"
        // case .CNY: return "중국 위안"  // 수출입은행 API 미지원
        case .GBP: return "영국 파운드"

        // 아시아 태평양 지역 (수출입은행 API 지원)
        case .AUD: return "호주 달러"
        case .SGD: return "싱가포르 달러"
        case .HKD: return "홍콩 달러"
        case .THB: return "태국 바트"
        // case .INR: return "인도 루피"  // 수출입은행 API 미지원
        case .IDR: return "인도네시아 루피아"
        // case .VND: return "베트남 동"  // 수출입은행 API 미지원
        // case .KHR: return "캄보디아 리엘"  // 수출입은행 API 미지원

        // 유럽 지역 (수출입은행 API 지원)
        case .CHF: return "스위스 프랑"
        case .SEK: return "스웨덴 크로나"
        case .NOK: return "노르웨이 크로네"
        case .DKK: return "덴마크 크로네"
        // case .PLN: return "폴란드 즐로티"  // 수출입은행 API 미지원

        // 아메리카 지역 (수출입은행 API 지원)
        case .CAD: return "캐나다 달러"
        // case .MXN: return "멕시코 페소"  // 수출입은행 API 미지원
        // case .BRL: return "브라질 헤알"  // 수출입은행 API 미지원
        }
    }

    var symbol: String {
        switch self {
        // 기존 통화 (수출입은행 API 지원)
        case .USD: return "$"
        case .EUR: return "€"
        case .JPY: return "¥"
        // case .CNY: return "元"  // 수출입은행 API 미지원
        case .GBP: return "£"

        // 아시아 태평양 지역 (수출입은행 API 지원)
        case .AUD: return "A$"
        case .SGD: return "S$"
        case .HKD: return "HK$"
        case .THB: return "฿"
        // case .INR: return "₹"  // 수출입은행 API 미지원
        case .IDR: return "Rp"
        // case .VND: return "₫"  // 수출입은행 API 미지원
        // case .KHR: return "៛"  // 수출입은행 API 미지원

        // 유럽 지역 (수출입은행 API 지원)
        case .CHF: return "CHF"
        case .SEK: return "kr"
        case .NOK: return "kr"
        case .DKK: return "kr"
        // case .PLN: return "zł"  // 수출입은행 API 미지원

        // 아메리카 지역 (수출입은행 API 지원)
        case .CAD: return "C$"
        // case .MXN: return "$"  // 수출입은행 API 미지원
        // case .BRL: return "R$"  // 수출입은행 API 미지원
        }
    }
}

// MARK: - ExchangeRate-API Response Model
struct ExchangeRateAPIResponse: Codable {
    let base: String
    let date: String
    let rates: [String: Double]
}
