import SwiftUI
import UserNotifications
import GoogleMobileAds

@main
struct ExchangeAlertApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    @StateObject private var exchangeManager = ExchangeRateManager()
    @StateObject private var settingsManager = SettingsManager.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(exchangeManager)
                .environmentObject(settingsManager)
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
                    
                    // 백그라운드 앱 새로고침 설정 (더 적극적으로)
                    UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
                    print("✅ 백그라운드 앱 새로고침 설정 완료 (간격: \(UIApplication.backgroundFetchIntervalMinimum)초)")
                    
                    // 백그라운드 앱 새로고침 상태 확인
                    let backgroundRefreshStatus = UIApplication.shared.backgroundRefreshStatus
                    print("📱 앱 시작 시 백그라운드 앱 새로고침 상태: \(backgroundRefreshStatus.rawValue)")
                    
                    switch backgroundRefreshStatus {
                    case .available:
                        print("✅ 백그라운드 앱 새로고침 사용 가능")
                    case .denied:
                        print("❌ 백그라운드 앱 새로고침 거부됨 - 설정에서 활성화 필요")
                    case .restricted:
                        print("⚠️ 백그라운드 앱 새로고침 제한됨")
                    @unknown default:
                        print("❓ 알 수 없는 백그라운드 새로고침 상태")
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                    // 앱이 포그라운드로 돌아올 때 환율 데이터 새로고침
                    print("📱 앱이 포그라운드로 활성화됨 - 환율 데이터 새로고침")
                    exchangeManager.fetchExchangeRate()
                    
                    // 백그라운드 앱 새로고침 상태 확인
                    let backgroundRefreshStatus = UIApplication.shared.backgroundRefreshStatus
                    print("📱 현재 백그라운드 앱 새로고침 상태: \(backgroundRefreshStatus.rawValue)")
                    
                    switch backgroundRefreshStatus {
                    case .available:
                        print("✅ 백그라운드 앱 새로고침 사용 가능")
                    case .denied:
                        print("❌ 백그라운드 앱 새로고침 거부됨 - 설정에서 활성화 필요")
                    case .restricted:
                        print("⚠️ 백그라운드 앱 새로고침 제한됨")
                    @unknown default:
                        print("❓ 알 수 없는 백그라운드 새로고침 상태")
                    }
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
                    // 앱이 백그라운드로 갈 때
                    print("📱 앱이 백그라운드로 이동됨 - 백그라운드 fetch 활성화")
                    
                    // 백그라운드 fetch 간격 재설정
                    UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
                    print("📱 백그라운드 fetch 간격 재설정 완료")
                }
        }
    }
    
}
