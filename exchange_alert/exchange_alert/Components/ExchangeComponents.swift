import SwiftUI


// MARK: - Exchange Rate Card
struct ExchangeRateCard: View {
    let rate: ExchangeRate
    let alertSettings: AlertSettings
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
                                    exchangeManager.changeCurrency(to: currency)
                                }) {
                                    HStack {
                                        Text("\(currency.symbol)(\(currency.displayName))")
                                            .font(AppTheme.bodyFont)
                                        Spacer()
                                        if selectedCurrency == currency {
                                            Image(systemName: "checkmark")
                                                .foregroundColor(AppTheme.primary)
                                        }
                                    }
                                    .padding(.vertical, 4)
                                }
                            }
                        } label: {
                            HStack(spacing: 4) {
                                Text(rate.curUnit ?? "USD")
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
                        
                        Text(rate.curNm ?? "대한민국 원")
                            .font(AppTheme.captionFont)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    // 환율 상태 아이콘
                    ExchangeStatusIcon(rate: rate, alertSettings: alertSettings)
                }
                
                // 모든 통화를 매매기준율, 살때, 팔때 형태로 표시
                VStack(spacing: 12) {
                    // 매매기준율 (메인)
                    if let dealBasR = rate.dealBasR {
                        let cleanedRate = dealBasR.replacingOccurrences(of: ",", with: "")
                        if let rateValue = Double(cleanedRate) {
                            VStack(spacing: 8) {
                                Text("매매기준율")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(.secondary)
                                
                                HStack(alignment: .bottom, spacing: 8) {
                                    // 현재 환율
                                    Text("\(String(format: "%.2f", rateValue))")
                                        .font(AppTheme.largeTitleFont)
                                        .foregroundColor(ExchangeColorHelper.colorForRate(
                                            rateValue,
                                            threshold: alertSettings.threshold,
                                            thresholdType: alertSettings.thresholdType
                                        ))
                                    
                                    Text("원")
                                        .font(AppTheme.headlineFont)
                                        .foregroundColor(.secondary)
                                    
                                    // 일일 변동 정보
                                    if let dailyChange = exchangeManager.dailyChanges[selectedCurrency] {
                                        HStack(spacing: 4) {
                                            // 변동 아이콘
                                            Image(systemName: dailyChange.isPositive ? "arrow.up.right" : "arrow.down.right")
                                                .font(.caption)
                                                .foregroundColor(dailyChange.isPositive ? .red : .blue)
                                            
                                            // 변동값과 변동률
                                            VStack(alignment: .trailing, spacing: 2) {
                                                Text(dailyChange.changeValueString)
                                                    .font(.caption)
                                                    .foregroundColor(dailyChange.isPositive ? .red : .blue)
                                                
                                                Text(dailyChange.changePercentString)
                                                    .font(.caption2)
                                                    .foregroundColor(dailyChange.isPositive ? .red : .blue)
                                            }
                                        }
                                    }
                                    
                                    Spacer()
                                }
                            }
                        }
                    }
                    
                    // TTB/TTS 상세 정보 (서브) - 모든 통화에서 표시
                    ExchangeBuySeelView(rate: rate)
                }
            }
        }
    }
}

// MARK: - Exchange Status Icon
struct ExchangeStatusIcon: View {
    let rate: ExchangeRate
    let alertSettings: AlertSettings
    
    var body: some View {
        if let currentRate = rate.dealBasR, let rateValue = Double(currentRate.replacingOccurrences(of: ",", with: "")) {
            let color = ExchangeColorHelper.colorForRate(
                rateValue,
                threshold: alertSettings.threshold,
                thresholdType: alertSettings.thresholdType
            )
            
            ZStack {
                Circle()
                    .fill(color.opacity(0.1))
                    .frame(width: 50, height: 50)
                
                Image(systemName: iconForRate(rateValue))
                    .font(.title2)
                    .foregroundColor(color)
            }
        }
    }
    
    private func iconForRate(_ rate: Double) -> String {
        switch alertSettings.thresholdType {
        case .upper:
            return rate >= alertSettings.threshold ? "arrow.up.right.circle.fill" : "minus.circle.fill"
        case .lower:
            return rate <= alertSettings.threshold ? "arrow.down.right.circle.fill" : "minus.circle.fill"
        case .both3:
            let upperThreshold = alertSettings.threshold * 1.03  // 기준값의 103%
            let lowerThreshold = alertSettings.threshold * 0.97  // 기준값의 97%
            if rate >= upperThreshold {
                return "arrow.up.right.circle.fill"
            } else if rate <= lowerThreshold {
                return "arrow.down.right.circle.fill"
            } else {
                return "minus.circle.fill"
            }
        case .both:
            let upperThreshold = alertSettings.threshold * 1.05  // 기준값의 105%
            let lowerThreshold = alertSettings.threshold * 0.95  // 기준값의 95%
            if rate >= upperThreshold {
                return "arrow.up.right.circle.fill"
            } else if rate <= lowerThreshold {
                return "arrow.down.right.circle.fill"
            } else {
                return "minus.circle.fill"
            }
        }
    }
}

