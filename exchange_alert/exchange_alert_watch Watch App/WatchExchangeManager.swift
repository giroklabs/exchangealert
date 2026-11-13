import Foundation
import SwiftUI
import Combine

class WatchExchangeManager: ObservableObject {
    @Published var exchangeRates: [CurrencyType: ExchangeRate] = [:]
    @Published var isLoading = false
    @Published var lastUpdateTime: Date?
    /// 수출입은행 고시일 (환율 파일 META.rate_date). 있으면 시각 대신 이 날짜를 보여준다.
    @Published var rateNoticeDate: Date?
    @Published var dailyChanges: [CurrencyType: DailyChange] = [:]
    
    // 사용자가 설정한 통화 목록 (iOS와 연동되면 좋겠지만, 일단은 알림이 설정된 것들 위주로 표시하거나 상위 리스트)
    @Published var watchedCurrencies: [CurrencyType] = [.USD, .EUR, .JPY, .GBP, .CNH]
    
    private let githubURL = "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json"
    private let lastUpdateURL = "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/last-update.txt"
    private let suiteName = "group.com.giroklabs.exchangealert" // 앱 그룹 식별자
    
    init() {
        loadSettings()
        fetchExchangeRates()
        
        // 정기적인 동기화 시도 (AppGroup 데이터 변경 감지 등)
        NotificationCenter.default.addObserver(forName: UserDefaults.didChangeNotification, object: nil, queue: .main) { [weak self] _ in
            self?.loadSettings()
            self?.fetchExchangeRates() // 설정이 동기화될 때 환율 데이터도 즉시 새로고침
        }
    }
    
    func fetchExchangeRates() {
        guard !isLoading else { return }
        
        isLoading = true
        
        // 1. 환율 데이터 가져오기
        guard let url = URL(string: githubURL) else { return }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let data = data {
                    self?.parseExchangeRates(data)
                }
            }
        }.resume()
        
        // 2. 업데이트 시간 가져오기
        fetchLastUpdateTime()
    }
    
    private func fetchLastUpdateTime() {
        guard let url = URL(string: lastUpdateURL) else { return }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            if let data = data, let timeString = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) {
                let formatter = ISO8601DateFormatter()
                formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
                
                if let date = formatter.date(from: timeString) {
                    DispatchQueue.main.async {
                        self?.lastUpdateTime = date
                    }
                }
            }
        }.resume()
    }
    
    private func parseExchangeRates(_ data: Data) {
        if let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
           let meta = items.first(where: { $0["cur_unit"] as? String == "META" }),
           let text = meta["rate_date"] as? String {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
            formatter.dateFormat = "yyyy-MM-dd"
            rateNoticeDate = formatter.date(from: text)
        }

        do {
            let rates = try JSONDecoder().decode([ExchangeRate].self, from: data)
            var newRates: [CurrencyType: ExchangeRate] = [:]
            
            for rate in rates {
                if let curUnit = rate.curUnit {
                    let dataCode = curUnit.replacingOccurrences(of: "(100)", with: "")
                    let currencyCode = dataCode == "CNY" ? "CNH" : dataCode // 데이터는 위안화를 CNY로 제공
                    if let type = CurrencyType(rawValue: currencyCode) {
                        newRates[type] = rate
                    }
                }
            }
            
            self.exchangeRates = newRates
        } catch {
            print("Watch Parse Error: \(error)")
        }
    }
    
    private func loadSettings() {
        // 모든 변경 사항은 메인 스레드에서 안전하게 업데이트하여 SwiftUI 경고를 방지합니다.
        DispatchQueue.main.async {
            var mergedCurrencies: [CurrencyType] = []
            
            // 1. AppGroup(iOS) 설정을 확인
            if let userDefaults = UserDefaults(suiteName: self.suiteName) {
                if let data = userDefaults.data(forKey: "CurrencyAlertSettings") {
                    do {
                        let loadedSettings = try JSONDecoder().decode(CurrencyAlertSettings.self, from: data)
                        let enabledCurrencies = loadedSettings.settings
                            .filter { $0.value.isEnabled }
                            .sorted { $0.key.rawValue < $1.key.rawValue }
                            .map { $0.key }
                        mergedCurrencies = enabledCurrencies
                        print("⌚ [Watch] 아이폰 동기화 성공(\(enabledCurrencies.count)개): \(enabledCurrencies.map { $0.rawValue }.joined(separator: ", "))")
                    } catch {
                        print("⚠️ [Watch] 아이폰 데이터 파싱 실패: \(error)")
                    }
                } else {
                    print("⚠️ [Watch] 아이폰 저장소에 데이터가 없습니다. 아이폰 앱에서 알림 설정을 변경해 보세요.")
                }
            } else {
                print("⚠️ [Watch] AppGroup(\(self.suiteName)) 접근 실패. 프로젝트 설정의 App Groups을 확인하세요.")
            }

            // 2. 워치 로컬 설정이 있다면 병합
            if let savedCodes = UserDefaults.standard.stringArray(forKey: "WatchedCurrencyCodes") {
                let localCurrencies = savedCodes.compactMap { CurrencyType(rawValue: $0) }
                var addedLocally: [String] = []
                for local in localCurrencies {
                    if !mergedCurrencies.contains(local) {
                        mergedCurrencies.append(local)
                        addedLocally.append(local.rawValue)
                    }
                }
                if !addedLocally.isEmpty {
                    print("⌚ [Watch] 워치 개별 추가(\(addedLocally.count)개): \(addedLocally.joined(separator: ", "))")
                }
            }

            // 3. 데이터가 존재하는 경우에만 업데이트
            if !mergedCurrencies.isEmpty {
                self.watchedCurrencies = mergedCurrencies
                print("✅ [Watch] 최종 리스트: \(mergedCurrencies.map { $0.rawValue }.joined(separator: ", "))")
            }
        }
    }
    
    // 통화 표시 여부 토글
    func toggleCurrency(_ currency: CurrencyType) {
        if watchedCurrencies.contains(currency) {
            // 최소 1개는 남겨두도록 함
            if watchedCurrencies.count > 1 {
                watchedCurrencies.removeAll { $0 == currency }
            }
        } else {
            watchedCurrencies.append(currency)
        }
        saveLocalSettings()
    }
    
    private func saveLocalSettings() {
        let codes = watchedCurrencies.map { $0.rawValue }
        UserDefaults.standard.set(codes, forKey: "WatchedCurrencyCodes")
        print("💾 [Watch] 관심 통화 저장 완료")
    }
}
