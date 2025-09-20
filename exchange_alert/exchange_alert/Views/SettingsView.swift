import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    @Environment(\.dismiss) private var dismiss
    @State private var tempSettings: AlertSettings
    
    init() {
        _tempSettings = State(initialValue: AlertSettings.default)
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
                        exchangeManager.updateAlertSettings(tempSettings)
                        dismiss()
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
                            TextField("기준값", value: $tempSettings.threshold, format: .number)
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