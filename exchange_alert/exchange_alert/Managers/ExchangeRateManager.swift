import Foundation
import SwiftUI
import UserNotifications
import FirebaseFirestore

// MARK: - Exchange Rate Manager
class ExchangeRateManager: ObservableObject {
    @Published var exchangeRates: [CurrencyType: ExchangeRate] = [:]
    @Published var selectedCurrency: CurrencyType = .USD
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var currencyAlertSettings = CurrencyAlertSettings()
    @Published var currentApiSource: String = "은행 고시 환율 (실시간)"
    @Published var lastUpdateTime: Date?
    @Published var isWeekendMode: Bool = false  // 주말 모드 표시
    
    // 일일 변동 데이터 저장
    @Published var dailyChanges: [CurrencyType: DailyChange] = [:]
    @Published var isDailyChangeLoading: Bool = true  // 일일 변동 로딩 상태
    
    // 전일 데이터 저장 (변동 계산용)
    private var previousDayData: [CurrencyType: ExchangeRate] = [:]
    
    // API 호출 제한 관리 (GitHub API 사용으로 제한 완화)
    private let maxDailyAPICalls = 1000  // GitHub API는 제한이 관대함
    private var dailyAPICallCount = 0
    private var lastAPICallDate: Date?
    private let apiCallInterval: TimeInterval = 60 // 60초마다 최대 1회 호출 (성능 최적화)
    
    // 동시성 안전성을 위한 UI 업데이트 큐
    private let uiUpdateQueue = DispatchQueue.main
    
    private var timer: Timer?
    
    var currentRate: ExchangeRate? {
        return exchangeRates[selectedCurrency]
    }
    
    var currentAlertSettings: AlertSettings {
        // 무한 루프를 방지하기 위해 비변경 방식으로 접근
        if let existingSettings = currencyAlertSettings.settings[selectedCurrency] {
            return existingSettings
        } else {
            return AlertSettings.default
        }
    }
    
