import SwiftUI

// MARK: - Currency Selector
struct CurrencySelector: View {
    @Binding var selectedCurrency: CurrencyType
    
    var body: some View {
        CardView(cornerRadius: 16, shadowRadius: 8) {
            VStack(spacing: 12) {
                Text("통화 선택")
                    .font(.headline)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                
                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 3), spacing: 8) {
                    ForEach(CurrencyType.allCases, id: \.self) { currency in
                        CurrencyButton(
                            currency: currency,
                            isSelected: selectedCurrency == currency
                        ) {
                            selectedCurrency = currency
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Currency Button
struct CurrencyButton: View {
    let currency: CurrencyType
    let isSelected: Bool
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Text(currency.symbol)
                    .font(.title2)
                    .fontWeight(.bold)
                
                Text(currency.rawValue)
                    .font(.caption)
                    .fontWeight(.medium)
                
                Text(currency.displayName)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(isSelected ? AppTheme.primary.opacity(0.1) : Color.clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(isSelected ? AppTheme.primary : Color.gray.opacity(0.3), lineWidth: 1)
            )
        }
        .buttonStyle(ScaleButtonStyle())
    }
}

// MARK: - Exchange Rate Card
struct ExchangeRateCard: View {
    let rate: ExchangeRate
    let alertSettings: AlertSettings
    
    var body: some View {
        CardView(cornerRadius: 16, shadowRadius: 8) {
            VStack(spacing: 16) {
                // 헤더
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(rate.curUnit ?? "USD")/KRW")
                            .font(.headline)
                            .fontWeight(.semibold)
                            .foregroundColor(.primary)
                        
                        Text(rate.curNm ?? "대한민국 원")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    // 환율 상태 아이콘
                    ExchangeStatusIcon(rate: rate, alertSettings: alertSettings)
                }
                
                // 현재 환율
                if let currentRate = rate.dealBasR, let rateValue = Double(currentRate) {
                    VStack(spacing: 8) {
                        Text("\(String(format: "%.2f", rateValue))")
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                            .foregroundColor(ExchangeColorHelper.colorForRate(
                                rateValue,
                                upperThreshold: alertSettings.upperThreshold,
                                lowerThreshold: alertSettings.lowerThreshold
                            ))
                        
                        Text("원")
                            .font(.title3)
                            .foregroundColor(.secondary)
                    }
                } else {
                    Text("데이터 없음")
                        .font(.title2)
                        .foregroundColor(.secondary)
                }
                
                // 상세 정보
                if let ttb = rate.ttb, let tts = rate.tts {
                    HStack(spacing: 20) {
                        VStack(spacing: 4) {
                            Text("송금 받을 때")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("\(ttb)원")
                                .font(.title3)
                                .fontWeight(.semibold)
                        }
                        
                        Divider()
                            .frame(height: 30)
                        
                        VStack(spacing: 4) {
                            Text("송금 보낼 때")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text("\(tts)원")
                                .font(.title3)
                                .fontWeight(.semibold)
                        }
                    }
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
        if let currentRate = rate.usdKrwRate {
            let color = ExchangeColorHelper.colorForRate(
                currentRate,
                upperThreshold: alertSettings.upperThreshold,
                lowerThreshold: alertSettings.lowerThreshold
            )
            
            ZStack {
                Circle()
                    .fill(color.opacity(0.1))
                    .frame(width: 50, height: 50)
                
                Image(systemName: iconForRate(currentRate))
                    .font(.title2)
                    .foregroundColor(color)
            }
        } else {
            ZStack {
                Circle()
                    .fill(Color.gray.opacity(0.1))
                    .frame(width: 50, height: 50)
                
                Image(systemName: "questionmark")
                    .font(.title2)
                    .foregroundColor(.gray)
            }
        }
    }
    
    private func iconForRate(_ rate: Double) -> String {
        if rate >= alertSettings.upperThreshold {
            return "arrow.up.right.circle.fill"
        } else if rate <= alertSettings.lowerThreshold {
            return "arrow.down.right.circle.fill"
        } else {
            return "minus.circle.fill"
        }
    }
}

// MARK: - Alert Settings Card
struct AlertSettingsCard: View {
    @Binding var settings: AlertSettings
    
    var body: some View {
        CardView(cornerRadius: 16, shadowRadius: 8) {
            VStack(spacing: 16) {
                HStack {
                    Image(systemName: "bell.fill")
                        .foregroundColor(AppTheme.primary)
                        .font(.title3)
                    
                    Text("알림 설정")
                        .font(.headline)
                        .fontWeight(.semibold)
                    
                    Spacer()
                    
                    Toggle("", isOn: $settings.isEnabled)
                        .toggleStyle(SwitchToggleStyle(tint: AppTheme.primary))
                }
                
                if settings.isEnabled {
                    VStack(spacing: 12) {
                        // 상한선 설정
                        VStack(alignment: .leading, spacing: 8) {
                            Text("상한선 (원)")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            HStack {
                                TextField("상한선", value: $settings.upperThreshold, format: .number)
                                    .textFieldStyle(CustomTextFieldStyle())
                                    .keyboardType(.decimalPad)
                                
                                Text("원 이상")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        
                        // 하한선 설정
                        VStack(alignment: .leading, spacing: 8) {
                            Text("하한선 (원)")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            
                            HStack {
                                TextField("하한선", value: $settings.lowerThreshold, format: .number)
                                    .textFieldStyle(CustomTextFieldStyle())
                                    .keyboardType(.decimalPad)
                                
                                Text("원 이하")
                                    .font(.caption)
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
                    .font(.headline)
                    .fontWeight(.semibold)
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
                .font(.body)
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
                text: "환율알리미",
                font: .system(size: baseSize, weight: .heavy),
                gradient: AppTheme.exchangeGradient
            )
            
            Text("Exchange Alert")
                .font(.system(size: baseSize * 0.5, weight: .semibold))
                .foregroundColor(.secondary)
                .baselineOffset(-2)
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
