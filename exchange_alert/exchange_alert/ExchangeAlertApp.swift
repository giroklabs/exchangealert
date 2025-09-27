import SwiftUI
import UserNotifications
// import GoogleMobileAds  // TODO: Xcode에서 Swift Package Manager로 Google Mobile Ads SDK 추가 후 활성화

@main
struct ExchangeAlertApp: App {
    @StateObject private var exchangeManager = ExchangeRateManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(exchangeManager)
                .onAppear {
                    // TODO: AdMob 초기화 (SDK 추가 후 활성화)
                    // GADMobileAds.sharedInstance().start(completionHandler: nil)
                    // print("✅ AdMob SDK 초기화 완료")
                    
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
