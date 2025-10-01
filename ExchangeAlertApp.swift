import SwiftUI
import UserNotifications

@main
struct ExchangeAlertApp: App {
    @StateObject private var exchangeManager = ExchangeRateManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(exchangeManager)
                .onAppear {
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


