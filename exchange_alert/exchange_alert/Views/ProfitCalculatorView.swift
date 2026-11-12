import SwiftUI

struct ProfitCalculatorView: View {
    @Environment(\.dismiss) var dismiss
    @EnvironmentObject var exchangeManager: ExchangeRateManager
    @StateObject private var investmentManager = InvestmentManager()
    
    @State private var isAdding = false
    @State private var date = Date()
    @State private var usdAmount: String = ""
    @State private var buyRate: String = ""
    @State private var memo: String = ""
    
    @State private var selectedForSell: FXInvestment?
    @State private var sellRate: String = ""
    @State private var showingSellAlert = false
    @State private var showingPartialSellSheet = false
    @State private var partialSellAmount: String = ""
    
    /// 보유 자산이 달러이므로 화면에서 선택한 통화와 관계없이 USD 매매기준율로 평가한다.
    var currentRate: Double {
        if let rateStr = exchangeManager.exchangeRates[.USD]?.dealBasR?.replacingOccurrences(of: ",", with: ""),
           let val = Double(rateStr) {
            return val
        }
        return 0
    }
    
    var stats: InvestmentStats {
        investmentManager.calculateStats(currentRate: currentRate)
    }
    
    var body: some View {
        ZStack(alignment: .top) {
            AppTheme.backgroundGradient.ignoresSafeArea()
            
            VStack(spacing: 0) {
                // 커스텀 헤더
                HStack {
                    AppTitleView(title: "환차익 계산기", baseSize: 26)
                    
                    Spacer()
                    
                    Button("닫기") {
                        dismiss()
                    }
                    .foregroundColor(AppTheme.accentText)
                    .font(AppTheme.bodyFont)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                
                TopSeparator()
                
                ScrollView {
                    VStack(spacing: 20) {
                        // 요약 정보 섹션
                        SummarySection(stats: stats, currentRate: currentRate)
                            .padding(.horizontal)
                        
                        // 추가 버튼 및 입력 폼
                        VStack(spacing: 12) {
                            Button(action: { withAnimation { isAdding.toggle() } }) {
                                HStack {
                                    Image(systemName: isAdding ? "minus.circle.fill" : "plus.circle.fill")
                                    Text(isAdding ? "닫기" : "새 투자 기록 추가")
                                }
                                .font(AppTheme.headlineFont)
                                .foregroundColor(.black)
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.yellow)
                                .cornerRadius(12)
                            }
                            
                            if isAdding {
                                AddInvestmentForm(
                                    date: $date,
                                    usdAmount: $usdAmount,
                                    buyRate: $buyRate,
                                    memo: $memo,
                                    currentRate: currentRate,
                                    onSave: {
                                        saveNewInvestment()
                                    }
                                )
                                .transition(.move(edge: .top).combined(with: .opacity))
                            }
                        }
                        .padding(.horizontal)
                        
                        // 투자 내역 리스트
                        VStack(alignment: .leading, spacing: 12) {
                            Text("투자 내역")
                                .font(AppTheme.titleFont)
                                .padding(.horizontal)
                            
                            if investmentManager.investments.isEmpty {
                                EmptyStateView()
                            } else {
                                ForEach(investmentManager.investments) { inv in
                                    InvestmentRow(
                                        inv: inv,
                                        currentRate: currentRate,
                                        onSell: {
                                            selectedForSell = inv
                                            sellRate = String(format: "%.1f", currentRate)
                                            showingSellAlert = true
                                        },
                                        onPartialSell: {
                                            selectedForSell = inv
                                            sellRate = String(format: "%.1f", currentRate)
                                            partialSellAmount = ""
                                            showingPartialSellSheet = true
                                        },
                                        onDelete: {
                                            investmentManager.deleteInvestment(id: inv.id)
                                        },
                                        onRevert: {
                                            investmentManager.revertToHolding(id: inv.id)
                                        }
                                    )
                                }
                                .padding(.horizontal)
                            }
                        }
                    }
                    .padding(.vertical)
                }
            }
        }
        .onTapGesture {
            // 배경 탭 시 키보드 내리기
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
        .alert("전체 매도", isPresented: $showingSellAlert) {
            TextField("매도 환율", text: $sellRate)
                .keyboardType(.decimalPad)
            Button("취소", role: .cancel) { }
            Button("매도 확정") {
                if let inv = selectedForSell, let rate = parsePositive(sellRate) {
                    investmentManager.sellInvestment(id: inv.id, sellRate: rate, sellDate: formatDate(Date()))
                }
            }
        } message: {
            Text("매도 환율을 입력하세요.")
        }
        .sheet(isPresented: $showingPartialSellSheet) {
            PartialSellView(
                investment: selectedForSell,
                sellRate: $sellRate,
                amount: $partialSellAmount,
                onConfirm: {
                    if let inv = selectedForSell, let rate = parsePositive(sellRate), let amt = parsePositive(partialSellAmount) {
                        investmentManager.partialSell(id: inv.id, amountToSell: amt, sellRate: rate, sellDate: formatDate(Date()))
                        showingPartialSellSheet = false
                    }
                }
            )
        }
    }
    
    private func saveNewInvestment() {
        guard let amt = parsePositive(usdAmount), let rate = parsePositive(buyRate) else { return }
        investmentManager.addInvestment(date: formatDate(date), amount: amt, rate: rate, memo: memo)
        withAnimation {
            isAdding = false
            usdAmount = ""
            buyRate = ""
            memo = ""
        }
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy.M.d."
        return formatter.string(from: date)
    }
}

/// 달러 금액은 센트까지 보여준다. (정수로 자르면 $150.75가 $150으로 보임)
func usdText(_ amount: Double) -> String {
    "$" + amount.formatted(.number.precision(.fractionLength(0...2)))
}

/// 천 단위 쉼표와 공백을 허용하고, 0 이하나 숫자가 아닌 값은 거부한다.
func parsePositive(_ text: String) -> Double? {
    let cleaned = text.replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespaces)
    guard let value = Double(cleaned), value.isFinite, value > 0 else { return nil }
    return value
}

