import Foundation
import SwiftUI
import UserNotifications

// MARK: - Exchange Rate Manager
class ExchangeRateManager: ObservableObject {
    @Published var exchangeRates: [CurrencyType: ExchangeRate] = [:]
    @Published var selectedCurrency: CurrencyType = .USD
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var alertSettings = AlertSettings.default
    
    private let apiKey = "cTcUsZGSUum0cSXCpxNdb3TouiJNxSLW"
    private let baseURL = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON"
    private var timer: Timer?
    
    var currentRate: ExchangeRate? {
        return exchangeRates[selectedCurrency]
    }
    
    init() {
        loadSettings()
        startPeriodicCheck()
    }
    
    deinit {
        timer?.invalidate()
    }
    
    // MARK: - API 호출
    func fetchExchangeRate() {
        isLoading = true
        errorMessage = nil
        
        let urlString = "\(baseURL)?authkey=\(apiKey)&data=AP01"
        
        guard let url = URL(string: urlString) else {
            errorMessage = "잘못된 URL입니다."
            isLoading = false
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let error = error {
                    self?.errorMessage = "네트워크 오류: \(error.localizedDescription)"
                    return
                }
                
                guard let data = data else {
                    self?.errorMessage = "데이터를 받을 수 없습니다."
                    return
                }
                
                do {
                    let rates = try JSONDecoder().decode([ExchangeRate].self, from: data)
                    
                    // 모든 주요 통화 환율 저장
                    var newRates: [CurrencyType: ExchangeRate] = [:]
                    
                    for currency in CurrencyType.allCases {
                        if let rate = rates.first(where: { $0.curUnit == currency.rawValue }) {
                            newRates[currency] = rate
                        }
                    }
                    
                    self?.exchangeRates = newRates
                    
                    // 선택된 통화의 환율이 있으면 알림 체크
                    if let selectedRate = newRates[self?.selectedCurrency ?? .USD] {
                        self?.checkAlertThresholds(rate: selectedRate)
                    }
                    
                    if newRates.isEmpty {
                        self?.errorMessage = "환율 정보를 찾을 수 없습니다."
                    }
                } catch {
                    self?.errorMessage = "데이터 파싱 오류: \(error.localizedDescription)"
                }
            }
        }.resume()
    }
    
    // MARK: - 주기적 체크
    private func startPeriodicCheck() {
        // 설정된 간격마다 체크
        timer = Timer.scheduledTimer(withTimeInterval: TimeInterval(alertSettings.checkInterval * 60), repeats: true) { [weak self] _ in
            self?.fetchExchangeRate()
        }
    }
    
    // MARK: - 알림 체크
    private func checkAlertThresholds(rate: ExchangeRate) {
        guard alertSettings.isEnabled,
              let currentRate = rate.usdKrwRate else { return }
        
        let now = Date()
        
        // 마지막 알림 후 1시간이 지났는지 확인 (스팸 방지)
        if let lastNotification = alertSettings.lastNotificationDate,
           now.timeIntervalSince(lastNotification) < 3600 {
            return
        }
        
        var shouldNotify = false
        var message = ""
        
        if currentRate >= alertSettings.upperThreshold {
            shouldNotify = true
            message = "💰 \(selectedCurrency.displayName)-원 환율이 \(String(format: "%.1f", currentRate))원으로 상한선(\(String(format: "%.0f", alertSettings.upperThreshold))원)을 초과했습니다!"
        } else if currentRate <= alertSettings.lowerThreshold {
            shouldNotify = true
            message = "💸 \(selectedCurrency.displayName)-원 환율이 \(String(format: "%.1f", currentRate))원으로 하한선(\(String(format: "%.0f", alertSettings.lowerThreshold))원) 이하로 떨어졌습니다!"
        }
        
        if shouldNotify {
            sendNotification(message: message)
            alertSettings.lastNotificationDate = now
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
    func updateAlertSettings(_ newSettings: AlertSettings) {
        alertSettings = newSettings
        saveSettings()
        
        // 타이머 재시작
        timer?.invalidate()
        startPeriodicCheck()
    }
    
    private func saveSettings() {
        if let data = try? JSONEncoder().encode(alertSettings) {
            UserDefaults.standard.set(data, forKey: "AlertSettings")
        }
    }
    
    private func loadSettings() {
        if let data = UserDefaults.standard.data(forKey: "AlertSettings"),
           let settings = try? JSONDecoder().decode(AlertSettings.self, from: data) {
            alertSettings = settings
        }
    }
    
    // MARK: - 수동 새로고침
    func refresh() {
        fetchExchangeRate()
    }
}
