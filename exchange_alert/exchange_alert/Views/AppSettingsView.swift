import SwiftUI

// MARK: - App Settings View
struct AppSettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var proStore = ProStore.shared
    @State private var showingPro = false
    
    var body: some View {
        ZStack(alignment: .top) {
            AppTheme.backgroundGradient
                .onTapGesture {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // 커스텀 헤더 (내비게이션 바 대체)
                SheetHeader(title: "설정", onClose: { dismiss() })

                ScrollView {
                    VStack(spacing: 0) {
                        Spacer().frame(height: 20)

                        if ProStore.isFeatureEnabled {
                            proRow
                                .padding(.horizontal, 16)
                                .padding(.bottom, 20)
                        }

                        // 설정 메뉴 섹션
                        settingsMenuSection
                        
                        Spacer().frame(height: 40)
                    }
                }
            }
        }
    }
    
    // MARK: - Pro

    private var proRow: some View {
        Button { showingPro = true } label: {
            HStack(spacing: 14) {
                Image("AppLogo")
                    .resizable()
                    .frame(width: 40, height: 40)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text("환율알라미 프로")
                        .font(AppTheme.headlineFont)
                        .foregroundColor(.primary)
                    Text(proStore.isPro ? "사용 중 · 감사합니다" : "광고 제거 · 위젯 · 차트 평단선")
                        .font(AppTheme.subheadlineFont)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Image(systemName: proStore.isPro ? "checkmark.seal.fill" : "chevron.right")
                    .foregroundColor(proStore.isPro ? AppTheme.accentText : .secondary)
            }
            .padding(16)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(14)
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $showingPro) { ProView() }
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