// MARK: - Alert Settings Card
struct AlertSettingsCard: View {
    let currency: CurrencyType
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    
    private var settings: AlertSettings {
        exchangeManager.currencyAlertSettings.getSettings(for: currency)
    }
    
    var body: some View {
        CardView(cornerRadius: 16, shadowRadius: 8) {
            VStack(spacing: 16) {
                HStack {
                    Image(systemName: "bell.fill")
                        .foregroundColor(AppTheme.primary)
                        .font(AppTheme.headlineFont)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text("알림 설정")
                            .font(AppTheme.headlineFont)
                    }
                    
                    Spacer()
                    
                    Toggle("", isOn: Binding(
                        get: { settings.isEnabled },
                        set: { newValue in
                            var updatedSettings = settings
                            updatedSettings.isEnabled = newValue
                            exchangeManager.updateAlertSettings(updatedSettings, for: currency)
                        }
                    ))
                    .toggleStyle(SwitchToggleStyle(tint: AppTheme.primary))
                }
                
                if settings.isEnabled {
                    VStack(spacing: 12) {
                        // 알림 타입 설정
                        VStack(alignment: .leading, spacing: 8) {
                            Text("알림 타입")
                                .font(AppTheme.subheadlineFont)
                            
                            Picker("알림 타입", selection: Binding(
                                get: { settings.thresholdType },
                                set: { newValue in
                                    var updatedSettings = settings
                                    updatedSettings.thresholdType = newValue
                                    exchangeManager.updateAlertSettings(updatedSettings, for: currency)
                                }
                            )) {
                                ForEach(ThresholdType.allCases, id: \.self) { type in
                                    Text(type.rawValue).tag(type)
                                }
                            }
                            .pickerStyle(.segmented)
                            .font(AppTheme.bodyFont)
                            
                            Text(settings.thresholdType.description)
                                .font(AppTheme.captionFont)
                                .foregroundColor(.secondary)
                        }
                        
                        // 기준값 설정
                        VStack(alignment: .leading, spacing: 8) {
                            Text("기준값 (원)")
                                .font(AppTheme.subheadlineFont)
                            
                            HStack {
                                TextField("기준값", value: Binding(
                                    get: { settings.threshold },
                                    set: { newValue in
                                        var updatedSettings = settings
                                        updatedSettings.threshold = newValue
                                        exchangeManager.updateAlertSettings(updatedSettings, for: currency)
                                    }
                                ), format: .number)
                                .textFieldStyle(CustomTextFieldStyle())
                                .keyboardType(.decimalPad)
                                .font(AppTheme.bodyFont)
                                .toolbar {
                                    ToolbarItemGroup(placement: .keyboard) {
                                        Spacer()
                                        Button("완료") {
                                            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                                        }
                                    }
                                }
                                
                                Text("원")
                                    .font(AppTheme.captionFont)
                                    .foregroundColor(.secondary)
                            }
                        }
                        
                        
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
    }
}

// MARK: - Custom Text Field Style
struct CustomTextFieldStyle: TextFieldStyle {
    func _body(configuration: TextField<Self._Label>) -> some View {
        configuration
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(.systemGray6))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(Color(.systemGray4), lineWidth: 0.5)
            )
    }
}

// MARK: - Card View
struct CardView<Content: View>: View {
    let content: Content
    let cornerRadius: CGFloat
    let shadowRadius: CGFloat
    let backgroundColor: Color
    
    init(
        cornerRadius: CGFloat = AppTheme.cardCornerRadius,
        shadowRadius: CGFloat = 8,
        backgroundColor: Color = Color(.secondarySystemBackground),
        @ViewBuilder content: () -> Content
    ) {
        self.cornerRadius = cornerRadius
        self.shadowRadius = shadowRadius
        self.backgroundColor = backgroundColor
        self.content = content()
    }
    
    var body: some View {
        content
            .padding(AppTheme.smallPadding)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(backgroundColor)
                    .shadow(
                        color: AppTheme.cardShadow,
                        radius: shadowRadius,
                        x: 0,
                        y: 2
                    )
            )
    }
}

// MARK: - Gradient Button
struct GradientButton: View {
    let title: String
    let icon: String?
    let action: () -> Void
    let isEnabled: Bool
    let gradient: LinearGradient
    
