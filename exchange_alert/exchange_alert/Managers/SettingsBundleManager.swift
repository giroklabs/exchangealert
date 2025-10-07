import Foundation
import UIKit
import BackgroundTasks

class SettingsBundleManager: ObservableObject {
    static let shared = SettingsBundleManager()
    
    private let userDefaults = UserDefaults.standard
    
    private init() {
        // 설정 변경 감지
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(defaultsChanged),
            name: UserDefaults.didChangeNotification,
            object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - 설정값 읽기
    
    /// 백그라운드 새로고침 활성화 여부
    var backgroundRefreshEnabled: Bool {
        get {
            return userDefaults.bool(forKey: "backgroundRefreshEnabled")
        }
        set {
            userDefaults.set(newValue, forKey: "backgroundRefreshEnabled")
            updateBackgroundRefreshStatus(enabled: newValue)
        }
    }
    
    /// 알림 허용 여부
    var notificationsEnabled: Bool {
        get {
            return userDefaults.bool(forKey: "notificationsEnabled")
        }
        set {
            userDefaults.set(newValue, forKey: "notificationsEnabled")
        }
    }
    
    /// 새로고침 주기 (분)
    var refreshInterval: Int {
        get {
            let interval = userDefaults.integer(forKey: "refreshInterval")
            return interval > 0 ? interval : 15 // 기본값 15분
        }
        set {
            userDefaults.set(newValue, forKey: "refreshInterval")
        }
    }
    
    /// USD 상한선
    var usdUpperThreshold: Double {
        get {
            let value = userDefaults.double(forKey: "usdUpperThreshold")
            return value > 0 ? value : 1400.0 // 기본값 1400
        }
        set {
            userDefaults.set(newValue, forKey: "usdUpperThreshold")
        }
    }
    
    /// USD 하한선
    var usdLowerThreshold: Double {
        get {
            let value = userDefaults.double(forKey: "usdLowerThreshold")
            return value > 0 ? value : 1350.0 // 기본값 1350
        }
        set {
            userDefaults.set(newValue, forKey: "usdLowerThreshold")
        }
    }
    
    // MARK: - 설정 변경 감지
    
    @objc private func defaultsChanged() {
        print("📱 Settings.bundle 설정 변경 감지")
        
        // 백그라운드 새로고침 상태 업데이트
        updateBackgroundRefreshStatus(enabled: backgroundRefreshEnabled)
        
        // 알림 설정 업데이트
        if !notificationsEnabled {
            print("🔕 사용자가 알림을 비활성화함")
        }
        
        // 새로고침 주기 업데이트
        print("⏰ 새로고침 주기 변경: \(refreshInterval)분")
        
        // 임계값 업데이트
        print("📊 USD 상한선: \(usdUpperThreshold), 하한선: \(usdLowerThreshold)")
    }
    
    // MARK: - 백그라운드 새로고침 상태 업데이트
    
    private func updateBackgroundRefreshStatus(enabled: Bool) {
        DispatchQueue.main.async {
            if enabled {
                print("✅ 백그라운드 새로고침 활성화됨")
                
                // iOS 13+에서는 BackgroundTasks 프레임워크만 사용
                if #available(iOS 13.0, *) {
                    self.scheduleBackgroundTask()
                } else {
                    // iOS 12 이하에서만 setMinimumBackgroundFetchInterval 사용
                    UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
                }
            } else {
                print("❌ 백그라운드 새로고침 비활성화됨")
                
                // iOS 13+에서는 BackgroundTasks 프레임워크만 사용
                if #available(iOS 13.0, *) {
                    self.cancelBackgroundTask()
                } else {
                    // iOS 12 이하에서만 setMinimumBackgroundFetchInterval 사용
                    UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalNever)
                }
            }
        }
    }
    
    // MARK: - iOS 13+ 백그라운드 작업 관리
    
    @available(iOS 13.0, *)
    private func scheduleBackgroundTask() {
        let request = BGAppRefreshTaskRequest(identifier: "com.exchangealert.refresh")
        request.earliestBeginDate = Date(timeIntervalSinceNow: TimeInterval(refreshInterval * 60))
        
        do {
            try BGTaskScheduler.shared.submit(request)
            print("✅ Settings.bundle에서 백그라운드 작업 스케줄링 성공 (\(refreshInterval)분 후)")
        } catch {
            print("❌ Settings.bundle에서 백그라운드 작업 스케줄링 실패: \(error)")
        }
    }
    
    @available(iOS 13.0, *)
    private func cancelBackgroundTask() {
        BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: "com.exchangealert.refresh")
        print("🚫 Settings.bundle에서 백그라운드 작업 취소")
    }
    
    // MARK: - 앱 정보 업데이트
    
    /// 마지막 업데이트 시간을 설정
    func updateLastUpdateTime() {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        let timeString = formatter.string(from: Date())
        
        userDefaults.set(timeString, forKey: "lastUpdateTime")
        print("📅 마지막 업데이트 시간 설정: \(timeString)")
    }
    
    /// 설정값 초기화
    func resetToDefaults() {
        let defaults: [String: Any] = [
            "backgroundRefreshEnabled": true,
            "notificationsEnabled": true,
            "refreshInterval": 15,
            "usdUpperThreshold": 1400.0,
            "usdLowerThreshold": 1350.0
        ]
        
        for (key, value) in defaults {
            userDefaults.set(value, forKey: key)
        }
        
        print("🔄 설정값을 기본값으로 초기화")
        updateBackgroundRefreshStatus(enabled: true)
    }
    
    // MARK: - 설정 앱 열기
    
    /// iOS 설정 앱에서 앱 설정 열기
    func openAppSettings() {
        if let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(settingsUrl)
        }
    }
}
