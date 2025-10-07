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
                    
                    // 백그라운드 앱 새로고침 설정 (최적화)
                    UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                    // 앱이 포그라운드로 돌아올 때만 필요시 데이터 새로고침 (최적화)
                    if shouldRefreshData() {
                        exchangeManager.fetchExchangeRate()
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
                    // 백그라운드 fetch 간격 재설정 (최적화)
                    UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
                }
        }
    }
    
    // 데이터 새로고침 필요성 확인 (성능 최적화)
    private func shouldRefreshData() -> Bool {
        // 마지막 업데이트가 5분 이내면 새로고침 안함
        guard let lastUpdate = exchangeManager.lastUpdateTime else { return true }
        return Date().timeIntervalSince(lastUpdate) > 300 // 5분
    }
}