    init(
        title: String,
        icon: String? = nil,
        isEnabled: Bool = true,
        gradient: LinearGradient = AppTheme.primaryGradient,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.icon = icon
        self.isEnabled = isEnabled
        self.gradient = gradient
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.title3)
                        .fontWeight(.semibold)
                }
                
                Text(title)
                    .font(AppTheme.headlineFont)
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 56)
            .background(gradient)
            .cornerRadius(AppTheme.cornerRadius)
            .opacity(isEnabled ? 1.0 : 0.6)
        }
        .disabled(!isEnabled)
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: - Scale Button Style
struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
            .animation(AnimationHelper.quick, value: configuration.isPressed)
    }
}

// MARK: - Loading View
struct LoadingView: View {
    @State private var isAnimating = false
    
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)
                .progressViewStyle(CircularProgressViewStyle(tint: AppTheme.primary))
            
            Text("환율 정보를 가져오는 중...")
                .font(AppTheme.bodyFont)
                .foregroundColor(.secondary)
        }
        .opacity(isAnimating ? 1.0 : 0.8)
        .animation(
            Animation.easeInOut(duration: 1.0)
                .repeatForever(autoreverses: true),
            value: isAnimating
        )
        .onAppear {
            isAnimating = true
        }
    }
}

// MARK: - App Title View
struct AppTitleView: View {
    var baseSize: CGFloat = 20
    
    var body: some View {
        HStack(spacing: 2) {
            Text("💱")
                .font(.system(size: baseSize, weight: .semibold))
                .accessibilityHidden(true)
            
            GradientText(
                text: "환율알라미",
                font: .custom("MaruBuri-Bold", size: baseSize),
                gradient: AppTheme.exchangeGradient
            )
        }
    }
}

// MARK: - Gradient Text
struct GradientText: View {
    let text: String
    let font: Font
    let gradient: LinearGradient
    
    var body: some View {
        Text(text)
            .font(font)
            .foregroundColor(.clear)
            .overlay(
                gradient
            )
            .mask(
                Text(text).font(font)
            )
    }
}

// MARK: - Ad Banner Placeholder
struct AdBannerPlaceholder: View {
    @Environment(\.colorScheme) private var colorScheme
    
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "rectangle.badge.plus")
                .foregroundColor(.secondary)
            Text("Ad · Banner")
                .font(.footnote)
                .foregroundColor(.secondary)
            Spacer()
        }
        .padding(.horizontal, 12)
        .frame(height: 50)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(UIColor.tertiarySystemFill))
                .overlay(
                    RoundedRectangle(cornerRadius: 10)
                        .stroke(Color(UIColor.separator).opacity(colorScheme == .dark ? 0.6 : 0.3), lineWidth: 0.5)
                )
        )
    }
}

// MARK: - Exchange Buy/Sell View
struct ExchangeBuySeelView: View {
    let rate: ExchangeRate
    
    var body: some View {
        if let dealBasR = rate.dealBasR {
            let cleanedRate = dealBasR.replacingOccurrences(of: ",", with: "")
            if let baseRate = Double(cleanedRate) {
                HStack(spacing: 20) {
                    VStack(spacing: 4) {
                        Text("살때")
                            .font(AppTheme.captionFont)
                            .foregroundColor(.secondary)
                        Text("\(getBuyRate(baseRate: baseRate))원")
                            .font(AppTheme.headlineFont)
                            .foregroundColor(AppTheme.primary)
                    }
                    
                    Divider()
                        .frame(height: 30)
                    
                    VStack(spacing: 4) {
                        Text("팔때")
                            .font(AppTheme.captionFont)
                            .foregroundColor(.secondary)
                        Text("\(getSellRate(baseRate: baseRate))원")
                            .font(AppTheme.headlineFont)
                            .foregroundColor(AppTheme.primary)
                    }
                }
            }
        }
    }
    
    private func getBuyRate(baseRate: Double) -> String {
        if let ttb = rate.ttb {
            // API에서 제공된 값 사용
            return ttb
        } else {
            // 기준율에서 계산 (약 0.5% 낮게)
            return String(format: "%.2f", baseRate * 0.995)
        }
    }
    
    private func getSellRate(baseRate: Double) -> String {
        if let tts = rate.tts {
            // API에서 제공된 값 사용
            return tts
        } else {
            // 기준율에서 계산 (약 0.5% 높게)
            return String(format: "%.2f", baseRate * 1.005)
        }
    }
}

// MARK: - Signature View
struct SignatureView: View {
    var body: some View {
        HStack {
            Spacer()
            GradientText(
                text: "by GIROK Labs.",
                font: .system(size: 11, weight: .semibold),
                gradient: AppTheme.exchangeGradient
            )
        }
        .padding(.horizontal, 12)
        .padding(.bottom, 2)
    }
}
