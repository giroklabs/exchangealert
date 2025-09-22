import SwiftUI

struct ContentView: View {
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    
    var body: some View {
        NavigationView {
            ZStack(alignment: .top) {
                // 배경 그라데이션
                AppTheme.backgroundGradient
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // 상단 구분선
                    TopSeparator()
                        .padding(.top, 4)
                    
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            // 통화 선택
                            CurrencySelector(selectedCurrency: $exchangeManager.selectedCurrency)
                                .padding(.horizontal, 16)
                            
                            // 환율 정보 카드
                            if let rate = exchangeManager.currentRate {
                                ExchangeRateCard(rate: rate, alertSettings: exchangeManager.alertSettings)
                                    .padding(.horizontal, 16)
                            } else if exchangeManager.isLoading {
                                LoadingView()
                                    .frame(maxWidth: .infinity, maxHeight: 200)
                                    .padding(.horizontal, 16)
                            }
                            
                            // 알림 설정 카드
                            AlertSettingsCard(settings: $exchangeManager.alertSettings)
                                .padding(.horizontal, 16)
                                .onChange(of: exchangeManager.alertSettings) { newSettings in
                                    exchangeManager.updateAlertSettings(newSettings)
                                }
                            
                            // 새로고침 버튼
                            GradientButton(
                                title: "새로고침",
                                icon: "arrow.clockwise",
                                action: {
                                    exchangeManager.refresh()
                                }
                            )
                            .padding(.horizontal, 16)
                            
                            // 마지막 업데이트 시간
                            if let rate = exchangeManager.currentRate {
                                LastUpdateView()
                                    .padding(.horizontal, 16)
                            }
                        }
                        .padding(.top, 8)
                        .padding(.bottom, 20)
                    }
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    AppTitleView(baseSize: 26)
                        .padding(.top, 12)
                }
            }
        }
        .onAppear {
            if exchangeManager.currentRate == nil {
                exchangeManager.fetchExchangeRate()
            }
        }
        .safeAreaInset(edge: .bottom) {
            VStack(spacing: 4) {
                // 광고 배너 자리 (nainai 앱과 동일한 크기)
                AdBannerPlaceholder()
                    .frame(maxWidth: .infinity, maxHeight: 50)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 6)
                
                SignatureView()
            }
        }
    }
}

// MARK: - Error State View
struct ErrorStateView: View {
    let message: String
    let action: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 50))
                .foregroundColor(AppTheme.error)
            
            Text("오류 발생")
                .font(.title2)
                .fontWeight(.semibold)
                .foregroundColor(.primary)
            
            Text(message)
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 20)
            
            GradientButton(
                title: "다시 시도",
                icon: "arrow.clockwise",
                action: action
            )
        }
        .padding(.vertical, 40)
    }
}

// MARK: - Last Update View
struct LastUpdateView: View {
    var body: some View {
        HStack {
            Image(systemName: "clock")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Text("마지막 업데이트: \(Date().formatted(date: .omitted, time: .shortened))")
                .font(.caption)
                .foregroundColor(.secondary)
            
            Spacer()
        }
    }
}

// MARK: - Top Separator
struct TopSeparator: View {
    @Environment(\.colorScheme) private var colorScheme
    
    var body: some View {
        Rectangle()
            .fill(Color(UIColor.separator).opacity(colorScheme == .dark ? 0.25 : 0.18))
            .frame(height: 0.75)
            .cornerRadius(0.5)
            .padding(.horizontal, 12)
    }
}

// MARK: - Gradient Circle Button
struct GradientCircleButton: View {
    let systemName: String
    let action: () -> Void
    var size: CGFloat = 30
    
    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .fill(AppTheme.primaryGradient)
                    .frame(width: size, height: size)
                
                Image(systemName: systemName)
                    .font(.system(size: size * 0.5, weight: .bold))
                    .foregroundColor(.white)
            }
        }
        .buttonStyle(ScaleButtonStyle())
        .shadow(color: AppTheme.buttonShadow, radius: 8, x: 0, y: 2)
    }
}

#Preview {
    ContentView()
        .environmentObject(ExchangeRateManager())
}
