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
                    print("✅ AdMob SDK 초기화 완료")
                    
                    // 알림 권한 요청
                    NotificationManager.requestPermission { granted in
                        if granted {
                            print("✅ 알림 권한이 허용되었습니다.")
                        } else {
                            print("❌ 알림 권한이 거부되었습니다.")
                        }
                    }
                    
                    // 백그라운드 앱 새로고침 설정
                    setupBackgroundAppRefresh()
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                    // 앱이 포그라운드로 돌아올 때 환율 데이터 새로고침
                    print("📱 앱이 포그라운드로 활성화됨 - 환율 데이터 새로고침")
                    exchangeManager.fetchExchangeRate()
                }
        }
    }
    
    private func setupBackgroundAppRefresh() {
        // iOS 백그라운드 앱 새로고침 설정
        UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
        print("✅ 백그라운드 앱 새로고침 설정 완료 (최소 간격: \(UIApplication.backgroundFetchIntervalMinimum)초)")
    }
}
