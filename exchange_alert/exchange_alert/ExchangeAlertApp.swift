import SwiftUI
import UserNotifications
import GoogleMobileAds
import BackgroundTasks

@main
struct ExchangeAlertApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var exchangeManager = ExchangeRateManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(exchangeManager)
                .onAppear {
                    // AdMob 초기화
                    MobileAds.shared.start { _ in }
                    
                    // 알림 권한 요청
                    NotificationManager.requestPermission { granted in
                        // 권한 요청만 하고 로깅 최소화
                    }
                    
                    // 백그라운드 앱 새로고침 설정 (Settings.bundle 설정 반영)
                    setupBackgroundRefresh()
                    
                    // 마지막 업데이트 시간 기록 (필요시)
                    
                    // iOS 설정에서 백그라운드 새로고침을 인식하도록 더 적극적으로 요청
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        self.setupBackgroundRefresh()
                    }
                    
                    DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                        self.setupBackgroundRefresh()
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                    // 앱이 포그라운드로 돌아올 때만 필요시 데이터 새로고침 (최적화)
                    if shouldRefreshData() {
                        exchangeManager.fetchExchangeRate()
                    }
                    
                    // 백그라운드 새로고침을 다시 요청 (iOS가 인식하도록)
                    setupBackgroundRefresh()
                    
                    // iOS 13+ 백그라운드 작업 재스케줄링
                    if #available(iOS 13.0, *) {
                        scheduleBackgroundTask()
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
                    // 백그라운드 fetch 간격 재설정 (더 적극적으로)
                    setupBackgroundRefresh()
                }
        }
    }
    
    // 데이터 새로고침 필요성 확인 (성능 최적화)
    private func shouldRefreshData() -> Bool {
        // 마지막 업데이트가 5분 이내면 새로고침 안함
        guard let lastUpdate = exchangeManager.lastUpdateTime else { return true }
        return Date().timeIntervalSince(lastUpdate) > 300 // 5분
    }
    
    // 백그라운드 새로고침 설정 (iOS 버전별)
    private func setupBackgroundRefresh() {
        if #available(iOS 13.0, *) {
            // iOS 13+ BackgroundTasks 프레임워크만 사용
            print("📱 iOS 13+ BackgroundTasks 프레임워크 사용")
            // setMinimumBackgroundFetchInterval은 사용하지 않음
        } else {
            // iOS 12 이하에서만 setMinimumBackgroundFetchInterval 사용
            UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
            
            // 1초 후 다시 한 번 설정 (iOS가 인식하도록)
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
                print("🔄 백그라운드 새로고침 재설정 (iOS 12)")
            }
            
            // 3초 후 한 번 더 설정
            DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
                print("🔄 백그라운드 새로고침 최종 설정 (iOS 12)")
            }
            
            // 5초 후 한 번 더 설정 (iOS 설정에서 인식하도록)
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
                print("🔄 백그라운드 새로고침 추가 설정 (iOS 12)")
            }
        }
        
        // 백그라운드 앱 새로고침 상태 확인 및 로깅
        let status = UIApplication.shared.backgroundRefreshStatus
        switch status {
        case .available:
            print("✅ 백그라운드 새로고침 사용 가능")
        case .denied:
            print("❌ 백그라운드 새로고침 거부됨 - iOS 설정에서 활성화 필요")
        case .restricted:
            print("⚠️ 백그라운드 새로고침 제한됨")
        @unknown default:
            print("❓ 알 수 없는 백그라운드 새로고침 상태")
        }
    }
    
    // iOS 13+ 백그라운드 작업 스케줄링
    @available(iOS 13.0, *)
    private func scheduleBackgroundTask() {
        // 기존 요청 취소
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: "com.exchangealert.refresh")
        
        let request = BGAppRefreshTaskRequest(identifier: "com.exchangealert.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: 5 * 60) // 5분 후로 단축
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("✅ ExchangeAlertApp 백그라운드 작업 스케줄링 성공 (5분 후)")
            
            // 추가로 더 짧은 간격으로도 요청
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                let shortRequest = BGAppRefreshTaskRequest(identifier: "com.exchangealert.refresh")
                shortRequest.earliestBeginDate = Date(timeIntervalSinceNow: 2 * 60) // 2분 후
                
                do {
                    try BGTaskScheduler.shared.submit(shortRequest)
                    print("✅ ExchangeAlertApp 짧은 간격 백그라운드 작업 스케줄링 성공 (2분 후)")
                } catch {
                    print("❌ ExchangeAlertApp 짧은 간격 백그라운드 작업 스케줄링 실패: \(error)")
                }
            }
        } catch {
            print("❌ ExchangeAlertApp 백그라운드 작업 스케줄링 실패: \(error)")
        }
    }
}