// MARK: - Subviews

struct SummarySection: View {
    let stats: InvestmentStats
    let currentRate: Double
    
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                SummaryCard(title: "보유 달러", value: usdText(stats.totalHoldingUsd), subValue: "원금 \(Int(stats.totalHoldingBuyKrw).formatted())원", color: .blue)
                if currentRate > 0 {
                    SummaryCard(title: "미실현 손익", value: "\(Int(stats.unrealizedProfit).formatted())원", subValue: "수익률 \(String(format: "%.2f", stats.totalHoldingBuyKrw > 0 ? (stats.unrealizedProfit / stats.totalHoldingBuyKrw * 100) : 0))%", color: stats.unrealizedProfit >= 0 ? .red : .blue)
                } else {
                    SummaryCard(title: "미실현 손익", value: "--", subValue: "환율 불러오는 중", color: .gray)
                }
            }
            HStack(spacing: 12) {
                SummaryCard(title: "오늘 실현 손익", value: "\(Int(stats.realizedToday).formatted())원", subValue: "이번 달: \(Int(stats.realizedMonth).formatted())원", color: .orange)
                SummaryCard(title: "평균 매수 단가", value: "\(String(format: "%.1f", stats.avgBuyRate))원", subValue: currentRate > 0 ? "현재 환율 대비 \(String(format: "%+.1f", currentRate - stats.avgBuyRate))원" : "환율 불러오는 중", color: .purple)
            }
            Text(currentRate > 0 ? "평가 기준: USD 매매기준율 \(String(format: "%.2f", currentRate))원" : "평가 기준: USD 매매기준율")
                .font(AppTheme.footnoteFont)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
    }
}

struct SummaryCard: View {
    let title: String
    let value: String
    let subValue: String
    let color: Color
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(AppTheme.captionFont)
                .foregroundColor(.secondary)
            Text(value)
                .font(AppTheme.headlineFont)
                .fontWeight(.bold)
            Text(subValue)
                .font(AppTheme.footnoteFont)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(UIColor.secondarySystemBackground).opacity(0.8))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(color.opacity(0.3), lineWidth: 1)
        )
    }
}

struct AddInvestmentForm: View {
    @Binding var date: Date
    @Binding var usdAmount: String
    @Binding var buyRate: String
    @Binding var memo: String
    let currentRate: Double
    let onSave: () -> Void
    
    var body: some View {
        VStack(spacing: 20) {
            HStack {
                Text("매수 정보 입력")
                    .font(AppTheme.headlineFont)
                Spacer()
                DatePicker("", selection: $date, displayedComponents: .date)
                    .labelsHidden()
                    .environment(\.locale, Locale(identifier: "ko_KR"))
            }
            
            VStack(spacing: 12) {
                // 매수 금액
                VStack(alignment: .leading, spacing: 6) {
                    Text("매수 금액 (USD)")
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                    TextField("0", text: $usdAmount)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(CustomTextFieldStyle())
                        .font(AppTheme.bodyFont)
                }
                
                // 매수 환율
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("매수 환율 (KRW)")
                        Spacer()
                        Button("현재가 적용") {
                            buyRate = String(format: "%.1f", currentRate)
                        }
                        .font(AppTheme.captionFont)
                        .foregroundColor(AppTheme.accentText)
                    }
                    .font(AppTheme.captionFont)
                    .foregroundColor(.secondary)
                    
                    TextField("0.0", text: $buyRate)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(CustomTextFieldStyle())
                        .font(AppTheme.bodyFont)
                }
                
                // 메모
                VStack(alignment: .leading, spacing: 6) {
                    Text("메모 (선택)")
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                    TextField("간략한 메모", text: $memo)
                        .textFieldStyle(CustomTextFieldStyle())
                        .font(AppTheme.bodyFont)
                }
            }
            
