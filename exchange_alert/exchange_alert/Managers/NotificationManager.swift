import Foundation
import UserNotifications
import UIKit

// MARK: - Notification Manager
struct NotificationManager {
    static func requestPermission(completion: @escaping (Bool) -> Void) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ 알림 권한 요청 실패: \(error.localizedDescription)")
                }
                completion(granted)
            }
        }
    }
    
    static func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
    
    static func clearAllNotifications() {
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }
    
    // MARK: - 알림 권한 상태 확인
    static func getNotificationPermissionStatus(completion: @escaping (UNAuthorizationStatus) -> Void) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                completion(settings.authorizationStatus)
            }
        }
    }
    
    static func isNotificationPermissionGranted(completion: @escaping (Bool) -> Void) {
        getNotificationPermissionStatus { status in
            completion(status == .authorized || status == .provisional)
        }
    }
    
    // MARK: - 알림 히스토리 관리
    static func addNotificationToHistory(
        currency: String,
        message: String,
        type: NotificationHistory.NotificationType
    ) {
        let notification = NotificationHistory(
            date: Date(),
            currency: currency,
            message: message,
            type: type
        )
        
        var existingNotifications = NotificationHistory.loadFromUserDefaults()
        existingNotifications.insert(notification, at: 0)
        
        // 최대 100개까지만 저장
        if existingNotifications.count > 100 {
            existingNotifications = Array(existingNotifications.prefix(100))
        }
        
        NotificationHistory.saveToUserDefaults(existingNotifications)
        print("📝 알림 히스토리 추가: \(message)")
    }
    
    static func sendTestNotification() {
        // 먼저 알림 권한 상태 확인
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            DispatchQueue.main.async {
                print("📱 현재 알림 설정 상태:")
                print("   - 권한 상태: \(settings.authorizationStatus.rawValue)")
                print("   - 알림 스타일: \(settings.alertSetting.rawValue)")
                print("   - 소리 설정: \(settings.soundSetting.rawValue)")
                print("   - 배지 설정: \(settings.badgeSetting.rawValue)")
                
                switch settings.authorizationStatus {
                case .authorized, .provisional:
                    // 권한이 있으면 알림 발송
                    sendActualNotification()
                case .denied:
                    print("❌ 알림 권한이 거부되어 있습니다. 설정에서 권한을 허용해주세요.")
                    // 히스토리에 권한 거부 메시지 추가
                    addNotificationToHistory(
                        currency: "SYSTEM",
                        message: "알림 권한이 거부되어 있습니다. 설정에서 권한을 허용해주세요.",
                        type: .alert
                    )
                case .notDetermined:
                    print("⚠️ 알림 권한이 결정되지 않았습니다. 권한을 요청합니다.")
                    requestPermission { granted in
                        if granted {
                            sendActualNotification()
                        } else {
                            addNotificationToHistory(
                                currency: "SYSTEM",
                                message: "알림 권한 요청이 거부되었습니다.",
                                type: .alert
                            )
                        }
                    }
                case .ephemeral:
                    print("⚠️ 임시 알림 권한 상태입니다.")
                    sendActualNotification()
                @unknown default:
                    print("❌ 알 수 없는 알림 권한 상태입니다.")
                    addNotificationToHistory(
                        currency: "SYSTEM",
                        message: "알 수 없는 알림 권한 상태입니다.",
                        type: .alert
                    )
                }
            }
        }
    }
    
    private static func sendActualNotification() {
        let content = UNMutableNotificationContent()
        content.title = "테스트 알림"
        content.body = "환율알라미 알림이 정상적으로 작동합니다!"
        content.sound = .default
        content.badge = 1
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(identifier: "test-notification-\(Date().timeIntervalSince1970)", content: content, trigger: trigger)
        
        UNUserNotificationCenter.current().add(request) { error in
            DispatchQueue.main.async {
                if let error = error {
                    print("❌ 테스트 알림 발송 실패: \(error.localizedDescription)")
                    addNotificationToHistory(
                        currency: "SYSTEM",
                        message: "테스트 알림 발송 실패: \(error.localizedDescription)",
                        type: .alert
                    )
                } else {
                    print("✅ 테스트 알림 발송 성공")
                    addNotificationToHistory(
                        currency: "USD",
                        message: "테스트 알림이 발송되었습니다",
                        type: .update
                    )
                }
            }
        }
    }
}
