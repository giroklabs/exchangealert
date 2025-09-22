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
    @Published var currentApiSource: String = "ExchangeRate-API"
    @Published var lastUpdateTime: Date?
    
    // 일일 변동 데이터 저장
    @Published var dailyChanges: [CurrencyType: DailyChange] = [:]
    
    // 전일 데이터 저장 (변동 계산용)
    private var previousDayData: [CurrencyType: ExchangeRate] = [:]
    
    // 평일 마지막 데이터 캐시
    private var weekdayLastData: [CurrencyType: ExchangeRate] = [:]
    private var lastWeekdayUpdate: Date?
    
    // API 호출 제한 관리
    private let maxDailyAPICalls = 1000
    private var dailyAPICallCount = 0
    private var lastAPICallDate: Date?
    private let apiCallInterval: TimeInterval = 60 // 1분마다 최대 1회 호출
    
    private let apiKey = "cTcUsZGSUum0cSXCpxNdb3TouiJNxSLW"
    private let baseURL = "https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON"
    private let exchangeRateAPIURL = "https://api.exchangerate-api.com/v4/latest/KRW"
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
        loadPreviousDayData() // 이전 일자 데이터 로드 (변동값 계산용)
        
        // 앱 시작 시 환율 가져오기 (Task 사용)
        Task { @MainActor in
            self.fetchExchangeRate()
        }
        
        startPeriodicRefresh() // 5분마다 자동 새로고침 (API 호출 제한 고려)
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
    
    // MARK: - 이전 일자 데이터 로드 (변동값 계산용)
    private func loadPreviousDayData() {
        if let data = UserDefaults.standard.data(forKey: "PreviousDayExchangeRates"),
           let previousRates = try? JSONDecoder().decode([CurrencyType: ExchangeRate].self, from: data) {
            previousDayData = previousRates
            print("📊 이전 일자 데이터 로드: \(previousRates.count)개 통화")
        } else {
            print("📊 이전 일자 데이터 없음 - 테스트 데이터 생성")
            createTestPreviousDayData()
        }
    }
    
    // MARK: - 테스트용 이전 일자 데이터 생성
    private func createTestPreviousDayData() {
        var testRates: [CurrencyType: ExchangeRate] = [:]
        
        // 각 통화별로 어제 기준 임의의 환율 데이터 생성
        for currency in CurrencyType.allCases {
            let baseRate = getBaseRateForCurrency(currency)
            let randomVariation = Double.random(in: -50...50) // ±50원 범위에서 랜덤 변동
            let previousRate = baseRate + randomVariation
            
            let testExchangeRate = ExchangeRate(
                result: 1,
                curUnit: currency.rawValue,
                curNm: currency.displayName,
                ttb: String(format: "%.2f", previousRate - 15), // TTB (살때)
                tts: String(format: "%.2f", previousRate + 15), // TTS (팔때)
                dealBasR: String(format: "%.2f", previousRate), // 매매기준율
                bkpr: String(format: "%.2f", previousRate),
                yyEfeeR: "0.0",
                tenDdEfeeR: "0.0",
                kftcBkpr: String(format: "%.2f", previousRate),
                kftcDealBasR: String(format: "%.2f", previousRate)
            )
            
            testRates[currency] = testExchangeRate
        }
        
        previousDayData = testRates
        print("🧪 테스트 이전 일자 데이터 생성: \(testRates.count)개 통화")
        
        // 테스트 데이터를 UserDefaults에 저장
        savePreviousDayData()
    }
    
    // MARK: - 통화별 기준 환율 반환
    private func getBaseRateForCurrency(_ currency: CurrencyType) -> Double {
        switch currency {
        case .USD: return 1390.0
        case .EUR: return 1500.0
        case .JPY: return 9.5
        case .GBP: return 1750.0
        case .CNH: return 190.0  // 중국 위안화 (홍콩)
        case .AUD: return 900.0
        case .SGD: return 1000.0
        case .HKD: return 180.0
        case .THB: return 38.0
        // case .INR: return 16.5  // 수출입은행 API 미지원
        case .CHF: return 1550.0
        case .SEK: return 130.0
        case .NOK: return 130.0
        case .DKK: return 200.0
        // case .PLN: return 350.0  // 수출입은행 API 미지원
        case .CAD: return 1000.0
        case .IDR: return 0.09
        case .MYR: return 300.0  // 말레이시아 링깃
        case .NZD: return 800.0  // 뉴질랜드 달러
        case .AED: return 380.0  // 아랍에미리트 디르함
        case .BHD: return 3700.0 // 바레인 디나르
        case .BND: return 1000.0 // 브루나이 달러
        case .KWD: return 4500.0 // 쿠웨이트 디나르
        case .SAR: return 370.0  // 사우디 리얄
        }
    }
    
    private func savePreviousDayData() {
        if let data = try? JSONEncoder().encode(previousDayData) {
            UserDefaults.standard.set(data, forKey: "PreviousDayExchangeRates")
            print("💾 이전 일자 데이터 저장: \(previousDayData.count)개 통화")
        }
    }
    
    // MARK: - API 호출
    func fetchExchangeRate() {
        // API 호출 제한 체크
        guard canMakeAPICall() else {
            print("🔄 API 호출 제한으로 인해 마지막 저장된 데이터 사용")
            currentApiSource = "한국수출입은행"
            showLastSavedData()
            return
        }
        
        // 메인 큐에서 UI 업데이트 수행
        DispatchQueue.main.async {
            self.isLoading = true
            self.errorMessage = nil
            self.currentApiSource = "한국수출입은행"
        }

        // 1순위: GitHub에서 저장된 한국수출입은행 데이터 사용
        print("🌐 GitHub에서 한국수출입은행 데이터 조회")
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
    
    
    // MARK: - ExchangeRate-API 호출
    private func fetchFromExchangeRateAPI() {
        print("🌐 ExchangeRate-API 호출: \(exchangeRateAPIURL)")
        
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
        // GitHub Raw URL 사용 (실제 데이터)
        let githubURL = "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json"
        print("📥 GitHub API 호출: \(githubURL)")

        guard let url = URL(string: githubURL) else {
            print("❌ GitHub API 잘못된 URL: \(githubURL) - ExchangeRate-API로 백업")
            currentApiSource = "ExchangeRate-API"
            fetchFromExchangeRateAPI()
            return
        }

        URLSession.shared.dataTask(with: url) { [self] data, response, error in
            DispatchQueue.main.async {
                self.isLoading = false

                if let error = error {
                    print("❌ GitHub API 네트워크 오류: \(error.localizedDescription) - 마지막 저장된 데이터 사용")
                    self.currentApiSource = "한국수출입은행"
                    self.showLastSavedData()
                    return
                }

                guard let data = data else {
                    print("❌ GitHub API 데이터 없음 - 마지막 저장된 데이터 사용")
                    self.currentApiSource = "한국수출입은행"
                    self.showLastSavedData()
                    return
                }

                // 응답 데이터 로깅
                if let jsonString = String(data: data, encoding: .utf8) {
                    print("📦 GitHub API 응답: \(jsonString.prefix(500))")
                }

                self.parseExchangeRates(data)
            }
        }.resume()
    }

    // MARK: - 마지막 저장된 데이터 표시
    private func showLastSavedData() {
        // UserDefaults에서 마지막 저장된 환율 데이터 로드
        if let data = UserDefaults.standard.data(forKey: "LastExchangeRates"),
           let lastRates = try? JSONDecoder().decode([CurrencyType: ExchangeRate].self, from: data) {
            print("📁 마지막 저장된 데이터 로드: \(lastRates.count)개 통화")
            
            // 현재 데이터로 변동 계산 (메인 큐 밖에서 수행)
            let calculatedChanges = self.calculateDailyChangesSync(newRates: lastRates)
            
            // 메인 큐에서 UI 업데이트 수행
            DispatchQueue.main.async {
                self.dailyChanges = calculatedChanges
                self.previousDayData = self.exchangeRates // 현재 데이터를 이전 데이터로 저장
                self.exchangeRates = lastRates
                self.lastUpdateTime = UserDefaults.standard.object(forKey: "LastUpdateTime") as? Date ?? Date()
                
                // 현재 선택된 통화의 환율이 있으면 알림 체크
                if let currentRate = lastRates[self.selectedCurrency] {
                    self.checkAlertThresholds(rate: currentRate)
                }
            }
        } else {
            print("❌ 마지막 저장된 데이터 없음 - ExchangeRate-API로 백업")
            self.currentApiSource = "ExchangeRate-API"
            self.fetchFromExchangeRateAPI()
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

            // 현재 데이터로 변동 계산 (메인 큐 밖에서 수행)
            let calculatedChanges = self.calculateDailyChangesSync(newRates: newRates)
            
            // 메인 큐에서 UI 업데이트 수행 (SwiftUI 퍼블리싱 오류 방지)
            DispatchQueue.main.async {
                // 계산된 변동 데이터 업데이트
                self.dailyChanges = calculatedChanges
                
                // 현재 데이터를 이전 데이터로 저장
                self.previousDayData = self.exchangeRates
                self.savePreviousDayData() // 이전 일자 데이터 저장
                
                self.exchangeRates = newRates
                self.lastUpdateTime = Date()
            }
            
            // 성공적으로 데이터를 가져왔을 때 UserDefaults에 저장 (오프라인 백업용)
            if !newRates.isEmpty {
                if let data = try? JSONEncoder().encode(newRates) {
                    UserDefaults.standard.set(data, forKey: "LastExchangeRates")
                    UserDefaults.standard.set(Date(), forKey: "LastUpdateTime")
                    print("💾 환율 데이터를 로컬에 백업 저장")
                }
            }

            // 현재 선택된 통화의 환율이 있으면 알림 체크 (매매기준율 기준)
            if let currentRate = newRates[self.selectedCurrency] {
                self.checkAlertThresholds(rate: currentRate)
            }

            if newRates.isEmpty {
                print("❌ 환율 정보 없음 - 마지막 저장된 데이터 사용")
                self.currentApiSource = "한국수출입은행"
                self.showLastSavedData()
            } else {
                print("✅ \(newRates.count)개 통화 환율 로드 완료")
            }
        } catch {
            print("❌ 데이터 파싱 오류: \(error.localizedDescription) - ExchangeRate-API로 백업")
            self.currentApiSource = "ExchangeRate-API"
            self.fetchFromExchangeRateAPI()
        }
    }

    // MARK: - 한국수출입은행 API 호출
    private func fetchFromKoreaEximAPI() {
        // 주말인 경우 캐시된 평일 데이터 사용
        if isWeekendOrHoliday() {
            if !weekdayLastData.isEmpty {
                print("📅 주말 감지 - 캐시된 평일 데이터 사용")
                
                // 메인 큐에서 UI 업데이트 수행
                DispatchQueue.main.async {
                    self.exchangeRates = self.weekdayLastData
                    self.lastUpdateTime = self.lastWeekdayUpdate
                    self.currentApiSource = "한국수출입은행 (평일 캐시)"
                }
                
                print("✅ 캐시된 평일 데이터 \(weekdayLastData.count)개 통화 로드 완료")
                
                // 현재 선택된 통화의 환율이 있으면 알림 체크
                if let currentRate = weekdayLastData[self.selectedCurrency] {
                    self.checkAlertThresholds(rate: currentRate)
                }
            } else {
                print("📅 주말 감지 - 캐시된 데이터 없음, ExchangeRate-API로 백업")
                self.currentApiSource = "ExchangeRate-API"
                self.fetchFromExchangeRateAPI()
            }
            return
        }
        
        let urlString = "\(baseURL)?authkey=\(apiKey)&data=AP01"
        print("🌐 한국수출입은행 API 호출: \(urlString)")
        
        guard let url = URL(string: urlString) else {
            print("❌ 한국수출입은행 API 잘못된 URL: \(urlString) - ExchangeRate-API로 백업 시도")
            DispatchQueue.main.async {
                self.currentApiSource = "ExchangeRate-API"
            }
            fetchFromExchangeRateAPI()
            return
        }
        
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                self?.isLoading = false
                
                if let error = error {
                    print("❌ 한국수출입은행 API 네트워크 오류: \(error.localizedDescription) - ExchangeRate-API로 백업 시도")
                    self?.currentApiSource = "ExchangeRate-API"
                    self?.fetchFromExchangeRateAPI()
                    return
                }
                
                guard let data = data else {
                    print("❌ 한국수출입은행 API 데이터 없음 - ExchangeRate-API로 백업 시도")
                    self?.currentApiSource = "ExchangeRate-API"
                    self?.fetchFromExchangeRateAPI()
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
                       self?.lastUpdateTime = Date()
                       
                       // 평일 데이터를 캐시에 저장
                       if !newRates.isEmpty {
                           self?.weekdayLastData = newRates
                           self?.lastWeekdayUpdate = Date()
                           print("💾 평일 데이터 캐시에 저장 완료")
                       }
                       
                       // 현재 선택된 통화의 환율이 있으면 알림 체크 (매매기준율 기준)
                       if let currentRate = newRates[self?.selectedCurrency ?? .USD] {
                           self?.checkAlertThresholds(rate: currentRate)
                       }
                       
                       if newRates.isEmpty {
                           print("❌ 한국수출입은행 API에서 환율 정보 없음 - ExchangeRate-API로 백업 시도")
                           self?.currentApiSource = "ExchangeRate-API"
                           self?.fetchFromExchangeRateAPI()
                       } else {
                           print("✅ 총 \(newRates.count)개 통화 환율 로드 완료 (매매기준율 기준)")
                       }
                } catch {
                    print("❌ 한국수출입은행 API 파싱 오류: \(error.localizedDescription) - ExchangeRate-API로 백업 시도")
                    self?.currentApiSource = "ExchangeRate-API"
                    self?.fetchFromExchangeRateAPI()
                }
            }
        }.resume()
    }
    
    // MARK: - 자동 새로고침
    private func startPeriodicRefresh() {
        // 5분마다 자동 새로고침 (API 호출 제한 고려)
        // 1일 1000회 제한을 고려하면 5분 간격이 적절함 (288회/일)
        timer = Timer.scheduledTimer(withTimeInterval: 300.0, repeats: true) { [weak self] _ in
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
        
        let alertSettings = currencyAlertSettings.settings[currency] ?? AlertSettings.default
        guard alertSettings.isEnabled else { return }
        
        // 매매기준율(DEAL_BAS_R)을 기준으로 알림 체크
        guard let dealBasRString = rate.dealBasR,
              let dealBasR = Double(dealBasRString.replacingOccurrences(of: ",", with: "")) else {
            print("❌ 매매기준율 데이터 파싱 실패")
            return
        }
        
        let now = Date()
        
        // 마지막 알림 후 1시간이 지났는지 확인 (스팸 방지)
        if let lastNotification = alertSettings.lastNotificationTime,
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
            // 해당 통화의 마지막 알림 시간 업데이트
            var updatedSettings = alertSettings
            updatedSettings.lastNotificationTime = now
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
    
    // MARK: - 일일 변동 계산 (동기 버전)
    private func calculateDailyChangesSync(newRates: [CurrencyType: ExchangeRate]) -> [CurrencyType: DailyChange] {
        var changes: [CurrencyType: DailyChange] = [:]
        
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
            }
        }
        
        return changes
    }
    
    private func getDealBasRValue(from rate: ExchangeRate) -> Double? {
        guard let dealBasR = rate.dealBasR else { return nil }
        let cleanedRate = dealBasR.replacingOccurrences(of: ",", with: "")
        return Double(cleanedRate)
    }
}