    init() {
        loadSettings()
        loadAPICallCount() // API 호출 횟수 로드
        
        // 토큰이 업데이트되었을 때 알려달라고 설정
        NotificationCenter.default.addObserver(self, selector: #selector(tokenDidUpdate), name: Notification.Name("FCMTokenUpdated"), object: nil)
        
        // 앱 시작 시 전일 데이터 초기화 (GitHub에서 정확한 데이터 로드하기 위해)
        previousDayData = [:]
        print("🔄 앱 시작 - 전일 데이터 초기화 (GitHub에서 정확한 데이터 로드 예정)")
        
        // 앱 시작 시 강제 즉시 환율 가져오기 (Task 사용 - 메모리 누수 방지)
        Task { [weak self] in
            await MainActor.run {
                self?.forceRefreshOnStartup()
            }
        }
        
        startPeriodicRefresh() // 5분마다 자동 새로고침 (API 호출 제한 고려)
    }
    
    @objc private func tokenDidUpdate() {
        print("🔔 토큰 업데이트 감지 - 클라우드 동기화 재시도")
        syncSettingsToCloud()
    }
    
    deinit {
        timer?.invalidate()
    }
    
    // MARK: - API 호출 제한 체크
    private func canMakeAPICall() -> Bool {
        let now = Date()
        
        // 날짜가 바뀌었으면 카운트 리셋
        if let lastCallDate = lastAPICallDate {
            let calendar = Calendar.current
            if !calendar.isDate(lastCallDate, inSameDayAs: now) {
                dailyAPICallCount = 0
                lastAPICallDate = nil
            }
        }
        
        // 일일 호출 제한 체크
        if dailyAPICallCount >= maxDailyAPICalls {
            print("⚠️ 일일 API 호출 제한 도달: \(dailyAPICallCount)/\(maxDailyAPICalls)")
            return false
        }
        
        // 호출 간격 체크 (1분마다 최대 1회)
        if let lastCall = lastAPICallDate {
            let timeSinceLastCall = now.timeIntervalSince(lastCall)
            if timeSinceLastCall < apiCallInterval {
                print("⚠️ API 호출 간격 제한: \(Int(apiCallInterval - timeSinceLastCall))초 후 재시도 가능")
                return false
            }
        }
        
        return true
    }
    
    private func recordAPICall() {
        dailyAPICallCount += 1
        lastAPICallDate = Date()
        saveAPICallCount() // API 호출 횟수 저장
        print("📊 API 호출 기록: \(dailyAPICallCount)/\(maxDailyAPICalls)")
    }
    
    // MARK: - API 호출 횟수 관리
    private func loadAPICallCount() {
        dailyAPICallCount = UserDefaults.standard.integer(forKey: "DailyAPICallCount")
        lastAPICallDate = UserDefaults.standard.object(forKey: "LastAPICallDate") as? Date
        
        // 날짜가 바뀌었으면 카운트 리셋
        if let lastCallDate = lastAPICallDate {
            let calendar = Calendar.current
            if !calendar.isDate(lastCallDate, inSameDayAs: Date()) {
                dailyAPICallCount = 0
                lastAPICallDate = nil
                saveAPICallCount()
            }
        }
        
        print("📊 로드된 API 호출 횟수: \(dailyAPICallCount)/\(maxDailyAPICalls)")
    }
    
    private func saveAPICallCount() {
        UserDefaults.standard.set(dailyAPICallCount, forKey: "DailyAPICallCount")
        UserDefaults.standard.set(lastAPICallDate, forKey: "LastAPICallDate")
    }
    
    // MARK: - 로컬 데이터 저장 및 로드 시스템 (개선된 검증 로직)
    private func loadPreviousDayData() {
        // 1. 먼저 로컬에 저장된 전일 데이터 확인
        if let data = UserDefaults.standard.data(forKey: "PreviousDayExchangeRates"),
           let previousRates = try? JSONDecoder().decode([CurrencyType: ExchangeRate].self, from: data),
           let savedDate = UserDefaults.standard.object(forKey: "PreviousDayDataDate") as? Date {
            
            let calendar = Calendar.current
            let yesterday = calendar.date(byAdding: .day, value: -1, to: Date()) ?? Date()
            
            // 저장된 날짜가 어제와 같은 날인지 확인
            if calendar.isDate(savedDate, inSameDayAs: yesterday) {
                previousDayData = previousRates
                print("✅ 로컬 전일 데이터 로드 성공: \(previousRates.count)개 통화 (날짜 검증 완료)")
                return
            } else {
                print("⚠️ 로컬 전일 데이터 날짜 불일치 (저장: \(savedDate), 필요: \(yesterday)) - GitHub에서 재로드 필요")
            }
        } else {
            print("⚠️ 로컬 전일 데이터 없음 또는 날짜 정보 없음")
        }
        
        // 2. 로컬 데이터 검증 실패 시 기존 로직 유지
        if let data = UserDefaults.standard.data(forKey: "PreviousDayExchangeRates"),
           let previousRates = try? JSONDecoder().decode([CurrencyType: ExchangeRate].self, from: data) {
            previousDayData = previousRates
            print("📊 로컬 전일 데이터 로드 (날짜 미검증): \(previousRates.count)개 통화")
            
            // 날짜 확인 - 저장된 데이터가 실제 전일 데이터인지 검증
            if let savedDate = UserDefaults.standard.object(forKey: "PreviousDayDataDate") as? Date {
                let calendar = Calendar.current
                let yesterday = calendar.date(byAdding: .day, value: -1, to: Date()) ?? Date()
                
                if calendar.isDate(savedDate, inSameDayAs: yesterday) {
                    print("✅ 로컬 전일 데이터 유효: \(savedDate)")
                    return
                } else {
                    print("⚠️ 로컬 전일 데이터 만료: \(savedDate) (어제: \(yesterday))")
                    previousDayData = [:]
                }
            }
        } else {
            print("📊 로컬 전일 데이터 없음")
            previousDayData = [:]
        }
        
        // 2. 로컬 데이터가 없거나 만료된 경우 GitHub에서 로드
        if previousDayData.isEmpty {
            print("📥 GitHub에서 전일 데이터 로드 시도...")
            loadPreviousDayFromGitHub()
        }
        
        // 날짜가 바뀌었는지 확인하고 필요시 초기화
        checkAndResetDailyData()
    }
    
    // MARK: - 일일 데이터 초기화 체크
    private func checkAndResetDailyData() {
        let calendar = Calendar.current
        let today = Date()
        
        // 마지막 업데이트 날짜 확인
        if let lastUpdate = lastUpdateTime {
            if !calendar.isDate(lastUpdate, inSameDayAs: today) {
                print("📅 날짜 변경 감지 - 일일 변동 데이터 초기화")
                // 새로운 날이 시작되면 이전 데이터를 기준으로 설정
                if !exchangeRates.isEmpty {
                    previousDayData = exchangeRates
                    savePreviousDayData()
                    dailyChanges = [:] // 일일 변동 초기화
                }
            }
        }
    }
    
    
    
    private func savePreviousDayData() {
        if let data = try? JSONEncoder().encode(previousDayData) {
            UserDefaults.standard.set(data, forKey: "PreviousDayExchangeRates")
            
            // 전일 데이터 저장 날짜도 함께 저장 (데이터 유효성 검증용)
            let calendar = Calendar.current
            let yesterday = calendar.date(byAdding: .day, value: -1, to: Date()) ?? Date()
            UserDefaults.standard.set(yesterday, forKey: "PreviousDayDataDate")
            
            print("💾 전일 데이터 저장 완료: \(previousDayData.count)개 통화 (날짜: \(yesterday))")
        }
    }
    
    // MARK: - 개선된 로컬 데이터 저장 시스템
    private func saveExchangeRatesToLocal(_ rates: [CurrencyType: ExchangeRate]) {
        // 1. 현재 데이터를 메인 저장소에 저장
        if let data = try? JSONEncoder().encode(rates) {
            UserDefaults.standard.set(data, forKey: "LastExchangeRates")
            UserDefaults.standard.set(Date(), forKey: "LastUpdateTime")
            print("💾 현재 환율 데이터 로컬 저장: \(rates.count)개 통화")
        }
        
        // 2. 날짜별 백업 저장 (히스토리 관리) - 전일 데이터 저장과 구분
        let today = Date()
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMdd"
        let todayString = dateFormatter.string(from: today)
        
        if let backupData = try? JSONEncoder().encode(rates) {
            UserDefaults.standard.set(backupData, forKey: "ExchangeRates_\(todayString)")
            print("📅 날짜별 백업 저장: \(todayString)")
        }
        
        // 3. 주간 백업 (7일치 유지)
        self.manageWeeklyBackup(rates)
    }
    
    private func manageWeeklyBackup(_ rates: [CurrencyType: ExchangeRate]) {
        let calendar = Calendar.current
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMdd"
        
        // 7일 전 데이터 삭제 (용량 관리)
        for i in 7...14 {
            if let oldDate = calendar.date(byAdding: .day, value: -i, to: Date()) {
                let oldDateString = dateFormatter.string(from: oldDate)
                UserDefaults.standard.removeObject(forKey: "ExchangeRates_\(oldDateString)")
            }
        }
        
        print("🗑️ 오래된 백업 데이터 정리 완료 (7일 이상)")
    }
    
    // MARK: - API 호출
    func fetchExchangeRate(forceRefresh: Bool = false) {
        // 데이터 로딩 시작 - 일일 변동 로딩 상태 활성화
        isDailyChangeLoading = true
        
        // 강제 새로고침이 아닌 경우에만 API 호출 제한 체크
        if !forceRefresh {
            guard canMakeAPICall() else {
                print("🔄 API 호출 제한으로 인해 마지막 저장된 데이터 사용")
                currentApiSource = "은행 고시 환율 (실시간)"
                showLastSavedData()
                return
            }
        } else {
            print("🚀 강제 즉시 업데이트 모드 - API 호출 제한 무시")
        }
        
        // 메인 큐에서 UI 업데이트 수행
        DispatchQueue.main.async {
            self.isLoading = true
            self.errorMessage = nil
            self.currentApiSource = "은행 고시 환율 (실시간)"
        }

        // 1순위: GitHub에서 저장된 네이버(하나은행) 실시간 데이터 사용
        print("🌐 GitHub에서 네이버 은행 고시 환율 데이터 조회")
        recordAPICall() // API 호출 기록
        fetchFromGitHubAPI()
        
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
    
    
    // MARK: - ExchangeRate-API 호출 (사용 안함)
    /*
    private func fetchFromExchangeRateAPI() {
        print("🌐 ExchangeRate-API 호출: \(exchangeRateAPIURL)")
        
        // 백업 API 호출 시에도 일일 변동 로딩 상태 활성화
        isDailyChangeLoading = true
        
        guard let url = URL(string: exchangeRateAPIURL) else {
            DispatchQueue.main.async {
                self.errorMessage = "잘못된 URL입니다."
                self.isLoading = false
            }
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
                            
                            // JPY, IDR의 경우 100배를 곱해서 표시 (100단위 = X원) - 수출입은행 API 지원 통화만
                            if currency == .JPY || currency == .IDR {
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
    */
    
    // MARK: - 주말/공휴일 체크
    private func isWeekendOrHoliday() -> Bool {
        let calendar = Calendar.current
        let today = Date()
        let weekday = calendar.component(.weekday, from: today)
        
        // 일요일(1) 또는 토요일(7)인 경우
        if weekday == 1 || weekday == 7 {
            return true
        }
        
        // 한국 공휴일 체크 (간단한 버전)
        let formatter = DateFormatter()
        formatter.dateFormat = "MM-dd"
        let todayString = formatter.string(from: today)
        
        // 주요 공휴일 (2024년 기준)
        let holidays = [
            "01-01", // 신정
            "02-09", "02-10", "02-11", "02-12", // 설날 연휴
            "03-01", // 삼일절
            "04-10", // 국회의원선거
            "05-05", // 어린이날
            "05-15", // 부처님오신날
            "06-06", // 현충일
            "08-15", // 광복절
            "09-16", "09-17", "09-18", // 추석 연휴
            "10-03", // 개천절
            "10-09", // 한글날
            "12-25"  // 성탄절
        ]
        
        return holidays.contains(todayString)
    }
    
    // MARK: - GitHub API 호출
    private func fetchFromGitHubAPI() {
        // 주말 체크 및 주말 모드 설정
        let isWeekend = isWeekendOrHoliday()
        DispatchQueue.main.async {
            self.isWeekendMode = isWeekend
        }
        
        // GitHub Raw URL 사용 (실제 데이터)
        let githubURL = "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json"
        print("📥 GitHub API 호출: \(githubURL)")
        
        if isWeekend {
            print("📅 주말 감지 - 주말 모드 활성화")
        }

        guard let url = URL(string: githubURL) else {
            print("❌ GitHub API 잘못된 URL: \(githubURL) - 오프라인 모드로 전환")
            currentApiSource = "오프라인 모드"
            showLastSavedData()
            return
        }

        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                
                self.isLoading = false

                if let error = error {
                    print("❌ GitHub API 네트워크 오류: \(error.localizedDescription) - 마지막 저장된 데이터 사용")
                    self.currentApiSource = "은행 고시 환율 (실시간)"
                    self.showLastSavedData()
                    return
                }

                guard let data = data else {
                    print("❌ GitHub API 데이터 없음 - 마지막 저장된 데이터 사용")
                    self.currentApiSource = "은행 고시 환율 (실시간)"
                    self.showLastSavedData()
                    return
                }

                // 응답 데이터 로깅
                if let jsonString = String(data: data, encoding: .utf8) {
                    print("📦 GitHub API 응답: \(jsonString.prefix(500))")
                }

                self.parseExchangeRates(data)
                
                // GitHub에서 실제 데이터 기준 시간 로드
                self.fetchGitHubLastUpdateTime()
            }
        }.resume()
    }
    
