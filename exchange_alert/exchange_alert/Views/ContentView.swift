import SwiftUI

struct ContentView: View {
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    @State private var showingSettings = false
    @State private var showingCalculator = false
    @State private var showingNotifications = false
    
    var body: some View {
        ZStack {
            // 1. 메인 콘텐츠 뷰 (키보드 나타날 때 정상적으로 줄어듦)
            ZStack(alignment: .top) {
                // 배경 그라데이션
                AppTheme.backgroundGradient
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // 커스텀 헤더 (내비게이션 바 대체)
                    HStack {
                        AppTitleView(baseSize: 26)
                        
                        Spacer()
                        
                        HStack(spacing: 16) {
                            // 환차익 계산기 버튼
                            Button(action: {
                                showingCalculator = true
                            }) {
                                Image(systemName: "plus.forwardslash.minus")
                                    .font(.system(size: 20, weight: .medium))
                                    .foregroundColor(.yellow)
                            }
                            
                            // 알림 센터 버튼
                            Button(action: {
                                showingNotifications = true
                            }) {
                                Image(systemName: "bell.fill")
                                    .font(.system(size: 20, weight: .medium))
                                    .foregroundColor(.yellow)
                            }
                            
                            // 설정 버튼
                            Button(action: {
                                showingSettings = true
                            }) {
                                Image(systemName: "gearshape.fill")
                                    .font(.system(size: 20, weight: .medium))
                                    .foregroundColor(.yellow)
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    
                    // 상단 구분선
                    TopSeparator()
                    
                    ScrollView {
                        ZStack(alignment: .top) {
                            LazyVStack(spacing: 16) {
                                // 환율 정보 카드
                                if let rate = exchangeManager.currentRate {
                                    ExchangeRateCard(rate: rate, alertSettings: exchangeManager.currentAlertSettings, selectedCurrency: $exchangeManager.selectedCurrency)
                                        .padding(.horizontal, 16)
                                        .opacity(exchangeManager.isLoading ? 0.6 : 1.0)
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
                                    .opacity(exchangeManager.isLoading ? 0.6 : 1.0)
                                
                                // 마지막 업데이트 시간
                                if exchangeManager.currentRate != nil {
                                    LastUpdateView()
                                        .padding(.horizontal, 16)
                                        .padding(.top, -11)
                                }
                            }
                            .padding(.top, 8)
                            .padding(.bottom, 20)
                            
                            // 당겨서 새로고침 외의 로딩 시 표시할 오버레이
                            if exchangeManager.isLoading && exchangeManager.currentRate != nil {
                                ProgressView()
                                    .scaleEffect(1.2)
                                    .padding(.top, 40)
                                    .transition(.opacity)
                            }
                        }
                    }
                    .refreshable {
                        await refreshData()
                    }
                }
                .padding(.bottom, 50) // 하단 배너 공간 확보
            }
            .onTapGesture {
                // 배경 탭 시 키보드 내리기
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            }
            
            // 2. 하단 배너 뷰 (키보드를 무시하고 항상 맨 아래 고정)
            VStack {
                Spacer()
                AdMobBannerView(adUnitID: "ca-app-pub-4376736198197573/9991728010")
                    .frame(height: 50)
                    .frame(maxWidth: .infinity)
                    .background(Color.clear)
            }
            .ignoresSafeArea(.keyboard, edges: .bottom) // 키보드가 올라올 때 밀려 올라가지 않음
        }

        .sheet(isPresented: $showingSettings) {
            AppSettingsView()
        }
        .sheet(isPresented: $showingCalculator) {
            ProfitCalculatorView()
                .environmentObject(exchangeManager)
        }
        .sheet(isPresented: $showingNotifications) {
            NotificationManagementPopup(isPresented: $showingNotifications)
                .environmentObject(exchangeManager)
        }
        .onAppear {
            if exchangeManager.currentRate == nil {
                exchangeManager.fetchExchangeRate()
            }
        }
    }
    
    // MARK: - Pull-to-Refresh 함수
    private func refreshData() async {
        print("🔄 Pull-to-Refresh: 최신 데이터 갱신 시작")
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async {
                // Pull-to-Refresh 전용 함수 사용 (강제 즉시 업데이트)
                exchangeManager.pullToRefresh()
                
                // 사용자 피드백을 위한 최소 딜레이 (0.5초)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    continuation.resume()
                }
            }
        }
        print("✅ Pull-to-Refresh: 데이터 갱신 완료")
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
                            Text(exchangeManager.currentRate?.tts ?? "--")
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
                
                Text("데이터 출처: 은행 고시 환율 (실시간)")
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
