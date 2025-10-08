import UIKit
import UserNotifications
import BackgroundTasks

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // iOS 13+ BackgroundTasks 프레임워크 사용
        if #available(iOS 13.0, *) {
            // BGAppRefreshTask 등록
            BGTaskScheduler.shared.register(forTaskWithIdentifier: "com.exchangealert.refresh", using: nil) { task in
                self.handleBackgroundRefresh(task: task as! BGAppRefreshTask)
            }
            print("✅ iOS 13+ BackgroundTasks 등록 완료")
        } else {
            // iOS 12 이하에서는 기존 방식 사용
            application.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
            print("✅ iOS 12 이하 백그라운드 앱 새로고침 설정 완료")
        }
        
        // 백그라운드 새로고침을 강제로 요청 (iOS가 인식하도록)
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            self.scheduleBackgroundRefresh()
        }
        
        // 백그라운드 앱 새로고침 상태 확인
        print("📱 백그라운드 앱 새로고침 상태: \(application.backgroundRefreshStatus.rawValue)")
        
        // 앱이 포그라운드에서 백그라운드로 갈 때 fetch 요청
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        
        return true
    }
    
    @objc private func appDidEnterBackground() {
        print("📱 앱이 백그라운드로 이동 - 백그라운드 fetch 활성화 요청")
        
        // 백그라운드 fetch 요청을 더 적극적으로 수행 (iOS 버전별)
        if #available(iOS 13.0, *) {
            // iOS 13+에서는 BackgroundTasks 프레임워크만 사용
            print("📱 iOS 13+ BackgroundTasks 프레임워크 사용")
        } else {
            // iOS 12 이하에서만 setMinimumBackgroundFetchInterval 사용
            UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
        }
        
        // 백그라운드 앱 새로고침 상태 확인
        let backgroundRefreshStatus = UIApplication.shared.backgroundRefreshStatus
        print("📱 백그라운드 진입 시 상태: \(backgroundRefreshStatus.rawValue)")
        
        // 백그라운드 fetch가 가능한 상태라면 간격을 최소로 설정
        if backgroundRefreshStatus == .available {
            print("✅ 백그라운드 fetch 간격을 최소로 설정하여 iOS가 백그라운드에서 실행할 가능성을 높임")
        } else {
            print("⚠️ 백그라운드 fetch가 현재 사용 불가능한 상태입니다.")
        }
    }
    
    // 백그라운드에서 앱 새로고침이 실행될 때 호출
    func application(_ application: UIApplication, performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("🔄 백그라운드 fetch 시작")
        
        // 백그라운드 fetch 실행 기록
        recordBackgroundFetch()
        
        // 환율 데이터 새로고침을 위한 URL 요청
        guard let url = URL(string: "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json") else {
            print("❌ 백그라운드 fetch URL 오류")
            completionHandler(.failed)
            return
        }
        
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                print("❌ 백그라운드 fetch 실패: \(error.localizedDescription)")
                completionHandler(.failed)
                return
            }
            
            guard let data = data else {
                print("❌ 백그라운드 fetch 데이터 없음")
                completionHandler(.noData)
                return
            }
            
            // 데이터 파싱 시도
            do {
                let rates = try JSONDecoder().decode([ExchangeRate].self, from: data)
                print("✅ 백그라운드 fetch 성공: \(rates.count)개 통화 데이터 로드")
                
                // 간단한 알림 체크 로직
                if let usdRate = rates.first(where: { $0.curUnit == "USD" }),
                   let dealBasRString = usdRate.dealBasR,
                   let currentRate = Double(dealBasRString.replacingOccurrences(of: ",", with: "")) {
                    self.checkAndSendAlert(rate: currentRate)
                }
                
                completionHandler(.newData)
            } catch {
                print("❌ 백그라운드 fetch 파싱 실패: \(error.localizedDescription)")
                completionHandler(.failed)
            }
        }
        
        task.resume()
    }
    
    // 임계점 확인 및 알림 발송 (백그라운드용)
    private func checkAndSendAlert(rate: Double) {
        // 사용자 설정에서 USD 알림 설정 로드
        guard let alertData = UserDefaults.standard.data(forKey: "CurrencyAlertSettings"),
              var currencyAlertSettings = try? JSONDecoder().decode(CurrencyAlertSettings.self, from: alertData) else {
            print("⚠️ 백그라운드: 사용자 알림 설정 없음 - 하드코딩된 기본값 사용")
            checkWithHardcodedThresholds(rate: rate)
            return
        }
        
        let usdSettings = currencyAlertSettings.getSettings(for: .USD)
        
        // 알림이 비활성화된 경우
        guard usdSettings.isEnabled else {
            print("⚠️ 백그라운드: USD 알림이 비활성화됨")
            return
        }
        
        // 백그라운드 알림 스팸 방지 (5분 간격)
        let now = Date()
        let lastNotificationKey = "LastBackgroundNotification"
        if let lastNotification = UserDefaults.standard.object(forKey: lastNotificationKey) as? Date,
           now.timeIntervalSince(lastNotification) < 300 {
            print("⚠️ 백그라운드 스팸 방지: 마지막 알림 후 5분이 지나지 않음")
            return
        }
        
        // 사용자 설정에 따른 알림 체크
        var shouldNotify = false
        var message = ""
        
        switch usdSettings.thresholdType {
        case .upper:
            if rate >= usdSettings.threshold {
                shouldNotify = true
                message = "💰 USD 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", usdSettings.threshold))원) 이상이 되었습니다!"
            }
        case .lower:
            if rate <= usdSettings.threshold {
                shouldNotify = true
                message = "📉 USD 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", usdSettings.threshold))원) 이하가 되었습니다!"
            }
        case .both3:
            let upperThreshold = usdSettings.threshold * 1.03
            let lowerThreshold = usdSettings.threshold * 0.97
            if rate >= upperThreshold {
                shouldNotify = true
                message = "💰 USD 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", usdSettings.threshold))원)에서 3% 상승했습니다!"
            } else if rate <= lowerThreshold {
                shouldNotify = true
                message = "📉 USD 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", usdSettings.threshold))원)에서 3% 하락했습니다!"
            }
        case .both:
            let upperThreshold = usdSettings.threshold * 1.05
            let lowerThreshold = usdSettings.threshold * 0.95
            if rate >= upperThreshold {
                shouldNotify = true
                message = "💰 USD 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", usdSettings.threshold))원)에서 5% 상승했습니다!"
            } else if rate <= lowerThreshold {
                shouldNotify = true
                message = "📉 USD 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", usdSettings.threshold))원)에서 5% 하락했습니다!"
            }
        }
        
        if shouldNotify {
            // 마지막 알림 시간 저장
            UserDefaults.standard.set(now, forKey: lastNotificationKey)
            sendBackgroundNotification(message: message)
        }
    }
    
    // 하드코딩된 임계값 사용 (사용자 설정이 없을 때)
    private func checkWithHardcodedThresholds(rate: Double) {
        // 기본 임계값 사용 (1400/1350) - 하위 호환성
        let upperThreshold = 1400.0
        let lowerThreshold = 1350.0
        
        // 백그라운드 알림 스팸 방지 (5분 간격)
        let now = Date()
        let lastNotificationKey = "LastBackgroundNotification"
        if let lastNotification = UserDefaults.standard.object(forKey: lastNotificationKey) as? Date,
           now.timeIntervalSince(lastNotification) < 300 {
            print("⚠️ 백그라운드 스팸 방지: 마지막 알림 후 5분이 지나지 않음")
            return
        }
        
        var shouldNotify = false
        var message = ""
        
        if rate >= upperThreshold {
            shouldNotify = true
            message = "💰 USD 환율이 \(String(format: "%.2f", rate))원에 도달했습니다! (기본 설정)"
        } else if rate <= lowerThreshold {
            shouldNotify = true
            message = "📉 USD 환율이 \(String(format: "%.2f", rate))원까지 하락했습니다! (기본 설정)"
        }
        
        if shouldNotify {
            // 마지막 알림 시간 저장
            UserDefaults.standard.set(now, forKey: lastNotificationKey)
            sendBackgroundNotification(message: message)
        }
    }
    
    // 백그라운드 알림 발송
    private func sendBackgroundNotification(message: String) {
        // 알림 권한 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
                print("❌ 백그라운드 알림 권한 없음: \(settings.authorizationStatus.rawValue)")
                return
            }
            
            let content = UNMutableNotificationContent()
            content.title = "💱 환율 알림"
            content.body = message
            content.sound = .default
            content.badge = 1
            
            let request = UNNotificationRequest(
                identifier: "background_alert_\(Date().timeIntervalSince1970)",
                content: content,
                trigger: nil
            )
            
            UNUserNotificationCenter.current().add(request) { error in
                if let error = error {
                    print("❌ 백그라운드 알림 발송 실패: \(error.localizedDescription)")
                } else {
                    print("✅ 백그라운드 알림 발송 성공: \(message)")
                    // 알림 발송 기록
                    self.recordNotification()
                }
            }
        }
    }
    
    // 백그라운드 fetch 실행 기록
    private func recordBackgroundFetch() {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.locale = Locale(identifier: "ko_KR")
        
        let timestamp = formatter.string(from: Date())
        UserDefaults.standard.set(timestamp, forKey: "last_background_fetch")
        print("📱 백그라운드 fetch 실행 기록: \(timestamp)")
    }
    
    // 알림 발송 기록
    private func recordNotification() {
        let currentCount = UserDefaults.standard.integer(forKey: "total_notifications")
        UserDefaults.standard.set(currentCount + 1, forKey: "total_notifications")
        
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.locale = Locale(identifier: "ko_KR")
        
        let timestamp = formatter.string(from: Date())
        UserDefaults.standard.set(timestamp, forKey: "last_notification")
        
        print("📱 알림 발송 기록: \(currentCount + 1)번째 알림, \(timestamp)")
    }
    
    // iOS 13+ 백그라운드 새로고침 작업 스케줄링
    private func scheduleBackgroundRefresh() {
        guard #available(iOS 13.0, *) else { return }
        
        // 기존 요청 취소
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: "com.exchangealert.refresh")
        
        let request = BGAppRefreshTaskRequest(identifier: "com.exchangealert.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60) // 5분 후로 단축
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("✅ AppDelegate 백그라운드 작업 스케줄링 성공 (5분 후)")
            
            // 추가로 더 짧은 간격으로도 요청
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                let shortRequest = BGAppRefreshTaskRequest(identifier: "com.exchangealert.refresh")
                shortRequest.earliestBeginDate = Date(timeIntervalSinceNow: 1 * 60) // 1분 후
                
                do {
                    try BGTaskScheduler.shared.submit(shortRequest)
                    print("✅ AppDelegate 짧은 간격 백그라운드 작업 스케줄링 성공 (1분 후)")
                } catch {
                    print("❌ AppDelegate 짧은 간격 백그라운드 작업 스케줄링 실패: \(error)")
                }
            }
        } catch {
            print("❌ AppDelegate 백그라운드 작업 스케줄링 실패: \(error)")
        }
    }
    
    // iOS 13+ 백그라운드 새로고침 작업 처리
    @available(iOS 13.0, *)
    private func handleBackgroundRefresh(task: BGAppRefreshTask) {
        print("🔄 백그라운드 새로고침 작업 시작 (iOS 13+)")
        
        // 백그라운드 fetch 실행 기록
        recordBackgroundFetch()
        
        // 환율 데이터 새로고침
        refreshExchangeData { [weak self] success in
            // 다음 백그라운드 작업 스케줄링 (성공/실패 관계없이)
            self?.scheduleBackgroundRefresh()
            
            task.setTaskCompleted(success: success)
            if success {
                print("✅ 백그라운드 새로고침 작업 완료 (iOS 13+)")
            } else {
                print("❌ 백그라운드 새로고침 작업 실패 (iOS 13+)")
            }
        }
    }
    
    // 환율 데이터 새로고침 (공통 함수)
    private func refreshExchangeData(completion: @escaping (Bool) -> Void) {
        guard let url = URL(string: "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json") else {
            print("❌ 백그라운드 fetch URL 오류")
            completion(false)
            return
        }
        
        URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                print("❌ 백그라운드 데이터 새로고침 실패: \(error.localizedDescription)")
                completion(false)
                return
            }
            
            guard let data = data else {
                print("❌ 백그라운드 데이터 없음")
                completion(false)
                return
            }
            
            // 데이터 파싱 시도
            do {
                let exchangeData = try JSONDecoder().decode([String: ExchangeRate].self, from: data)
                print("✅ 백그라운드 데이터 새로고침 성공: \(exchangeData.count)개 통화")
                
                // USD 환율 확인 및 알림 발송
                if let usdRate = exchangeData["USD"],
                   let ttbString = usdRate.ttb,
                   let currentRate = Double(ttbString.replacingOccurrences(of: ",", with: "")) {
                    self.checkAndSendAlert(rate: currentRate)
                }
                
                completion(true)
            } catch {
                print("❌ 백그라운드 데이터 파싱 실패: \(error.localizedDescription)")
                completion(false)
            }
        }.resume()
    }
}
