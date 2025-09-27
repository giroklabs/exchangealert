import SwiftUI
import UserNotifications
import GoogleMobileAds

@main
struct ExchangeAlertApp: App {
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
                }
        }
    }
}
