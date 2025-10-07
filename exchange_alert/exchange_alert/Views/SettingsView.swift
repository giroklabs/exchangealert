import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    @Environment(\.dismiss) private var dismiss
    @State private var tempSettings: AlertSettings
    @State private var thresholdText = ""
    
    init() {
        _tempSettings = State(initialValue: AlertSettings.default)
    }
    
    // thresholdText 초기화
    private func updateThresholdText() {
        if tempSettings.threshold == 0 {
            thresholdText = ""
        } else if tempSettings.threshold.truncatingRemainder(dividingBy: 1) == 0 {
            thresholdText = String(format: "%.0f", tempSettings.threshold)
        } else {
            thresholdText = String(tempSettings.threshold)
        }
    }
    
    var body: some View {
        NavigationView {
            ZStack {
                Color(.systemGroupedBackground)
                    .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        headerSection
                        currencySelectionSection
                        alertSettingsSection
                        testNotificationSection
                        saveButtonSection
                    }
                    .padding()
                }
            }
            .navigationTitle("설정")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("완료") {
                        DispatchQueue.main.async {
                            exchangeManager.updateAlertSettings(tempSettings)
                            dismiss()
                        }
                    }
                    .foregroundColor(AppTheme.primary)
                }
            }
        }
    }
    
    private var headerSection: some View {
        VStack(spacing: 8) {
            Image(systemName: "gearshape.fill")
                .font(.system(size: 50))
                .foregroundColor(AppTheme.primary)
            
            Text("환율알리미 설정")
                .font(AppTheme.titleFont)
            
            Text("환율 알림 설정을 관리하세요")
                .font(AppTheme.subheadlineFont)
                .foregroundColor(.secondary)
        }
        .padding(.top, 20)
    }
    
    private var currencySelectionSection: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "dollarsign.circle.fill")
                    .foregroundColor(AppTheme.primary)
                    .font(AppTheme.headlineFont)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("통화 선택")
                        .font(AppTheme.headlineFont)
                    
                    Text("알림을 받을 환율을 선택하세요")
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
            }
            
            Menu {
                ForEach(CurrencyType.allCases, id: \.self) { currency in
                    Button(action: {
                        exchangeManager.changeCurrency(to: currency)
                    }) {
                        HStack {
                            Text(currency.symbol)
                            Text(currency.rawValue)
                            Text(currency.displayName)
                            if exchangeManager.selectedCurrency == currency {
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            } label: {
                HStack {
                    Text(exchangeManager.selectedCurrency.symbol)
                        .font(AppTheme.titleFont)
                    
                    Text(exchangeManager.selectedCurrency.rawValue)
                        .font(AppTheme.titleFont)
                    
                    Text("/KRW")
                        .font(AppTheme.titleFont)
                    
                    Spacer()
                    
                    Image(systemName: "chevron.down")
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(12)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
    
    private var alertSettingsSection: some View {
        VStack(spacing: 20) {
            HStack {
                Image(systemName: "bell.fill")
                    .foregroundColor(AppTheme.primary)
                    .font(AppTheme.headlineFont)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text("알림 설정")
                        .font(AppTheme.headlineFont)
                    
                    Text("환율 변동 알림을 설정하세요")
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                }
                
                Spacer()
                
                Toggle("", isOn: $tempSettings.isEnabled)
                    .toggleStyle(SwitchToggleStyle(tint: AppTheme.primary))
            }
            
            if tempSettings.isEnabled {
                VStack(spacing: 12) {
                    // 알림 타입 설정
                    VStack(alignment: .leading, spacing: 8) {
                        Text("알림 타입")
                            .font(AppTheme.subheadlineFont)
                        
                        Picker("알림 타입", selection: $tempSettings.thresholdType) {
                            ForEach(ThresholdType.allCases, id: \.self) { type in
                                Text(type.rawValue).tag(type)
                            }
                        }
                        .pickerStyle(.segmented)
                        .font(AppTheme.bodyFont)
                        
                        Text(tempSettings.thresholdType.description)
                            .font(AppTheme.captionFont)
                            .foregroundColor(.secondary)
                    }
                    
                    // 기준값 설정
                    VStack(alignment: .leading, spacing: 8) {
                        Text("기준값 (원)")
                            .font(AppTheme.subheadlineFont)
                        
                        HStack {
                            TextField("예: 1350.50", text: $thresholdText)
                                .onChange(of: thresholdText) { newValue in
                                    // 빈 문자열이면 0, 아니면 Double 변환
                                    if newValue.isEmpty {
                                        tempSettings.threshold = 0
                                    } else if let doubleValue = Double(newValue) {
                                        tempSettings.threshold = doubleValue
                                    }
                                }
                                .onAppear {
                                    updateThresholdText()
                                }
                                .onChange(of: tempSettings.threshold) { _ in
                                    updateThresholdText()
                                }
                                .textFieldStyle(RoundedBorderTextFieldStyle())
                                .keyboardType(.decimalPad)
                                .font(AppTheme.bodyFont)
                            
                            Text("원")
                                .font(AppTheme.captionFont)
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
    
    private var testNotificationSection: some View {
        VStack(spacing: 12) {
            Text("알림 테스트")
                .font(AppTheme.subheadlineFont)
                .foregroundColor(.primary)
            
            Button(action: {
                exchangeManager.testNotification()
            }) {
                HStack {
                    Image(systemName: "bell.fill")
                    Text("알림 테스트 실행")
                }
                .font(AppTheme.bodyFont)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.orange)
                .cornerRadius(12)
            }
            
            Text("현재 설정으로 알림이 제대로 작동하는지 테스트합니다.")
                .font(AppTheme.captionFont)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .cornerRadius(12)
    }
    
    private var saveButtonSection: some View {
        Button(action: {
            exchangeManager.updateAlertSettings(tempSettings)
            dismiss()
        }) {
            Text("설정 저장")
                .font(AppTheme.headlineFont)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(AppTheme.primary)
                .cornerRadius(12)
        }
        .padding(.horizontal)
    }
}

#Preview {
    SettingsView()
        .environmentObject(ExchangeRateManager())
}