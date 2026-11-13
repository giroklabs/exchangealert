import SwiftUI

struct WatchTheme {
    static let primary = Color.yellow
    static let primaryGradient = LinearGradient(
        gradient: Gradient(colors: [primary, primary.opacity(0.8)]),
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
    
    static let rising = Color.red
    static let falling = Color.blue
    static let stable = Color.gray
    
    // WatchOS 전용 폰트 설정 (기본 San Francisco 폰트 사용 또는 MaruBuri가 있다면 그것 사용)
    static func titleFont(size: CGFloat = 16) -> Font {
        return Font.custom("MaruBuri-Bold", size: size)
    }
    
    static func bodyFont(size: CGFloat = 14) -> Font {
        return Font.custom("MaruBuri-Light", size: size)
    }
    
    static func captionFont(size: CGFloat = 12) -> Font {
        return Font.custom("MaruBuri-Light", size: size)
    }
}
