import Foundation
import UIKit
import UserNotifications

class SettingsManager: ObservableObject {
    static let shared = SettingsManager()
    
    // MARK: - UserDefaults Keys
    private enum Keys {
        static let backgroundRefreshEnabled = "background_refresh_enabled"
        static let backgroundRefreshInterval = "background_refresh_interval"
        static let notificationsEnabled = "notifications_enabled"
        static let notificationSound = "notification_sound"
        static let notificationBadge = "notification_badge"
        static let notificationAlert = "notification_alert"
        static let totalNotifications = "total_notifications"
        static let lastNotification = "last_notification"
        static let backgroundRefreshStatus = "background_refresh_status"
        static let lastBackgroundFetch = "last_background_fetch"
    }
    
    // MARK: - Published Properties
    @Published var backgroundRefreshEnabled: Bool {
        didSet {
            UserDefaults.standard.set(backgroundRefreshEnabled, forKey: Keys.backgroundRefreshEnabled)
            updateBackgroundRefreshStatus()
        }
    }
    
    @Published var backgroundRefreshInterval: Int {
        didSet {
            UserDefaults.standard.set(backgroundRefreshInterval, forKey: Keys.backgroundRefreshInterval)
            updateBackgroundRefreshInterval()
        }
    }
    
    @Published var notificationsEnabled: Bool {
        didSet {
            UserDefaults.standard.set(notificationsEnabled, forKey: Keys.notificationsEnabled)
        }
    }
    
    @Published var notificationSound: Bool {
        didSet {
            UserDefaults.standard.set(notificationSound, forKey: Keys.notificationSound)
        }
    }
    
    @Published var notificationBadge: Bool {
        didSet {
            UserDefaults.standard.set(notificationBadge, forKey: Keys.notificationBadge)
        }
    }
    
    @Published var notificationAlert: Bool {
        didSet {
            UserDefaults.standard.set(notificationAlert, forKey: Keys.notificationAlert)
        }
    }
    
    // MARK: - Initialization
    private init() {
        // 기본값 로드
        self.backgroundRefreshEnabled = UserDefaults.standard.object(forKey: Keys.backgroundRefreshEnabled) as? Bool ?? true
        self.backgroundRefreshInterval = UserDefaults.standard.object(forKey: Keys.backgroundRefreshInterval) as? Int ?? 30
        self.notificationsEnabled = UserDefaults.standard.object(forKey: Keys.notificationsEnabled) as? Bool ?? true
        self.notificationSound = UserDefaults.standard.object(forKey: Keys.notificationSound) as? Bool ?? true
        self.notificationBadge = UserDefaults.standard.object(forKey: Keys.notificationBadge) as? Bool ?? true
        self.notificationAlert = UserDefaults.standard.object(forKey: Keys.notificationAlert) as? Bool ?? true
        
        // UserDefaults 변경 감지
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(userDefaultsChanged),
            name: UserDefaults.didChangeNotification,
            object: nil
        )
        
        // 백그라운드 상태 모니터링
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - UserDefaults 변경 감지
    @objc private func userDefaultsChanged() {
        DispatchQueue.main.async {
            self.backgroundRefreshEnabled = UserDefaults.standard.bool(forKey: Keys.backgroundRefreshEnabled)
            self.backgroundRefreshInterval = UserDefaults.standard.integer(forKey: Keys.backgroundRefreshInterval)
            self.notificationsEnabled = UserDefaults.standard.bool(forKey: Keys.notificationsEnabled)
            self.notificationSound = UserDefaults.standard.bool(forKey: Keys.notificationSound)
            self.notificationBadge = UserDefaults.standard.bool(forKey: Keys.notificationBadge)
            self.notificationAlert = UserDefaults.standard.bool(forKey: Keys.notificationAlert)
            
            print("📱 iOS 설정에서 변경된 값들을 앱에 반영했습니다.")
        }
    }
    
    // MARK: - 앱 활성화 시 상태 업데이트
    @objc private func appDidBecomeActive() {
        updateBackgroundRefreshStatus()
        updateNotificationStatus()
    }
    
    // MARK: - 백그라운드 새로고침 상태 업데이트
    private func updateBackgroundRefreshStatus() {
        let status = UIApplication.shared.backgroundRefreshStatus
        let statusString: String
        
        switch status {
        case .available:
            statusString = "사용 가능"
        case .denied:
            statusString = "거부됨"
        case .restricted:
            statusString = "제한됨"
        @unknown default:
            statusString = "알 수 없음"
        }
        
        UserDefaults.standard.set(statusString, forKey: Keys.backgroundRefreshStatus)
        print("📱 백그라운드 새로고침 상태 업데이트: \(statusString)")
    }
    
    // MARK: - 백그라운드 새로고침 간격 업데이트
    private func updateBackgroundRefreshInterval() {
        if backgroundRefreshEnabled {
            let interval: TimeInterval = TimeInterval(backgroundRefreshInterval * 60) // 분을 초로 변환
            UIApplication.shared.setMinimumBackgroundFetchInterval(interval)
            print("📱 백그라운드 새로고침 간격 업데이트: \(backgroundRefreshInterval)분")
        }
    }
    
    // MARK: - 알림 상태 업데이트
    private func updateNotificationStatus() {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                let statusString: String
                
                switch settings.authorizationStatus {
                case .authorized:
                    statusString = "허용됨"
                case .denied:
                    statusString = "거부됨"
                case .notDetermined:
                    statusString = "확정되지 않음"
                case .provisional:
                    statusString = "임시 허용"
                case .ephemeral:
                    statusString = "임시"
                @unknown default:
                    statusString = "알 수 없음"
                }
                
                print("📱 알림 권한 상태 업데이트: \(statusString)")
            }
        }
    }
    
    // MARK: - 백그라운드 fetch 실행 기록
    func recordBackgroundFetch() {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.locale = Locale(identifier: "ko_KR")
        
        let timestamp = formatter.string(from: Date())
        UserDefaults.standard.set(timestamp, forKey: Keys.lastBackgroundFetch)
        print("📱 백그라운드 fetch 실행 기록: \(timestamp)")
    }
    
    // MARK: - 알림 발송 기록
    func recordNotification() {
        let currentCount = UserDefaults.standard.integer(forKey: Keys.totalNotifications)
        UserDefaults.standard.set(currentCount + 1, forKey: Keys.totalNotifications)
        
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        formatter.locale = Locale(identifier: "ko_KR")
        
        let timestamp = formatter.string(from: Date())
        UserDefaults.standard.set(timestamp, forKey: Keys.lastNotification)
        
        print("📱 알림 발송 기록: \(currentCount + 1)번째 알림, \(timestamp)")
    }
    
    // MARK: - 설정 초기화
    func resetSettings() {
        UserDefaults.standard.removeObject(forKey: Keys.backgroundRefreshEnabled)
        UserDefaults.standard.removeObject(forKey: Keys.backgroundRefreshInterval)
        UserDefaults.standard.removeObject(forKey: Keys.notificationsEnabled)
        UserDefaults.standard.removeObject(forKey: Keys.notificationSound)
        UserDefaults.standard.removeObject(forKey: Keys.notificationBadge)
        UserDefaults.standard.removeObject(forKey: Keys.notificationAlert)
        
        // 기본값으로 재설정
        backgroundRefreshEnabled = true
        backgroundRefreshInterval = 30
        notificationsEnabled = true
        notificationSound = true
        notificationBadge = true
        notificationAlert = true
        
        print("📱 설정이 기본값으로 초기화되었습니다.")
    }
}
