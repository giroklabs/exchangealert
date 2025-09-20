import Foundation
import SwiftUI
import UserNotifications

// MARK: - Exchange Rate Manager
class ExchangeRateManager: ObservableObject {
    @Published var exchangeRates: [CurrencyType: ExchangeRate] = [:]
    @Published var selectedCurrency: CurrencyType = .USD
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currencyAlertSettings = CurrencyAlertSettings()
    
    private let apiKey = "cTcUsZGSUum0cSXCpxNdb3TouiJNxSLW"
    private let baseURL = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON"
    private let exchangeRateAPIURL = "https://api.exchangerate-api.com/v4/latest/KRW"
    private var timer: Timer?
    
    var currentRate: ExchangeRate? {
        return exchangeRates[selectedCurrency]
    }
    
    var currentAlertSettings: AlertSettings {
        return currencyAlertSettings.getSettings(for: selectedCurrency)
    }
    
    init() {
        loadSettings()
        fetchExchangeRate() // 앱 시작 시 즉시 환율 가져오기
        startPeriodicRefresh() // 5초마다 자동 새로고침
    }
    
    deinit {
        timer?.invalidate()
    }
    
    // MARK: - API 호출
    func fetchExchangeRate() {
        isLoading = true
        errorMessage = nil
        
        // ExchangeRate-API 사용 (무료, 인증키 불필요)
        fetchFromExchangeRateAPI()
        
        // 실제 API 호출 (주석 처리)
        /*
        let urlString = "\(baseURL)?authkey=\(apiKey)&data=AP01"
        print("🌐 API 호출: \(urlString)")
        
        guard let url = URL(string: urlString) else {
            errorMessage = "잘못된 URL입니다."
            isLoading = false
            print("❌ 잘못된 URL: \(urlString)")
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let error = error {
                    self?.errorMessage = "네트워크 오류: \(error.localizedDescription)"
                    print("❌ 네트워크 오류: \(error.localizedDescription)")
                    return
                }
                
                guard let data = data else {
                    self?.errorMessage = "데이터를 받을 수 없습니다."
                    print("❌ 데이터 없음")
                    return
                }
                
                // 응답 데이터 로깅
                if let jsonString = String(data: data, encoding: .utf8) {
                    print("📦 API 응답: \(jsonString.prefix(500))")
                }
                
                do {
                    let rates = try JSONDecoder().decode([ExchangeRate].self, from: data)
                    print("✅ 파싱된 환율 개수: \(rates.count)")
                    
                    // 모든 주요 통화 환율 저장
                    var newRates: [CurrencyType: ExchangeRate] = [:]
                    
                    for currency in CurrencyType.allCases {
                        if let rate = rates.first(where: { $0.curUnit == currency.rawValue }) {
                            newRates[currency] = rate
                            print("💱 \(currency.rawValue) 환율: \(rate.dealBasR ?? "N/A")")
                        } else {
                            print("⚠️ \(currency.rawValue) 환율 데이터 없음")
                        }
                    }
                    
                    self?.exchangeRates = newRates
                    
                    // 현재 선택된 통화의 환율이 있으면 알림 체크
                    if let currentRate = newRates[self?.selectedCurrency ?? .USD] {
                        self?.checkAlertThresholds(rate: currentRate)
                    }
                    
                    if newRates.isEmpty {
                        self?.errorMessage = "환율 정보를 찾을 수 없습니다."
                        print("❌ 환율 정보 없음")
                    } else {
                        print("✅ 총 \(newRates.count)개 통화 환율 로드 완료")
                    }
                } catch {
                    self?.errorMessage = "데이터 파싱 오류: \(error.localizedDescription)"
                    print("❌ 파싱 오류: \(error.localizedDescription)")
                }
            }
        }.resume()
        */
    }
    
    
    // MARK: - ExchangeRate-API 호출
    private func fetchFromExchangeRateAPI() {
        print("🌐 ExchangeRate-API 호출: \(exchangeRateAPIURL)")
        
        guard let url = URL(string: exchangeRateAPIURL) else {
            errorMessage = "잘못된 URL입니다."
            isLoading = false
            print("❌ 잘못된 URL: \(exchangeRateAPIURL)")
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let error = error {
                    self?.errorMessage = "네트워크 오류: \(error.localizedDescription)"
                    print("❌ 네트워크 오류: \(error.localizedDescription)")
                    return
                }
                
                guard let data = data else {
                    self?.errorMessage = "데이터를 받을 수 없습니다."
                    print("❌ 데이터 없음")
                    return
                }
                
                // 응답 데이터 로깅
                if let jsonString = String(data: data, encoding: .utf8) {
                    print("📦 API 응답: \(jsonString.prefix(500))")
                }
                
                do {
                    let exchangeData = try JSONDecoder().decode(ExchangeRateAPIResponse.self, from: data)
                    print("✅ ExchangeRate-API 응답 파싱 성공")
                    
                    var newRates: [CurrencyType: ExchangeRate] = [:]
                    
                    // KRW 기준 환율을 각 통화별로 변환 (원화 기준으로 표시)
                    for currency in CurrencyType.allCases {
                        if let rate = exchangeData.rates[currency.rawValue] {
                            // KRW 기준 환율을 원화 기준으로 변환 (1/rate)
                            // 예: USD = 0.00074 → 1/0.00074 = 1351.35원
                            var krwRate = 1.0 / rate
                            
                            // JPY의 경우 100배를 곱해서 표시 (100엔 = X원)
                            if currency == .JPY {
                                krwRate = krwRate * 100
                            }
                            
                            let formattedRate = String(format: "%.2f", krwRate)
                            
                            let exchangeRate = ExchangeRate(
                                result: 1,
                                curUnit: currency.rawValue,
                                curNm: currency.displayName,
                                ttb: String(format: "%.2f", krwRate * 0.995), // 매도율 (약간 낮게)
                                tts: String(format: "%.2f", krwRate * 1.005), // 매입율 (약간 높게)
                                dealBasR: formattedRate, // 매매기준율
                                bkpr: formattedRate,
                                yyEfeeR: nil,
                                tenDdEfeeR: nil,
                                kftcBkpr: nil,
                                kftcDealBasR: nil
                            )
                            newRates[currency] = exchangeRate
                            
                            if currency == .JPY {
                                print("💱 \(currency.rawValue) 원화 기준 환율: \(formattedRate)원 (100\(currency.rawValue) = \(formattedRate)원)")
                            } else {
                                print("💱 \(currency.rawValue) 원화 기준 환율: \(formattedRate)원 (1\(currency.rawValue) = \(formattedRate)원)")
                            }
                        } else {
                            print("⚠️ \(currency.rawValue) 환율 데이터 없음")
                        }
                    }
                    
                    self?.exchangeRates = newRates
                    
                    // 현재 선택된 통화의 환율이 있으면 알림 체크
                    if let currentRate = newRates[self?.selectedCurrency ?? .USD] {
                        self?.checkAlertThresholds(rate: currentRate)
                    }
                    
                    if newRates.isEmpty {
                        self?.errorMessage = "환율 정보를 찾을 수 없습니다."
                        print("❌ 환율 정보 없음")
                    } else {
                        print("✅ 총 \(newRates.count)개 통화 환율 로드 완료")
                    }
                } catch {
                    self?.errorMessage = "데이터 파싱 오류: \(error.localizedDescription)"
                    print("❌ 파싱 오류: \(error.localizedDescription)")
                }
            }
        }.resume()
    }
    
    // MARK: - 한국수출입은행 API 호출
    private func fetchFromKoreaEximAPI() {
        let urlString = "\(baseURL)?authkey=\(apiKey)&data=AP01"
        print("🌐 한국수출입은행 API 호출: \(urlString)")
        
        guard let url = URL(string: urlString) else {
            errorMessage = "잘못된 URL입니다."
            isLoading = false
            print("❌ 잘못된 URL: \(urlString)")
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let error = error {
                    self?.errorMessage = "네트워크 오류: \(error.localizedDescription)"
                    print("❌ 네트워크 오류: \(error.localizedDescription)")
                    return
                }
                
                guard let data = data else {
                    self?.errorMessage = "데이터를 받을 수 없습니다."
                    print("❌ 데이터 없음")
                    return
                }
                
                // 응답 데이터 로깅
                if let jsonString = String(data: data, encoding: .utf8) {
                    print("📦 한국수출입은행 API 응답: \(jsonString.prefix(500))")
                }
                
                do {
                    let rates = try JSONDecoder().decode([ExchangeRate].self, from: data)
                    print("✅ 한국수출입은행 API 파싱된 환율 개수: \(rates.count)")
                    
                    // 모든 주요 통화 환율 저장 (매매기준율 기준)
                    var newRates: [CurrencyType: ExchangeRate] = [:]
                    
                    for currency in CurrencyType.allCases {
                        if let rate = rates.first(where: { $0.curUnit == currency.rawValue }) {
                            newRates[currency] = rate
                            print("💱 \(currency.rawValue) 매매기준율: \(rate.dealBasR ?? "N/A")원")
                            print("   - TTB (살 때): \(rate.ttb ?? "N/A")원")
                            print("   - TTS (팔 때): \(rate.tts ?? "N/A")원")
                        } else {
                            print("⚠️ \(currency.rawValue) 환율 데이터 없음")
                        }
                    }
                    
                    self?.exchangeRates = newRates
                    
                    // 현재 선택된 통화의 환율이 있으면 알림 체크 (매매기준율 기준)
                    if let currentRate = newRates[self?.selectedCurrency ?? .USD] {
                        self?.checkAlertThresholds(rate: currentRate)
                    }
                    
                    if newRates.isEmpty {
                        self?.errorMessage = "환율 정보를 찾을 수 없습니다."
                        print("❌ 환율 정보 없음")
                    } else {
                        print("✅ 총 \(newRates.count)개 통화 환율 로드 완료 (매매기준율 기준)")
                    }
                } catch {
                    self?.errorMessage = "데이터 파싱 오류: \(error.localizedDescription)"
                    print("❌ 파싱 오류: \(error.localizedDescription)")
                }
            }
        }.resume()
    }
    
    // MARK: - 자동 새로고침
    private func startPeriodicRefresh() {
        // 5초마다 자동 새로고침
        timer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.fetchExchangeRate()
        }
    }
    
    // MARK: - 알림 체크 (매매기준율 기준)
    private func checkAlertThresholds(rate: ExchangeRate) {
        guard let currencyCode = rate.curUnit,
              let currency = CurrencyType(rawValue: currencyCode) else {
            print("❌ 통화 코드를 찾을 수 없습니다: \(rate.curUnit ?? "Unknown")")
            return
        }
        
        let alertSettings = currencyAlertSettings.getSettings(for: currency)
        guard alertSettings.isEnabled else { return }
        
        // 매매기준율(DEAL_BAS_R)을 기준으로 알림 체크
        guard let dealBasRString = rate.dealBasR,
              let dealBasR = Double(dealBasRString.replacingOccurrences(of: ",", with: "")) else {
            print("❌ 매매기준율 데이터 파싱 실패")
            return
        }
        
        let now = Date()
        
        // 마지막 알림 후 1시간이 지났는지 확인 (스팸 방지)
        if let lastNotification = alertSettings.lastNotificationDate,
           now.timeIntervalSince(lastNotification) < 3600 {
            return
        }
        
        print("🔔 알림 체크 [\(currency.rawValue)] - 매매기준율: \(dealBasR)원")
        print("   - 기준값: \(alertSettings.threshold)원")
        print("   - 알림 타입: \(alertSettings.thresholdType.rawValue)")
        
        var shouldNotify = false
        var message = ""
        
        switch alertSettings.thresholdType {
        case .upper:
            if dealBasR >= alertSettings.threshold {
                shouldNotify = true
                message = "💰 \(rate.curNm ?? "통화") 매매기준율이 \(dealBasRString)원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원) 이상이 되었습니다!"
            }
        case .lower:
            if dealBasR <= alertSettings.threshold {
                shouldNotify = true
                message = "💸 \(rate.curNm ?? "통화") 매매기준율이 \(dealBasRString)원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원) 이하로 떨어졌습니다!"
            }
        case .both:
            let upperThreshold = alertSettings.threshold + 100
            let lowerThreshold = alertSettings.threshold - 100
            if dealBasR >= upperThreshold {
                shouldNotify = true
                message = "💰 \(rate.curNm ?? "통화") 매매기준율이 \(dealBasRString)원으로 상한선(\(String(format: "%.0f", upperThreshold))원)을 초과했습니다!"
            } else if dealBasR <= lowerThreshold {
                shouldNotify = true
                message = "💸 \(rate.curNm ?? "통화") 매매기준율이 \(dealBasRString)원으로 하한선(\(String(format: "%.0f", lowerThreshold))원) 이하로 떨어졌습니다!"
            }
        }
        
        if shouldNotify {
            sendNotification(message: message)
            // 해당 통화의 마지막 알림 시간 업데이트
            var updatedSettings = alertSettings
            updatedSettings.lastNotificationDate = now
            currencyAlertSettings.updateSettings(for: currency, newSettings: updatedSettings)
            saveSettings()
        }
    }
    
    // MARK: - 알림 전송
    private func sendNotification(message: String) {
        let content = UNMutableNotificationContent()
        content.title = "💱 환율 알림"
        content.body = message
        content.sound = .default
        content.badge = 1
        
        let request = UNNotificationRequest(
            identifier: "exchange_alert_\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ 알림 전송 실패: \(error.localizedDescription)")
            } else {
                print("✅ 환율 알림이 전송되었습니다.")
            }
        }
    }
    
    // MARK: - 설정 관리
    func updateAlertSettings(_ newSettings: AlertSettings, for currency: CurrencyType? = nil) {
        let targetCurrency = currency ?? selectedCurrency
        currencyAlertSettings.updateSettings(for: targetCurrency, newSettings: newSettings)
        saveSettings()
    }
    
    private func saveSettings() {
        if let data = try? JSONEncoder().encode(currencyAlertSettings) {
            UserDefaults.standard.set(data, forKey: "CurrencyAlertSettings")
        }
    }
    
    private func loadSettings() {
        if let data = UserDefaults.standard.data(forKey: "CurrencyAlertSettings"),
           let settings = try? JSONDecoder().decode(CurrencyAlertSettings.self, from: data) {
            currencyAlertSettings = settings
        }
    }
    
    // MARK: - 수동 새로고침
    func refresh() {
        fetchExchangeRate()
    }
    
    // MARK: - 통화 변경 시 새로고침
    func changeCurrency(to currency: CurrencyType) {
        selectedCurrency = currency
        // 현재 선택된 통화의 데이터가 없으면 새로고침
        if exchangeRates[currency] == nil {
            fetchExchangeRate()
        }
    }
}
