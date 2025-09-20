import SwiftUI

// MARK: - App Theme (nainai 스타일 참조)
struct AppTheme {
    // 메인 컬러
    static let primary = Color.blue
    static let primaryLight = Color.cyan
    static let primaryDark = Color.blue.opacity(0.7)
    
    // 세컨더리 컬러
    static let secondary = Color.green
    static let secondaryLight = Color.green.opacity(0.8)
    
    // 환율 상태별 컬러
    static let rising = Color.red
    static let falling = Color.blue
    static let stable = Color.gray
    
    // 성공/경고 컬러
    static let success = Color.green
    static let warning = Color.orange
    static let error = Color.red
    
    // 그라데이션
    static let primaryGradient = LinearGradient(
        gradient: Gradient(colors: [primary, primaryLight]),
        startPoint: .leading,
        endPoint: .trailing
    )
    
    static let exchangeGradient = LinearGradient(
        gradient: Gradient(colors: [Color.blue, Color.cyan]),
        startPoint: .leading,
        endPoint: .trailing
    )
    
    static let backgroundGradient = LinearGradient(
        gradient: Gradient(colors: [
            Color(.systemGroupedBackground),
            Color(.secondarySystemGroupedBackground)
        ]),
        startPoint: .top,
        endPoint: .bottom
    )
    
    // 그림자
    static let cardShadow = Color.black.opacity(0.06)
    static let buttonShadow = Color.blue.opacity(0.3)
    
    // 코너 반경
    static let cornerRadius: CGFloat = 16
    static let buttonCornerRadius: CGFloat = 28
    static let cardCornerRadius: CGFloat = 16
    
    // 패딩
    static let padding: CGFloat = 20
    static let smallPadding: CGFloat = 12
    static let largePadding: CGFloat = 24
    
    // 폰트 크기
    static let titleFont = Font.custom("MaruBuri-Bold", size: 24)
    static let headlineFont = Font.custom("MaruBuri-Light", size: 18)
    static let bodyFont = Font.custom("MaruBuri-Light", size: 16)
    static let captionFont = Font.custom("MaruBuri-Light", size: 12)
    
    // 추가 폰트 스타일
    static let largeTitleFont = Font.custom("MaruBuri-Bold", size: 36)
    static let subheadlineFont = Font.custom("MaruBuri-Light", size: 14)
    static let footnoteFont = Font.custom("MaruBuri-Light", size: 10)
}

// MARK: - Exchange Rate Color Helper
struct ExchangeColorHelper {
    static func colorForTrend(_ trend: ExchangeTrend) -> Color {
        switch trend {
        case .rising:
            return AppTheme.rising
        case .falling:
            return AppTheme.falling
        case .stable:
            return AppTheme.stable
        }
    }
    
    static func colorForRate(_ rate: Double, upperThreshold: Double, lowerThreshold: Double) -> Color {
        if rate >= upperThreshold {
            return AppTheme.rising
        } else if rate <= lowerThreshold {
            return AppTheme.falling
        } else {
            return AppTheme.stable
        }
    }
}

// MARK: - Animation Helper
struct AnimationHelper {
    static let quick = Animation.easeInOut(duration: 0.1)
    static let smooth = Animation.easeInOut(duration: 0.2)
    static let bouncy = Animation.spring(response: 0.3, dampingFraction: 0.6)
}
