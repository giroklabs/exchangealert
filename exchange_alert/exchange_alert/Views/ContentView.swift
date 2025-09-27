import SwiftUI

struct ContentView: View {
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    @State private var isKeyboardVisible = false
    
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
                            // 환율 정보 카드
                            if let rate = exchangeManager.currentRate {
                                ExchangeRateCard(rate: rate, alertSettings: exchangeManager.currentAlertSettings, selectedCurrency: $exchangeManager.selectedCurrency)
                                    .padding(.horizontal, 16)
                            } else if exchangeManager.isLoading {
                                LoadingView()
                                    .frame(maxWidth: .infinity, maxHeight: 200)
                                    .padding(.horizontal, 16)
                            } else if let errorMessage = exchangeManager.errorMessage {
                                ErrorStateView(message: errorMessage) {
                                    exchangeManager.refresh()
                                }
                                .padding(.horizontal, 16)
                            } else {
                                // 환율 데이터가 없을 때 기본 카드 표시
                                DefaultExchangeCard(selectedCurrency: $exchangeManager.selectedCurrency)
                                    .padding(.horizontal, 16)
                            }
                            
                            // 알림 설정 카드
                            AlertSettingsCard(currency: exchangeManager.selectedCurrency)
                                .padding(.horizontal, 16)
                            
                            
                            // 마지막 업데이트 시간
                            if exchangeManager.currentRate != nil {
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
            // 키보드가 보이지 않을 때만 광고 배너 표시
            if !isKeyboardVisible {
                VStack(spacing: 4) {
                    // 제조사 로고 (우측정렬)
                    HStack {
                        Spacer()
                        SignatureView()
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 4)
                    
                    // 광고 배너 자리 (nainai 앱과 동일한 크기)
                    AdBannerPlaceholder()
                        .frame(maxWidth: .infinity, maxHeight: 50)
                        .padding(.horizontal, 16)
                        .padding(.bottom, 6)
                }
            }
        }
        .onTapGesture {
            // 배경 탭 시 키보드 내리기
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            DispatchQueue.main.async {
                isKeyboardVisible = true
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            DispatchQueue.main.async {
                isKeyboardVisible = false
            }
        }
    }
}

// MARK: - Default Exchange Card
struct DefaultExchangeCard: View {
    @Binding var selectedCurrency: CurrencyType
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    
    var body: some View {
        CardView(cornerRadius: 16, shadowRadius: 8) {
            VStack(spacing: 16) {
                // 헤더
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        // 통화 선택 드롭다운
                        Menu {
                            ForEach(CurrencyType.allCases, id: \.self) { currency in
                                Button(action: {
                                    DispatchQueue.main.async {
                                        exchangeManager.changeCurrency(to: currency)
                                    }
                                }) {
                                    HStack {
                                        Text(currency.symbol)
                                        Text(currency.rawValue)
                                        Text(currency.displayName)
                                        if selectedCurrency == currency {
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                }
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Text(selectedCurrency.rawValue)
                                    .font(AppTheme.titleFont)
                                    .foregroundColor(.primary)
                                
                                Text("/KRW")
                                    .font(AppTheme.titleFont)
                                    .foregroundColor(.primary)
                                
                                Image(systemName: "chevron.down")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(.secondary)
                            }
                        }
                        
                        Text(selectedCurrency.displayName)
                            .font(AppTheme.captionFont)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    // 환율 상태 아이콘
                    ZStack {
                        Circle()
                            .fill(AppTheme.primary.opacity(0.1))
                            .frame(width: 50, height: 50)
                        
                        Image(systemName: "dollarsign.circle.fill")
                            .font(.title2)
                            .foregroundColor(AppTheme.primary)
                    }
                }
                
                // 매매기준율 (메인) - 데이터 없음 표시
                VStack(spacing: 8) {
                    Text("매매기준율")
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                    
                    Text("데이터 로딩 중...")
                        .font(AppTheme.largeTitleFont)
                        .foregroundColor(.secondary)
                    
                    Text("원")
                        .font(AppTheme.headlineFont)
                        .foregroundColor(.secondary)
                }
                
                // TTB/TTS 상세 정보 (서브)
                VStack(spacing: 12) {
                    Text("현찰 환율")
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                    
                    HStack(spacing: 20) {
                        VStack(spacing: 4) {
                            Text("TTB (살 때)")
                                .font(AppTheme.captionFont)
                                .foregroundColor(.secondary)
                            Text("--원")
                                .font(AppTheme.headlineFont)
                                .foregroundColor(.secondary)
                        }
                        
                        Divider()
                            .frame(height: 30)
                        
                        VStack(spacing: 4) {
                            Text("TTS (팔 때)")
                                .font(AppTheme.captionFont)
                                .foregroundColor(.secondary)
                            Text("--원")
                                .font(AppTheme.headlineFont)
                                .foregroundColor(.secondary)
                        }
                    }
                }
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
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    
    private func formatLastUpdateTime() -> String {
        let calendar = Calendar.current
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        
        // 주말인 경우 마지막 평일 데이터 기준일 표시
        if exchangeManager.isWeekendMode {
            // 주말에는 항상 마지막 금요일 날짜 표시
            let today = Date()
            let weekday = calendar.component(.weekday, from: today)
            
            // 토요일(7)인 경우 금요일 표시, 일요일(1)인 경우 금요일 표시
            if weekday == 7 || weekday == 1 {
                let daysToSubtract = weekday == 7 ? 1 : 2 // 토요일은 1일, 일요일은 2일 빼기
                let friday = calendar.date(byAdding: .day, value: -daysToSubtract, to: today) ?? today
                formatter.dateFormat = "yyyy.M.d.(E)"
                return formatter.string(from: friday)
            }
        }
        
        // 평일이거나 주말 모드가 아닌 경우 현재 시간 표시
        if let lastUpdate = exchangeManager.lastUpdateTime {
            formatter.dateFormat = "yyyy.M.d.(E) HH:mm"
            return formatter.string(from: lastUpdate)
        }
        
        // 기본값
        formatter.dateFormat = "yyyy.M.d.(E) HH:mm"
        return formatter.string(from: Date())
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Image(systemName: "clock")
                    .font(AppTheme.captionFont)
                    .foregroundColor(.secondary)
                
                Text("마지막 업데이트: \(formatLastUpdateTime())")
                    .font(AppTheme.captionFont)
                    .foregroundColor(.secondary)
                
                Spacer()
            }
            
            HStack {
                Image(systemName: "server.rack")
                    .font(AppTheme.captionFont)
                    .foregroundColor(.secondary)
                
                Text("데이터 출처: \(exchangeManager.currentApiSource)")
                    .font(AppTheme.captionFont)
                    .foregroundColor(.secondary)
                
                Spacer()
            }
            
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
