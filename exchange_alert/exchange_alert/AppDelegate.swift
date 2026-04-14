import UIKit
import UserNotifications
import BackgroundTasks
import FirebaseCore
import FirebaseMessaging

class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Firebase 초기화
        FirebaseApp.configure()
        
        // 원격 알림 대리자 설정
        UNUserNotificationCenter.current().delegate = self
        Messaging.messaging().delegate = self
        
        // 알림 권한 요청
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { _, _ in }
        
        application.registerForRemoteNotifications()
        
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
    
    // MARK: - APNs Registration
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("✅ Apple APNs Token 발급 성공: \(tokenString)")
        // 파이어베이스에 APNs 토큰 연결 확인
        Messaging.messaging().apnsToken = deviceToken
    }
    
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("❌ Apple APNs Token 발급 실패: \(error.localizedDescription)")
    }
    
    // MARK: - MessagingDelegate
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        print("🚀 Firebase registration token: \(String(describing: fcmToken))")
        
        // 토큰을 UserDefaults에 저장하여 추후 Firestore 연동 시 사용
        if let token = fcmToken {
            UserDefaults.standard.set(token, forKey: "FCMToken")
            // 토큰이 업데이트되었음을 앱 전체에 알림
            NotificationCenter.default.post(name: Notification.Name("FCMTokenUpdated"), object: nil)
        }
    }
    
    // MARK: - UNUserNotificationCenterDelegate
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        // 앱이 포그라운드에 있을 때도 알림 표시
        completionHandler([[.banner, .sound, .badge]])
    }
    
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        // 알림을 클릭했을 때 처리
        completionHandler()
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
                
                // 모든 통화 환율 확인 및 알림 발송 (매매기준율 사용)
                for rate in rates {
                    if let curUnit = rate.curUnit,
                       let currency = CurrencyType(rawValue: curUnit),
                       let dealBasRString = rate.dealBasR,
                       let currentRate = Double(dealBasRString.replacingOccurrences(of: ",", with: "")) {
                        self.checkAndSendAlertForCurrency(currency: currency, rate: currentRate)
                    }
                }
                
                completionHandler(.newData)
            } catch {
                print("❌ 백그라운드 fetch 파싱 실패: \(error.localizedDescription)")
                completionHandler(.failed)
            }
        }
        
        task.resume()
    }
    
    // 통화별 임계점 확인 및 알림 발송 (백그라운드용)
    private func checkAndSendAlertForCurrency(currency: CurrencyType, rate: Double) {
        // 사용자 설정에서 해당 통화 알림 설정 로드
        guard let alertData = UserDefaults.standard.data(forKey: "CurrencyAlertSettings"),
              var currencyAlertSettings = try? JSONDecoder().decode(CurrencyAlertSettings.self, from: alertData) else {
            print("⚠️ 백그라운드: \(currency.rawValue) 사용자 알림 설정 없음 - 기본값 사용")
            checkWithHardcodedThresholds(currency: currency, rate: rate)
            return
        }
        
        let alertSettings = currencyAlertSettings.getSettings(for: currency)
        
        // 알림이 비활성화된 경우
        guard alertSettings.isEnabled else {
            print("⚠️ 백그라운드: \(currency.rawValue) 알림이 비활성화됨")
            return
        }
        
        // 백그라운드 알림 스팸 방지 (5분 간격)
        let now = Date()
        let lastNotificationKey = "LastBackgroundNotification_\(currency.rawValue)"
        if let lastNotification = UserDefaults.standard.object(forKey: lastNotificationKey) as? Date,
           now.timeIntervalSince(lastNotification) < 300 {
            print("⚠️ 백그라운드 스팸 방지: \(currency.rawValue) 마지막 알림 후 5분이 지나지 않음")
            return
        }
        
        // 사용자 설정에 따른 알림 체크
        var shouldNotify = false
        var message = ""
        
        switch alertSettings.thresholdType {
        case .upper:
            if rate >= alertSettings.threshold {
                shouldNotify = true
                message = "💰 \(currency.rawValue) 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원) 이상이 되었습니다!"
            }
        case .lower:
            if rate <= alertSettings.threshold {
                shouldNotify = true
                message = "📉 \(currency.rawValue) 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원) 이하가 되었습니다!"
            }
        case .both3:
            let upperThreshold = alertSettings.threshold * 1.03
            let lowerThreshold = alertSettings.threshold * 0.97
            if rate >= upperThreshold {
                shouldNotify = true
                message = "💰 \(currency.rawValue) 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원)에서 3% 상승했습니다!"
            } else if rate <= lowerThreshold {
                shouldNotify = true
                message = "📉 \(currency.rawValue) 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원)에서 3% 하락했습니다!"
            }
        case .both:
            let upperThreshold = alertSettings.threshold * 1.05
            let lowerThreshold = alertSettings.threshold * 0.95
            if rate >= upperThreshold {
                shouldNotify = true
                message = "💰 \(currency.rawValue) 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원)에서 5% 상승했습니다!"
            } else if rate <= lowerThreshold {
                shouldNotify = true
                message = "📉 \(currency.rawValue) 환율이 \(String(format: "%.2f", rate))원으로 기준값(\(String(format: "%.0f", alertSettings.threshold))원)에서 5% 하락했습니다!"
            }
        }
        
        if shouldNotify {
            sendBackgroundNotification(message: message)
            print("✅ 백그라운드 환율 알림 발송 완료")
        }
    }
    
    // 임계점 확인 및 알림 발송 (백그라운드용) - 기존 함수 (하위 호환성)
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
            sendBackgroundNotification(message: message)
            print("✅ 백그라운드 USD 알림 발송 완료")
        }
    }
    
    // 하드코딩된 임계값 사용 (사용자 설정이 없을 때) - 통화별
    private func checkWithHardcodedThresholds(currency: CurrencyType, rate: Double) {
        // 기본 임계값 사용 (USD: 1400/1350, 기타: 통화별 설정)
        let upperThreshold: Double
        let lowerThreshold: Double
        
        switch currency {
        case .USD:
            upperThreshold = 1400.0
            lowerThreshold = 1350.0
        case .EUR:
            upperThreshold = 1500.0
            lowerThreshold = 1450.0
        case .JPY:
            upperThreshold = 10.0
            lowerThreshold = 9.5
        default:
            // 기타 통화는 USD 기준으로 조정
            upperThreshold = 1400.0
            lowerThreshold = 1350.0
        }
        
        // 백그라운드 알림 스팸 방지 (5분 간격)
        let now = Date()
        let lastNotificationKey = "LastBackgroundNotification_\(currency.rawValue)"
        if let lastNotification = UserDefaults.standard.object(forKey: lastNotificationKey) as? Date,
           now.timeIntervalSince(lastNotification) < 300 {
            print("⚠️ 백그라운드 스팸 방지: \(currency.rawValue) 마지막 알림 후 5분이 지나지 않음")
            return
        }
        
        var shouldNotify = false
        var message = ""
        
        if rate >= upperThreshold {
            shouldNotify = true
            message = "💰 \(currency.rawValue) 환율이 \(String(format: "%.2f", rate))원에 도달했습니다! (기본 설정)"
        } else if rate <= lowerThreshold {
            shouldNotify = true
            message = "📉 \(currency.rawValue) 환율이 \(String(format: "%.2f", rate))원까지 하락했습니다! (기본 설정)"
        }
        
        if shouldNotify {
            sendBackgroundNotification(message: message)
            print("✅ 백그라운드 기본 알림 발송 완료")
        }
    }
    
    // 하드코딩된 임계값 사용 (사용자 설정이 없을 때) - 기존 함수 (하위 호환성)
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
            sendBackgroundNotification(message: message)
            print("✅ 백그라운드 기본 알림 발송 완료")
        }
    }
    
    // 백그라운드 알림 발송 (최적화된 버전)
    private func sendBackgroundNotification(message: String) {
        print("📱 백그라운드 알림 발송 시도: \(message)")
        
        // 즉시 알림 발송 (권한 체크는 앱 시작 시 이미 완료됨)
        let content = UNMutableNotificationContent()
        content.title = "💱 환율 알림"
        content.body = message
        content.sound = .default
        content.badge = 1
        
        // 고유한 식별자 생성 (타임스탬프 + 랜덤)
        let uniqueId = "background_alert_\(Int(Date().timeIntervalSince1970))_\(Int.random(in: 1000...9999))"
        
        let request = UNNotificationRequest(
            identifier: uniqueId,
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ 백그라운드 알림 발송 실패: \(error.localizedDescription)")
                // 권한 문제인지 확인
                UNUserNotificationCenter.current().getNotificationSettings { settings in
                    print("🔍 알림 권한 상태: \(settings.authorizationStatus.rawValue)")
                }
            } else {
                print("✅ 백그라운드 알림 발송 성공: \(message)")
                // 알림 발송 기록 및 앱 내 내역 추가
                self.recordNotification(message: message)
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
    private func recordNotification(message: String = "") {
        let currentCount = UserDefaults.standard.integer(forKey: "total_notifications")
        UserDefaults.standard.set(currentCount + 1, forKey: "total_notifications")
        
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.locale = Locale(identifier: "ko_KR")
        
        let timestamp = formatter.string(from: Date())
        UserDefaults.standard.set(timestamp, forKey: "last_notification")
        
        // 앱 내 알림 센터 내역에 추가
        if !message.isEmpty {
            NotificationManager.shared.addNotificationToHistory(message: message)
        }
        
        print("📱 알림 발송 기록: \(currentCount + 1)번째 알림, \(timestamp)")
    }
    
    // iOS 13+ 백그라운드 새로고침 작업 스케줄링
    private func scheduleBackgroundRefresh() {
        guard #available(iOS 13.0, *) else { return }
        
        // 기존 요청 취소 (중복 방지)
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: "com.exchangealert.refresh")
        
        // 짧은 딜레이 후 스케줄링 (중복 요청 방지)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            let request = BGAppRefreshTaskRequest(identifier: "com.exchangealert.refresh")
            request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60) // 5분 후
            
            do {
                try BGTaskScheduler.shared.submit(request)
                print("✅ AppDelegate 백그라운드 작업 스케줄링 성공 (5분 후)")
            } catch {
                print("❌ AppDelegate 백그라운드 작업 스케줄링 실패: \(error)")
                // 에러 상세 정보 출력
                if let nsError = error as NSError? {
                    print("   에러 도메인: \(nsError.domain)")
                    print("   에러 코드: \(nsError.code)")
                    print("   에러 설명: \(nsError.localizedDescription)")
                }
            }
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
    
    // 환율 데이터 새로고침 (최적화된 공통 함수)
    private func refreshExchangeData(completion: @escaping (Bool) -> Void) {
        print("🔄 백그라운드 환율 데이터 새로고침 시작")
        
        guard let url = URL(string: "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json") else {
            print("❌ 백그라운드 fetch URL 오류")
            completion(false)
            return
        }
        
        // 백그라운드 실행 시간 제한을 고려한 타임아웃 설정
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 10.0  // 10초 타임아웃
        config.timeoutIntervalForResource = 15.0  // 15초 전체 타임아웃
        
        let session = URLSession(configuration: config)
        
        session.dataTask(with: url) { data, response, error in
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
            
            // 데이터 파싱 시도 (배열 형태)
            do {
                let rates = try JSONDecoder().decode([ExchangeRate].self, from: data)
                print("✅ 백그라운드 데이터 새로고침 성공: \(rates.count)개 통화")
                
                // 알림 체크를 병렬로 처리하여 시간 단축
                let dispatchGroup = DispatchGroup()
                var alertCount = 0
                
                for rate in rates {
                    if let curUnit = rate.curUnit,
                       let currency = CurrencyType(rawValue: curUnit),
                       let dealBasRString = rate.dealBasR,
                       let currentRate = Double(dealBasRString.replacingOccurrences(of: ",", with: "")) {
                        
                        dispatchGroup.enter()
                        DispatchQueue.global(qos: .userInitiated).async {
                            self.checkAndSendAlertForCurrency(currency: currency, rate: currentRate)
                            alertCount += 1
                            dispatchGroup.leave()
                        }
                    }
                }
                
                // 모든 알림 체크 완료 대기 (최대 5초)
                let result = dispatchGroup.wait(timeout: .now() + 5.0)
                if result == .timedOut {
                    print("⚠️ 백그라운드 알림 체크 시간 초과 (5초)")
                } else {
                    print("✅ 백그라운드 알림 체크 완료: \(alertCount)개 통화 확인")
                }
                
                completion(true)
            } catch {
                print("❌ 백그라운드 데이터 파싱 실패: \(error.localizedDescription)")
                completion(false)
            }
        }.resume()
    }
}
