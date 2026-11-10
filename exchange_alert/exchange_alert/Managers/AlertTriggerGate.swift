import Foundation

/// 조건을 처음 넘는 순간에만 로컬 알림을 허용한다. 서버의 fcm-alert-logic.js와 같은 규칙이다.
enum AlertTriggerGate {
    /// 기준선 부근의 흔들림으로 알림이 반복되지 않도록, 이만큼 되돌아와야 다시 알림 가능 상태가 된다.
    private static let rearmMargin = 0.002
    private static let serverPushWindow: TimeInterval = 1800
    private static let lock = NSLock()

    private static func stateKey(_ currency: CurrencyType) -> String {
        "AlertTriggerState_\(currency.rawValue)"
    }

    static func shouldFire(currency: CurrencyType, settings: AlertSettings, rate: Double) -> Bool {
        guard settings.threshold > 0, rate > 0 else { return false }
        let (met, cleared) = evaluate(settings: settings, rate: rate)
        let signature = "\(settings.thresholdType.rawValue)|\(settings.threshold)"

        lock.lock()
        defer { lock.unlock() }

        let defaults = UserDefaults.standard
        let key = stateKey(currency)
        let stored = defaults.dictionary(forKey: key)

        // 업데이트 후 첫 확인에서는 현재 상태만 기록한다. 이미 조건을 넘은 사용자에게 알림이 몰리지 않게 하기 위함이다.
        guard let stored else {
            defaults.set(["signature": signature, "active": met], forKey: key)
            return false
        }

        // 사용자가 기준값을 바꾼 경우에는 새 기준으로 다시 판정한다.
        let isSameSignature = stored["signature"] as? String == signature
        let wasActive = isSameSignature && stored["active"] as? Bool == true

        if wasActive {
            if cleared {
                defaults.set(["signature": signature, "active": false], forKey: key)
            }
            return false
        }

        defaults.set(["signature": signature, "active": met], forKey: key)
        return met
    }

    static func wasServerPushRecentlyReceived(for currency: CurrencyType) -> Bool {
        guard let lastPush = UserDefaults.standard.object(forKey: "ServerPush_\(currency.rawValue)") as? Date else {
            return false
        }
        return Date().timeIntervalSince(lastPush) < serverPushWindow
    }

    private static func evaluate(settings: AlertSettings, rate: Double) -> (met: Bool, cleared: Bool) {
        let threshold = settings.threshold
        switch settings.thresholdType {
        case .upper:
            return (rate >= threshold, rate < threshold * (1 - rearmMargin))
        case .lower:
            return (rate <= threshold, rate > threshold * (1 + rearmMargin))
        case .both3:
            return evaluateBand(threshold: threshold, percent: 0.03, rate: rate)
        case .both:
            return evaluateBand(threshold: threshold, percent: 0.05, rate: rate)
        }
    }

    private static func evaluateBand(threshold: Double, percent: Double, rate: Double) -> (met: Bool, cleared: Bool) {
        let upper = threshold * (1 + percent)
        let lower = threshold * (1 - percent)
        return (
            rate >= upper || rate <= lower,
            rate < upper * (1 - rearmMargin) && rate > lower * (1 + rearmMargin)
        )
    }
}
