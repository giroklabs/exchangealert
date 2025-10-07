import SwiftUI
import UserNotifications
import GoogleMobileAds

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
                    
                    // 백그라운드 앱 새로고침 설정 (더 적극적으로)
                    setupBackgroundRefresh()
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                    // 앱이 포그라운드로 돌아올 때만 필요시 데이터 새로고침 (최적화)
                    if shouldRefreshData() {
                        exchangeManager.fetchExchangeRate()
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
    
    // 백그라운드 새로고침 설정 (더 적극적으로)
    private func setupBackgroundRefresh() {
        // 백그라운드 fetch 간격을 최소로 설정
        UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
        
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
}