    // MARK: - GitHub 마지막 업데이트 시간 로드
    private func fetchGitHubLastUpdateTime() {
        let lastUpdateURL = "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/last-update.txt"
        print("📥 GitHub 마지막 업데이트 시간 로드: \(lastUpdateURL)")
        
        guard let url = URL(string: lastUpdateURL) else {
            print("❌ GitHub last-update.txt URL 오류")
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            if let error = error {
                print("❌ GitHub last-update.txt 네트워크 오류: \(error.localizedDescription)")
                return
            }
            
            guard let data = data,
                  let timeString = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) else {
                print("❌ GitHub last-update.txt 데이터 파싱 실패")
                return
            }
            
            // ISO 8601 형식 파싱 (예: 2025-09-29T08:30:00+09:00)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            
            if let githubUpdateTime = formatter.date(from: timeString) {
                DispatchQueue.main.async {
                    self?.lastUpdateTime = githubUpdateTime
                    print("✅ GitHub 데이터 기준 시간 설정: \(timeString) -> \(githubUpdateTime)")
                }
            } else {
                // ISO 8601 파싱 실패 시 다른 형식 시도
                let fallbackFormatter = DateFormatter()
                fallbackFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
                fallbackFormatter.timeZone = TimeZone(identifier: "Asia/Seoul")
                
                if let fallbackTime = fallbackFormatter.date(from: timeString) {
                    DispatchQueue.main.async { [weak self] in
                        self?.lastUpdateTime = fallbackTime
                        print("✅ GitHub 데이터 기준 시간 설정 (fallback): \(timeString) -> \(fallbackTime)")
                    }
                } else {
                    print("❌ GitHub last-update.txt 시간 형식 파싱 실패: \(timeString)")
                    // 파싱 실패 시 현재 시간 사용
                    DispatchQueue.main.async {
                        self?.lastUpdateTime = Date()
                        print("⚠️ 현재 시간을 fallback으로 사용: \(Date())")
                    }
                }
            }
        }.resume()
    }

    // MARK: - 로컬 데이터 기반 오프라인 모드
    private func showLastSavedData() {
        print("📱 오프라인 모드: 로컬 저장된 데이터 로드 시도...")
        
        // 로컬 데이터 로드 시에도 일일 변동 로딩 상태 활성화
        isDailyChangeLoading = true
        
        // 1. 최신 로컬 데이터 로드
        if let data = UserDefaults.standard.data(forKey: "LastExchangeRates"),
           let lastRates = try? JSONDecoder().decode([CurrencyType: ExchangeRate].self, from: data) {
            print("📁 로컬 저장된 데이터 로드: \(lastRates.count)개 통화")
            
            // 데이터 유효성 확인
            if let lastUpdateTime = UserDefaults.standard.object(forKey: "LastUpdateTime") as? Date {
                let timeDiff = Date().timeIntervalSince(lastUpdateTime)
                if timeDiff > 3600 { // 1시간 이상 오래된 데이터
                    print("⚠️ 로컬 데이터 오래됨: \(Int(timeDiff/3600))시간 전")
                } else {
                    print("✅ 로컬 데이터 최신: \(Int(timeDiff/60))분 전")
                }
            }
            
            // 현재 데이터로 변동 계산 (메인 큐 밖에서 수행)
            let calculatedChanges = self.calculateDailyChangesSync(newRates: lastRates)
            
            // 메인 큐에서 UI 업데이트 수행
            DispatchQueue.main.async { [weak self] in
                self?.dailyChanges = calculatedChanges
                self?.isDailyChangeLoading = false  // 로딩 완료
                self?.exchangeRates = lastRates
                self?.lastUpdateTime = UserDefaults.standard.object(forKey: "LastUpdateTime") as? Date ?? Date()
                self?.currentApiSource = "로컬 저장된 데이터 (오프라인)"
                
                // 현재 선택된 통화의 환율이 있으면 알림 체크
                if let currentCurrency = self?.selectedCurrency,
                   let currentRate = lastRates[currentCurrency] {
                    self?.checkAlertThresholds(rate: currentRate)
                }
                
                print("✅ 오프라인 모드 활성화 완료")
            }
        } else {
            print("❌ 로컬 저장된 데이터 없음 - 오프라인 모드로 전환")
            DispatchQueue.main.async {
                self.currentApiSource = "오프라인 모드"
                self.isDailyChangeLoading = false  // 데이터 없음 - 로딩 중단
            }
        }
    }
    
    // MARK: - 공통 데이터 파싱 함수
    private func parseExchangeRates(_ data: Data) {
        // 응답 데이터 로깅
        if let jsonString = String(data: data, encoding: .utf8) {
            print("📦 API 응답: \(jsonString.prefix(500))")
        }

        do {
            let rates = try JSONDecoder().decode([ExchangeRate].self, from: data)
            print("✅ 데이터 파싱 성공: \(rates.count)개 통화")

            var newRates: [CurrencyType: ExchangeRate] = [:]
            for rate in rates {
                if let curUnit = rate.curUnit {
                    // 100단위로 제공되는 통화들 처리 (JPY(100), IDR(100))
                    let currencyCode: String
                    if curUnit == "JPY(100)" {
                        currencyCode = "JPY"
                    } else if curUnit == "IDR(100)" {
                        currencyCode = "IDR"
                    } else {
                        currencyCode = curUnit
                    }
                    
                    if let currencyType = CurrencyType(rawValue: currencyCode) {
                        newRates[currencyType] = rate
                        print("💱 \(currencyCode) 매매기준율: \(rate.dealBasR ?? "N/A")원 (원본단위: \(curUnit))")
                    }
                }
            }

            // 메인 큐에서 UI 업데이트 수행 (동시성 안전성 보장)
            self.uiUpdateQueue.async { [weak self] in
                guard let self = self else { return }
                // 전일 데이터가 없으면 먼저 GitHub에서 전일 데이터 로드 (비동기)
                if self.previousDayData.isEmpty {
                    print("⚠️ 전일 데이터 없음 - GitHub에서 전일 데이터 로드 후 계산")
                    self.loadPreviousDayFromGitHub()
                    // loadPreviousDayFromGitHub()가 완료되면 내부에서 재계산됨
                } else {
                    // 전일 데이터가 있으면 즉시 계산
                    let calculatedChanges = self.calculateDailyChangesSync(newRates: newRates)
                    self.dailyChanges = calculatedChanges
                    self.isDailyChangeLoading = false  // 로딩 완료
                    print("✅ 일일 변동 계산 완료 (전일 데이터 존재)")
                }
                
                // 날짜 변경 체크 후 이전 데이터 저장
                self.checkAndResetDailyData()
                
                // 날짜가 바뀌었을 때만 previousDayData 업데이트 (같은 날짜 내 덮어쓰기 방지)
                let calendar = Calendar.current
                let today = Date()
                if let lastUpdate = self.lastUpdateTime {
                    if !calendar.isDate(lastUpdate, inSameDayAs: today) {
                        // 날짜가 바뀌었을 때만 이전 데이터로 설정
                        self.previousDayData = self.exchangeRates
                        self.savePreviousDayData()
                        print("📅 날짜 변경 감지 - previousDayData 업데이트")
                    } else {
                        print("📅 같은 날짜 - previousDayData 유지 (일일변동 계산 정확성 보장)")
                    }
                }
                
                self.exchangeRates = newRates
                // lastUpdateTime은 GitHub에서 별도로 로드됨
            }
            
            // 성공적으로 데이터를 가져왔을 때 로컬에 저장 (오프라인 백업용)
            if !newRates.isEmpty {
                self.saveExchangeRatesToLocal(newRates)
            }

            // 현재 선택된 통화의 환율이 있으면 알림 체크 (매매기준율 기준)
            if let currentRate = newRates[self.selectedCurrency] {
                self.checkAlertThresholds(rate: currentRate)
            }

            if newRates.isEmpty {
                print("❌ 환율 정보 없음 - 마지막 저장된 데이터 사용")
                self.currentApiSource = "은행 고시 환율 (실시간)"
                self.showLastSavedData()
            } else {
                print("✅ \(newRates.count)개 통화 환율 로드 완료")
            }
        } catch {
            print("❌ 데이터 파싱 오류: \(error.localizedDescription) - 오프라인 모드로 전환")
            DispatchQueue.main.async {
                self.currentApiSource = "오프라인 모드"
                self.isDailyChangeLoading = false  // 파싱 오류 시에도 로딩 중단
            }
        }
    }

    // MARK: - Korea Exim Bank API 호출 (사용 안함)
    /*
    private func fetchFromKoreaEximAPI() {
        // 주말인 경우 캐시된 평일 데이터 사용
        if isWeekendOrHoliday() {
            if !weekdayLastData.isEmpty {
                print("📅 주말 감지 - 캐시된 평일 데이터 사용")
                
                // 메인 큐에서 UI 업데이트 수행
                DispatchQueue.main.async {
                    self.exchangeRates = self.weekdayLastData
                    self.lastUpdateTime = self.lastWeekdayDate // 마지막 평일 날짜 사용
                    self.currentApiSource = "은행 고시 환율 (캐시)"
                }
                
                print("✅ 캐시된 평일 데이터 \(weekdayLastData.count)개 통화 로드 완료")
                
                // 현재 선택된 통화의 환율이 있으면 알림 체크
                if let currentRate = weekdayLastData[self.selectedCurrency] {
                    self.checkAlertThresholds(rate: currentRate)
                }
            } else {
                print("📅 주말 감지 - 캐시된 데이터 없음, 오프라인 모드로 전환")
                self.currentApiSource = "오프라인 모드"
            }
            return
        }
        
        let urlString = "\(baseURL)?authkey=\(apiKey)&data=AP01"
        print("🌐 Korea Exim Bank API 호출 (현재 미사용): \(urlString)")
        
        guard let url = URL(string: urlString) else {
            print("❌ 한국수출입은행 API 잘못된 URL: \(urlString) - ExchangeRate-API로 백업 시도")
            DispatchQueue.main.async {
                self.currentApiSource = "오프라인 모드"
            }
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let error = error {
                    print("❌ 한국수출입은행 API 네트워크 오류: \(error.localizedDescription) - 오프라인 모드로 전환")
                    self?.currentApiSource = "오프라인 모드"
                    return
                }
                
                guard let data = data else {
                    print("❌ 한국수출입은행 API 데이터 없음 - 오프라인 모드로 전환")
                    self?.currentApiSource = "오프라인 모드"
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
                        // 100단위로 제공되는 통화들 처리 (수출입은행 API 지원)
                        let searchUnit: String
                        if currency == .JPY || currency == .IDR {
                            searchUnit = "\(currency.rawValue)(100)"
                        } else {
                            searchUnit = currency.rawValue
                        }
                        
                        if let rate = rates.first(where: { $0.curUnit == searchUnit }) {
                            newRates[currency] = rate
                            print("💱 \(currency.rawValue) 매매기준율: \(rate.dealBasR ?? "N/A")원 (검색단위: \(searchUnit))")
                            print("   - TTB (살 때): \(rate.ttb ?? "N/A")원")
                            print("   - TTS (팔 때): \(rate.tts ?? "N/A")원")
                        } else {
                            print("⚠️ \(currency.rawValue) 환율 데이터 없음 (검색단위: \(searchUnit))")
                        }
                    }
                    
                       self?.exchangeRates = newRates
                       // lastUpdateTime은 GitHub에서 별도로 로드됨
                       
                       // 데이터 저장 (불필요한 캐시 변수들 제거됨)
                       if !newRates.isEmpty {
                           print("💾 환율 데이터 처리 완료")
                       }
                       
                       // 현재 선택된 통화의 환율이 있으면 알림 체크 (매매기준율 기준)
                       if let currentRate = newRates[self?.selectedCurrency ?? .USD] {
                           self?.checkAlertThresholds(rate: currentRate)
                       }
                       
                       if newRates.isEmpty {
                           print("❌ 한국수출입은행 API에서 환율 정보 없음 - 오프라인 모드로 전환")
                           self?.currentApiSource = "오프라인 모드"
                       } else {
                           print("✅ 총 \(newRates.count)개 통화 환율 로드 완료 (매매기준율 기준)")
                       }
                } catch {
                    print("❌ 한국수출입은행 API 파싱 오류: \(error.localizedDescription) - 오프라인 모드로 전환")
                    self?.currentApiSource = "오프라인 모드"
                }
            }
        }.resume()
    }
    */
    
    // MARK: - 자동 새로고침
    private func startPeriodicRefresh() {
        // 2분마다 자동 새로고침 (GitHub API 사용으로 제한 완화)
        // GitHub API는 제한이 관대하므로 더 자주 업데이트 가능 (720회/일)
        timer = Timer.scheduledTimer(withTimeInterval: 120.0, repeats: true) { [weak self] _ in
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
        
        // 알림 활성화 상태는 기본적으로 허용
        
        let alertSettings = currencyAlertSettings.settings[currency] ?? AlertSettings.default
        guard alertSettings.isEnabled else { return }
        
        // 매매기준율(DEAL_BAS_R)을 기준으로 알림 체크
        guard let dealBasRString = rate.dealBasR,
              let dealBasR = Double(dealBasRString.replacingOccurrences(of: ",", with: "")) else {
            print("❌ 매매기준율 데이터 파싱 실패")
            return
        }
        
        let now = Date()
        
        // 마지막 알림 후 5분이 지났는지 확인 (스팸 방지)
        if let lastNotification = alertSettings.lastNotificationTime,
           now.timeIntervalSince(lastNotification) < 300 {
            print("⚠️ 스팸 방지: 마지막 알림 후 5분이 지나지 않음 (남은 시간: \(Int(300 - now.timeIntervalSince(lastNotification)))초)")
            return
        }
        
        print("🔔 알림 체크 [\(currency.rawValue)] - 매매기준율: \(dealBasR)원")
        print("   - 기준값: \(alertSettings.threshold)원")
        print("   - 알림 타입: \(alertSettings.thresholdType.rawValue)")
        print("   - 알림 활성화: \(alertSettings.isEnabled)")
        print("   - 마지막 알림 시간: \(alertSettings.lastNotificationTime?.description ?? "없음")")
        
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
        case .both3:
            // 기준값에서 3% 벗어날 때 알림
            let upperThreshold = alertSettings.threshold * 1.03  // 기준값의 103%
            let lowerThreshold = alertSettings.threshold * 0.97  // 기준값의 97%
            if dealBasR >= upperThreshold {
                shouldNotify = true
                message = "💰 \(rate.curNm ?? "통화") 매매기준율이 \(dealBasRString)원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원)에서 3% 상승했습니다!"
            } else if dealBasR <= lowerThreshold {
                shouldNotify = true
                message = "💸 \(rate.curNm ?? "통화") 매매기준율이 \(dealBasRString)원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원)에서 3% 하락했습니다!"
            }
        case .both:
            // 기준값에서 5% 벗어날 때 알림
            let upperThreshold = alertSettings.threshold * 1.05  // 기준값의 105%
            let lowerThreshold = alertSettings.threshold * 0.95  // 기준값의 95%
            if dealBasR >= upperThreshold {
                shouldNotify = true
                message = "💰 \(rate.curNm ?? "통화") 매매기준율이 \(dealBasRString)원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원)에서 5% 상승했습니다!"
            } else if dealBasR <= lowerThreshold {
                shouldNotify = true
                message = "💸 \(rate.curNm ?? "통화") 매매기준율이 \(dealBasRString)원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원)에서 5% 하락했습니다!"
            }
        }
        
        if shouldNotify {
            sendNotification(message: message)
            print("✅ 환율 알림 발송 완료")
            
            // 해당 통화의 마지막 알림 시간 업데이트
            var updatedSettings = alertSettings
            updatedSettings.lastNotificationTime = now
            currencyAlertSettings.updateSettings(for: currency, newSettings: updatedSettings)
            saveSettings()
            
            // 알림 히스토리에 기록 (UI에는 표시)
            addNotificationHistory(message: message)
        }
    }
    
    // MARK: - 알림 전송
    private func sendNotification(message: String) {
        // 알림 권한 상태 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                    print("❌ 알림 권한이 없어서 환율 알림을 발송할 수 없습니다.")
                    return
                }
                
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
                        print("❌ 환율 알림 전송 실패: \(error.localizedDescription)")
                    } else {
                        print("✅ 환율 알림이 전송되었습니다.")
                        // 히스토리에 성공 메시지 추가
                        NotificationManager.shared.addNotificationToHistory(
                            currency: "EXCHANGE",
                            message: message,
                            type: .alert
                        )
                    }
                }
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
            
            // Cloud(Firestore)와 동기화
            syncSettingsToCloud()
        }
    }
    
    func syncSettingsToCloud() {
        // 1. FCM 토큰 확인 (실제 기기에서 푸시 수신을 위해 필수)
        guard let fcmToken = UserDefaults.standard.string(forKey: "FCMToken") else {
            print("⚠️ [Firestore] FCM 토큰이 없습니다. 동기화를 중단합니다.")
            return
        }
        
        let db = Firestore.firestore()
        let batch = db.batch()
        
        print("📡 [Firestore] 클라우드 동기화 시작... (ID: \(fcmToken.prefix(8))...)")

        for (currency, settings) in currencyAlertSettings.settings {
            let docId = "\(fcmToken)_\(currency.rawValue)"
            let docRef = db.collection("alerts").document(docId)
            
            if settings.isEnabled {
                batch.setData([
                    "token": fcmToken,
                    "currency": currency.rawValue,
                    "threshold": settings.threshold,
                    "thresholdType": settings.thresholdType.rawValue,
                    "isEnabled": settings.isEnabled,
                    "updatedAt": FieldValue.serverTimestamp()
                ], forDocument: docRef)
            } else {
                batch.deleteDocument(docRef)
            }
        }
        
        batch.commit { error in
            if let error = error {
                print("❌ [Firestore] 저장 실패: \(error.localizedDescription)")
            } else {
                print("✅ [Firestore] 클라우드 동기화 성공!")
            }
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
    
    // MARK: - 강제 즉시 새로고침 (앱 시작/포그라운드 복귀 시)
    func forceRefreshOnStartup() {
        print("🚀 앱 시작/포그라운드 복귀 - 강제 즉시 업데이트")
        fetchExchangeRate(forceRefresh: true)
    }
    
    // MARK: - Pull-to-Refresh 전용 새로고침
    func pullToRefresh() {
        print("🔄 Pull-to-Refresh: 사용자가 직접 요청한 데이터 새로고침")
        fetchExchangeRate(forceRefresh: true)
    }
    
    // MARK: - 통화 변경 시 새로고침
    func changeCurrency(to currency: CurrencyType) {
        selectedCurrency = currency
        
        // 현재 선택된 통화의 데이터가 없으면 새로고침
        if exchangeRates[currency] == nil {
            fetchExchangeRate()
        }
    }
    
    // MARK: - 알림 테스트 함수
    func testNotification() {
        print("🧪 알림 테스트 시작")
        
        // 현재 선택된 통화의 알림 설정 가져오기
        let alertSettings = currencyAlertSettings.settings[selectedCurrency] ?? AlertSettings.default
        
        if !alertSettings.isEnabled {
            print("❌ 알림이 비활성화되어 있습니다. 먼저 알림을 활성화해주세요.")
            return
        }
        
        // 테스트용 환율 데이터 생성 (알림 타입에 따라 다른 변동률 적용)
        let testMultiplier: Double
        switch alertSettings.thresholdType {
        case .both3:
            testMultiplier = 1.04 // 4% 상승 (3% 변동 테스트)
        case .both:
            testMultiplier = 1.06 // 6% 상승 (5% 변동 테스트)
        default:
            testMultiplier = 1.05 // 기본 5% 상승
        }
        
        let testRate = ExchangeRate(
            result: 1,
            curUnit: selectedCurrency.rawValue,
            curNm: selectedCurrency.displayName,
            ttb: String(format: "%.2f", alertSettings.threshold * (testMultiplier + 0.01)), // TTB는 조금 더 높게
            tts: String(format: "%.2f", alertSettings.threshold * (testMultiplier - 0.01)), // TTS는 조금 더 낮게
            dealBasR: String(format: "%.2f", alertSettings.threshold * testMultiplier), // 매매기준율
            bkpr: String(format: "%.2f", alertSettings.threshold * (testMultiplier - 0.02)),
            yyEfeeR: "0.0",
            tenDdEfeeR: "0.0",
            kftcBkpr: String(format: "%.2f", alertSettings.threshold * (testMultiplier - 0.02)),
            kftcDealBasR: String(format: "%.2f", alertSettings.threshold * testMultiplier)
        )
        
        print("🧪 테스트 데이터:")
        print("   - 기준값: \(alertSettings.threshold)원")
        print("   - 테스트 환율: \(testRate.dealBasR ?? "N/A")원")
        print("   - 알림 타입: \(alertSettings.thresholdType.rawValue)")
        
        // 알림 체크 실행
        checkAlertThresholds(rate: testRate)
        
        print("🧪 알림 테스트 완료")
    }
    
    // MARK: - 일일 변동 계산 (동기 버전) - 개선된 로컬 데이터 기반
    private func calculateDailyChangesSync(newRates: [CurrencyType: ExchangeRate]) -> [CurrencyType: DailyChange] {
        var changes: [CurrencyType: DailyChange] = [:]
        
        // 1. 전일 데이터가 없으면 로컬 저장소에서 로드 시도
        if previousDayData.isEmpty {
            print("⚠️ 전일 데이터 없음 - 로컬 저장소에서 로드 시도...")
            loadPreviousDayData()
            
            // 로컬 로드 후에도 없으면 빈 결과 반환 (비동기 로드 완료 후 재계산)
            if previousDayData.isEmpty {
                print("⚠️ 전일 데이터 로드 실패 - GitHub에서 비동기 로드 예정")
                return changes
            }
        }
        
        print("📊 전일 데이터 확인: \(previousDayData.count)개 통화")
        
        for (currency, newRate) in newRates {
            if let currentValue = getDealBasRValue(from: newRate),
               let previousRate = previousDayData[currency],
               let previousValue = getDealBasRValue(from: previousRate) {
                
                let changeValue = currentValue - previousValue
                let changePercent = (changeValue / previousValue) * 100
                
                changes[currency] = DailyChange(
                    changeValue: changeValue,
                    changePercent: changePercent,
                    previousValue: previousValue,
                    currentValue: currentValue
                )
                
                print("📊 \(currency.rawValue) 일일변동 계산:")
                print("   - 현재 매매기준율: \(currentValue)원")
                print("   - 전일 매매기준율: \(previousValue)원")
                print("   - 변동액: \(changeValue >= 0 ? "+" : "")\(String(format: "%.2f", changeValue))원")
                print("   - 변동률: \(changePercent >= 0 ? "+" : "")\(String(format: "%.2f", changePercent))%")
                print("   - 계산식: (\(currentValue) - \(previousValue)) / \(previousValue) * 100")
            } else {
                print("⚠️ \(currency.rawValue) 전일 데이터 없음 - 변동 계산 불가 [현재데이터: \(newRate.dealBasR ?? "N/A"), 전일데이터: \(previousDayData[currency]?.dealBasR ?? "N/A")]")
            }
        }
        
        return changes
    }
    
    
    // MARK: - GitHub에서 전일 데이터 로드 (주말/공휴일 고려)
    private func loadPreviousDayFromGitHub(attempt: Int = 0) {
        if attempt > 5 {
            print("❌ GitHub 전일 데이터 로드 최종 실패 (5일치 시도)")
            DispatchQueue.main.async { [weak self] in
                self?.isDailyChangeLoading = false
            }
            return
        }
        
        let calendar = Calendar.current
        let today = Date()
        
        // 시도 횟수에 따라 타겟 날짜 계산
        var targetDate: Date
        if attempt == 0 {
            // 초기 시도: 주말/월요일 로직 적용
            let todayWeekday = calendar.component(.weekday, from: today)
            if todayWeekday == 1 { // 일요일이면 금요일 데이터
                targetDate = calendar.date(byAdding: .day, value: -2, to: today) ?? today
            } else if todayWeekday == 7 { // 토요일이면 금요일 데이터
                targetDate = calendar.date(byAdding: .day, value: -1, to: today) ?? today
            } else if todayWeekday == 2 { // 월요일이면 금요일 데이터
                targetDate = calendar.date(byAdding: .day, value: -3, to: today) ?? today
            } else {
                targetDate = calendar.date(byAdding: .day, value: -1, to: today) ?? today
            }
        } else {
            // 이전 데이터 찾기 시도: 단순히 1일씩 더 뒤로
            targetDate = calendar.date(byAdding: .day, value: -(attempt + 1), to: today) ?? today
        }
        
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let dateString = dateFormatter.string(from: targetDate)
        
        // 우선순위 1: data/daily (기본)
        let githubURL = "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/daily/exchange-rates-\(dateString).json"
        
        print("📥 GitHub 데이터 로드 시도 (\(attempt+1)회차): \(dateString)")
        
        guard let url = URL(string: githubURL) else { return }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 404 {
                print("⚠️ \(dateString) 데이터가 daily에 없음 (404) -> history 확인 또는 이전 날짜 시도")
                // history 폴더도 한 번 더 시도
                self?.loadFromHistoryFallback(dateString: dateString, attempt: attempt)
                return
            }
            
            guard let data = data,
                  let rates = try? JSONDecoder().decode([ExchangeRate].self, from: data) else {
                print("⚠️ \(dateString) 데이터 파싱 실패 -> 이전 날짜 시도")
                self?.loadPreviousDayFromGitHub(attempt: attempt + 1)
                return
            }
            
            self?.processPreviousDayData(rates: rates, dateString: dateString)
        }.resume()
    }
    
    private func loadFromHistoryFallback(dateString: String, attempt: Int) {
        let historyURL = "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/history/exchange-rates-\(dateString).json"
        guard let url = URL(string: historyURL) else { return }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 404 {
                print("⚠️ \(dateString) 데이터가 history에도 없음 -> 이전 날짜 시도")
                self?.loadPreviousDayFromGitHub(attempt: attempt + 1)
                return
            }
            
            guard let data = data,
                  let rates = try? JSONDecoder().decode([ExchangeRate].self, from: data) else {
                self?.loadPreviousDayFromGitHub(attempt: attempt + 1)
                return
            }
            
            self?.processPreviousDayData(rates: rates, dateString: dateString)
        }.resume()
    }
    
    private func processPreviousDayData(rates: [ExchangeRate], dateString: String) {
        var previousRates: [CurrencyType: ExchangeRate] = [:]
        for rate in rates {
            if let currencyType = CurrencyType(rawValue: rate.curUnit ?? "") {
                previousRates[currencyType] = rate
            }
        }
        
        DispatchQueue.main.async { [weak self] in
            self?.previousDayData = previousRates
            self?.savePreviousDayData()
            print("✅ GitHub 데이터 로드 완료: \(dateString) (\(previousRates.count)개)")
            
            if let currentRates = self?.exchangeRates, !currentRates.isEmpty {
                let recalculatedChanges = self?.calculateDailyChangesSync(newRates: currentRates) ?? [:]
                self?.dailyChanges = recalculatedChanges
                self?.isDailyChangeLoading = false
                print("🔄 \(dateString) 기준으로 일일변동 재계산 완료")
            }
        }
    }
    
    private func getDealBasRValue(from rate: ExchangeRate) -> Double? {
        guard let dealBasR = rate.dealBasR else { return nil }
        let cleanedRate = dealBasR.replacingOccurrences(of: ",", with: "")
        return Double(cleanedRate)
    }
    
    // MARK: - Notification History Helper
    private func addNotificationHistory(message: String) {
        NotificationManager.shared.addNotificationToHistory(
            currency: selectedCurrency.rawValue,
            message: message,
            type: .alert
        )
    }
}
