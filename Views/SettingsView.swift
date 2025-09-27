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
                        // 헤더
                        VStack(spacing: 8) {
                            Image(systemName: "gearshape.fill")
                                .font(.system(size: 50))
                                .foregroundColor(AppTheme.primary)
                            
                            Text("설정")
                                .font(.title2)
                                .fontWeight(.bold)
                            
                            Text("환율 알림 설정을 관리하세요")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                        .padding(.top, 20)
                        
                        // 알림 설정
                        VStack(spacing: 20) {
                            // 알림 켜기/끄기
                            HStack {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("알림 활성화")
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                    
                                    Text("환율이 임계점에 도달하면 알림을 받습니다")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                Toggle("", isOn: $tempSettings.isEnabled)
                                    .toggleStyle(SwitchToggleStyle(tint: AppTheme.primary))
                            }
                            .padding()
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(12)
                            
                            if tempSettings.isEnabled {
                                VStack(spacing: 16) {
                                    // 상한선 설정
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("상한선 (원)")
                                            .font(.subheadline)
                                            .fontWeight(.medium)
                                        
                                        HStack {
                                            TextField("상한선", value: $tempSettings.upperThreshold, format: .number)
                                                .textFieldStyle(CustomTextFieldStyle())
                                                .keyboardType(.decimalPad)
                                            
                                            Text("원 이상")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                        
                                        Text("이 금액 이상이 되면 알림을 받습니다")
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                    
                                    // 하한선 설정
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("하한선 (원)")
                                            .font(.subheadline)
                                            .fontWeight(.medium)
                                        
                                        HStack {
                                            TextField("하한선", value: $tempSettings.lowerThreshold, format: .number)
                                                .textFieldStyle(CustomTextFieldStyle())
                                                .keyboardType(.decimalPad)
                                            
                                            Text("원 이하")
                                                .font(.caption)
                                                .foregroundColor(.secondary)
                                        }
                                        
                                        Text("이 금액 이하가 되면 알림을 받습니다")
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                    
                                    // 체크 간격 설정
                                    VStack(alignment: .leading, spacing: 8) {
                                        Text("체크 간격")
                                            .font(.subheadline)
                                            .fontWeight(.medium)
                                        
                                        Picker("체크 간격", selection: $tempSettings.checkInterval) {
                                            Text("15분").tag(15)
                                            Text("30분").tag(30)
                                            Text("1시간").tag(60)
                                            Text("2시간").tag(120)
                                        }
                                        .pickerStyle(.segmented)
                                        
                                        Text("이 간격으로 환율을 확인합니다")
                                            .font(.caption2)
                                            .foregroundColor(.secondary)
                                    }
                                }
                                .padding()
                                .background(Color(.secondarySystemBackground))
                                .cornerRadius(12)
                                .transition(.opacity.combined(with: .move(edge: .top)))
                            }
                        }
                        
                        // 알림 권한 설정
                        VStack(spacing: 12) {
                            HStack {
                                Image(systemName: "bell.fill")
                                    .foregroundColor(AppTheme.primary)
                                    .font(.title3)
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("알림 권한")
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                    
                                    Text("시스템 설정에서 알림을 허용해주세요")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                                
                                Spacer()
                                
                                Button("설정 열기") {
                                    NotificationManager.openSystemSettings()
                                }
                                .font(.subheadline)
                                .foregroundColor(AppTheme.primary)
                            }
                            .padding()
                            .background(Color(.secondarySystemBackground))
                            .cornerRadius(12)
                        }
                        
                        // 저장 버튼
                        GradientButton(
                            title: "설정 저장",
                            icon: "checkmark",
                            action: {
                                exchangeManager.updateAlertSettings(tempSettings)
                                dismiss()
                            }
                        )
                        .padding(.horizontal, 20)
                        .padding(.top, 20)
                    }
                    .padding(.horizontal, 20)
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("취소") {
                        dismiss()
                    }
                    .foregroundColor(AppTheme.primary)
                }
            }
        }
        .onAppear {
            tempSettings = exchangeManager.alertSettings
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(ExchangeRateManager())
}

