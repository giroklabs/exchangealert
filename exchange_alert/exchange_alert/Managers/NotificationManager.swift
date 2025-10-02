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
        let content = UNMutableNotificationContent()
        content.title = "테스트 알림"
        content.body = "환율알라미 알림이 정상적으로 작동합니다!"
        content.sound = .default
        
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        let request = UNNotificationRequest(identifier: "test-notification", content: content, trigger: trigger)
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ 테스트 알림 발송 실패: \(error.localizedDescription)")
            } else {
                print("✅ 테스트 알림 발송 성공")
                // 테스트 알림을 히스토리에 추가
                addNotificationToHistory(
                    currency: "USD",
                    message: "테스트 알림이 발송되었습니다",
                    type: .update
                )
            }
        }
    }
}
