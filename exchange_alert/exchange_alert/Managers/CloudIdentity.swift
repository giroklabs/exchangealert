import Foundation
import FirebaseAppCheck
import FirebaseAuth

/// Firestore 보안 규칙 강화를 위한 준비.
/// - 익명 로그인: 알림 문서에 사용자 식별값(uid)을 남겨, 나중에 "본인 문서만 쓰기" 규칙을 적용할 수 있게 한다.
/// - App Check: 정식 앱에서 온 요청인지 증명한다. 콘솔에서 차단(enforce)을 켜기 전까지는 기록만 된다.
/// 두 기능 모두 실패해도 앱 동작과 알림 동기화에는 영향을 주지 않는다.
enum CloudIdentity {
    static let readyNotification = Notification.Name("CloudIdentityReady")

    /// FirebaseApp.configure()보다 먼저 호출해야 한다.
    static func configureAppCheck() {
        #if DEBUG
        // 개발 빌드는 콘솔에 등록한 디버그 토큰으로 검증한다. (토큰은 실행 로그에 출력됨)
        AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
        #else
        AppCheck.setAppCheckProviderFactory(DeviceCheckProviderFactory())
        #endif
    }

    static var uid: String? {
        Auth.auth().currentUser?.uid
    }

    /// 이미 로그인돼 있으면 아무것도 하지 않는다. 익명 계정은 앱 삭제 전까지 기기에 유지된다.
    static func signInIfNeeded() {
        guard Auth.auth().currentUser == nil else { return }
        Auth.auth().signInAnonymously { _, error in
            if let error {
                // Firebase 콘솔에서 익명 로그인이 꺼져 있으면 여기로 온다. uid 없이 기존 방식대로 동기화된다.
                let nsError = error as NSError
                let detail = (nsError.userInfo[NSUnderlyingErrorKey] as? NSError)?.userInfo ?? nsError.userInfo
                print("⚠️ [Auth] 익명 로그인 실패 (\(nsError.code)): \(detail)")
                return
            }
            print("✅ [Auth] 익명 로그인 완료")
            // 기존 알림 문서에 uid를 채우기 위해 한 번 다시 동기화한다.
            NotificationCenter.default.post(name: readyNotification, object: nil)
        }
    }
}
