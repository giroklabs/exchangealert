import SwiftUI

// MARK: - App Settings View
struct AppSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        ZStack(alignment: .top) {
            AppTheme.backgroundGradient
                .onTapGesture {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // 커스텀 헤더 (내비게이션 바 대체)
                HStack {
                    AppTitleView(baseSize: 26)
                    
                    Spacer()
                    
                    Button("닫기") {
                        dismiss()
                    }
                    .foregroundColor(AppTheme.primary)
                    .font(AppTheme.bodyFont)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                
                TopSeparator()
                
                ScrollView {
                    VStack(spacing: 0) {
                        Spacer().frame(height: 20)
                        
                        // 설정 메뉴 섹션
                        settingsMenuSection
                        
                        Spacer().frame(height: 40)
                    }
                }
            }
        }
    }
    
    // MARK: - Settings Menu Section
    
    private var settingsMenuSection: some View {
        VStack(spacing: 0) {
            // 개인정보 처리방침
            MenuRow(
                icon: "hand.raised.fill",
                title: "개인정보 처리방침",
                iconColor: .green
            ) {
                if let url = URL(string: "https://giroklabs.github.io/privacy.html") {
                    UIApplication.shared.open(url)
                }
            }
            
            Divider()
                .padding(.leading, 60)
            
            // 텔레그램 채널
            MenuRow(
                icon: "paperplane.fill",
                title: "텔레그램 채널",
                iconColor: .blue
            ) {
                if let url = URL(string: "https://t.me/dollar_invest_pro") {
                    UIApplication.shared.open(url)
                }
            }
            
            Divider()
                .padding(.leading, 60)
            
            // 달러인베스트 사이트
            MenuRow(
                icon: "globe",
                title: "달러인베스트 사이트",
                iconColor: .orange
            ) {
                if let url = URL(string: "https://dollarinvest.pro") {
                    UIApplication.shared.open(url)
                }
            }
            
            Divider()
                .padding(.leading, 60)
            
            // 현재 버전
            HStack {
                Image(systemName: "info.circle.fill")
                    .foregroundColor(.gray)
                    .frame(width: 24, height: 24)
                
                Text("현재 버전")
                    .font(AppTheme.bodyFont)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Text(AppVersionHelper.versionString)
                    .font(AppTheme.bodyFont)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            
            Divider()
                .padding(.leading, 60)
            
            // 제작사
            HStack {
                Image(systemName: "building.2.fill")
                    .foregroundColor(.gray)
                    .frame(width: 24, height: 24)
                
                Text("제작사")
                    .font(AppTheme.bodyFont)
                    .foregroundColor(.primary)
                
                Spacer()
                
                Text("GIROK Labs.")
                    .font(AppTheme.bodyFont)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
        }
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .padding(.horizontal, 20)
    }
    
    // MARK: - Menu Row Component
    
    private struct MenuRow: View {
        let icon: String
        let title: String
        let iconColor: Color
        let action: () -> Void
        
        var body: some View {
            Button(action: action) {
                HStack {
                    Image(systemName: icon)
                        .foregroundColor(iconColor)
                        .frame(width: 24, height: 24)
                    
                    Text(title)
                        .font(AppTheme.bodyFont)
                        .foregroundColor(.primary)
                    
                    Spacer()
                    
                    Image(systemName: "chevron.right")
                        .foregroundColor(.secondary)
                        .font(.system(size: 14, weight: .medium))
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
            }
            .buttonStyle(PlainButtonStyle())
        }
    }
}

// MARK: - App Version Helper
struct AppVersionHelper {
    static var versionString: String {
        let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}

#Preview {
    AppSettingsView()
}