            Button(action: onSave) {
                Text("투자 기록 저장")
                    .font(AppTheme.headlineFont)
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.yellow)
                    .cornerRadius(12)
            }
            .padding(.top, 8)
        }
        .padding(20)
        .background(Color(UIColor.secondarySystemBackground).opacity(0.8))
        .cornerRadius(16)
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.yellow.opacity(0.3), lineWidth: 1)
        )
        .shadow(color: Color.black.opacity(0.05), radius: 10, x: 0, y: 5)
    }
}

struct InvestmentRow: View {
    let inv: FXInvestment
    let currentRate: Double
    let onSell: () -> Void
    let onPartialSell: () -> Void
    let onDelete: () -> Void
    let onRevert: () -> Void
    
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(inv.date)
                            .font(AppTheme.captionFont)
                            .foregroundColor(.secondary)
                        if inv.status == .sold {
                            Text("매도완료")
                                .font(AppTheme.footnoteFont)
                                .fontWeight(.bold)
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)
                                .background(Color.green.opacity(0.2))
                                .foregroundColor(.green)
                                .cornerRadius(4)
                        }
                    }
                    Text(usdText(inv.usdAmount))
                        .font(AppTheme.headlineFont)
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 4) {
                    let targetRate = inv.status == .holding ? currentRate : (inv.sellRate ?? 0)
                    if targetRate > 0 && inv.buyRate > 0 {
                        let profit = inv.usdAmount * (targetRate - inv.buyRate)
                        let roi = (targetRate / inv.buyRate - 1) * 100
                        
                        Text("\(String(format: "%.1f", targetRate))원")
                            .font(.subheadline)
                        Text("\(profit >= 0 ? "+" : "")\(Int(profit).formatted())원 (\(String(format: "%.2f", roi))%)")
                            .font(.caption)
                            .foregroundColor(profit >= 0 ? .red : .blue)
                    } else {
                        Text("--")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding()
            
            if !inv.memo.isEmpty {
                Text(inv.memo)
                    .font(.system(size: 11))
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal)
                    .padding(.bottom, 8)
            }
            
            Divider()
            
            HStack {
                if inv.status == .holding {
                    Button(action: onSell) {
                        Label("전체매도", systemImage: "dollarsign.circle")
                    }
                    Spacer()
                    Button(action: onPartialSell) {
                        Label("분할매도", systemImage: "scissors")
                    }
                } else {
                    Button(action: onRevert) {
                        Label("보유전환", systemImage: "arrow.uturn.backward")
                    }
                }
                Spacer()
                Button(role: .destructive, action: onDelete) {
                    Label("삭제", systemImage: "trash")
                }
            }
            .font(.caption2)
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(UIColor.secondarySystemBackground).opacity(0.5))
        .cornerRadius(12)
    }
}

struct EmptyStateView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "tray")
                .font(.system(size: 40))
                .foregroundColor(.secondary)
            Text("기록된 투자 내역이 없습니다.\n새로운 매수 기록을 추가해보세요.")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }
}

struct PartialSellView: View {
    let investment: FXInvestment?
    @Binding var sellRate: String
    @Binding var amount: String
    let onConfirm: () -> Void
    
    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("투자 정보").font(AppTheme.captionFont)) {
                    HStack {
                        Text("매수일")
                        Spacer()
                        Text(investment?.date ?? "")
                    }
                    HStack {
                        Text("보유 금액")
                        Spacer()
                        Text(usdText(investment?.usdAmount ?? 0))
                    }
                    HStack {
                        Text("매수 환율")
                        Spacer()
                        Text("\(String(format: "%.1f", investment?.buyRate ?? 0))원")
                    }
                }
                .font(AppTheme.subheadlineFont)
                
                Section(header: Text("매도 정보").font(AppTheme.captionFont)) {
                    HStack {
                        Text("매도 금액")
                        TextField("USD", text: $amount)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                    HStack {
                        Text("매도 환율")
                        TextField("KRW", text: $sellRate)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                    }
                }
                .font(AppTheme.subheadlineFont)
                
                Button(action: onConfirm) {
                    Text("매도 확정")
                        .font(AppTheme.headlineFont)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(12)
                }
                .disabled(parsePositive(amount) == nil || parsePositive(sellRate) == nil)
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
            .navigationTitle("분할 매도")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

#Preview {
    ProfitCalculatorView()
        .environmentObject(ExchangeRateManager())
}
