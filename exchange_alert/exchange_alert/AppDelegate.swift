import UIKit
import UserNotifications

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 백그라운드 앱 새로고침 설정
        application.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
        print("✅ AppDelegate - 백그라운드 앱 새로고침 설정 완료")
        
        return true
    }
    
    // 백그라운드에서 앱 새로고침이 실행될 때 호출
    func application(_ application: UIApplication, performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("🔄 백그라운드 fetch 시작")
        
        // 환율 데이터 새로고침을 위한 URL 요청
        guard let url = URL(string: "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json") else {
            completionHandler(.failed)
            return
        }
        
        let task = URLSession.shared.dataTask(with: url) { data, response, error in
            if let error = error {
                print("❌ 백그라운드 fetch 실패: \(error.localizedDescription)")
                completionHandler(.failed)
                return
            }
            
            guard let data = data else {
                print("❌ 백그라운드 fetch 데이터 없음")
                completionHandler(.noData)
                return
            }
            
            // 데이터 파싱 시도
            do {
                let rates = try JSONDecoder().decode([ExchangeRate].self, from: data)
                print("✅ 백그라운드 fetch 성공: \(rates.count)개 통화 데이터 로드")
                
                // 알림 체크 로직 (간단한 버전)
                if let usdRate = rates.first(where: { $0.curUnit == "USD" }) {
                    self.checkSimpleAlert(rate: usdRate)
                }
                
                completionHandler(.newData)
            } catch {
                print("❌ 백그라운드 fetch 파싱 실패: \(error.localizedDescription)")
                completionHandler(.failed)
            }
        }
        
        task.resume()
    }
    
    // 간단한 알림 체크 (백그라운드용)
    private func checkSimpleAlert(rate: ExchangeRate) {
        guard let dealBasRString = rate.dealBasR,
              let dealBasR = Double(dealBasRString.replacingOccurrences(of: ",", with: "")) else {
            return
        }
        
        // 기본 알림 체크 (USD 기준 1400원 이상/이하)
        let threshold = 1400.0
        var shouldNotify = false
        var message = ""
        
        if dealBasR >= threshold {
            shouldNotify = true
            message = "💰 USD 매매기준율이 \(dealBasRString)원으로 기준값(\(Int(threshold))원) 이상이 되었습니다!"
        } else if dealBasR <= threshold * 0.97 { // 3% 하락
            shouldNotify = true
            message = "💸 USD 매매기준율이 \(dealBasRString)원으로 기준값에서 3% 하락했습니다!"
        }
        
        if shouldNotify {
            sendBackgroundNotification(message: message)
        }
    }
    
    // 백그라운드 알림 발송
    private func sendBackgroundNotification(message: String) {
        let content = UNMutableNotificationContent()
        content.title = "💱 환율 알림"
        content.body = message
        content.sound = .default
        content.badge = 1
        
        let request = UNNotificationRequest(
            identifier: "background_alert_\(Date().timeIntervalSince1970)",
            content: content,
            trigger: nil
        )
        
        UNUserNotificationCenter.current().add(request) { error in
            if let error = error {
                print("❌ 백그라운드 알림 발송 실패: \(error.localizedDescription)")
            } else {
                print("✅ 백그라운드 알림 발송 성공: \(message)")
            }
        }
    }
}
