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
                SheetHeader(title: "환차익 계산기", onClose: { dismiss() })

                ScrollView {
                    VStack(spacing: 16) {
                        SummarySection(stats: stats, currentRate: currentRate)

                        Button(action: { withAnimation { isAdding.toggle() } }) {
                            Label(isAdding ? "입력 닫기" : "매수 기록 추가", systemImage: isAdding ? "xmark" : "plus")
                                .font(AppTheme.headlineFont)
                                .foregroundColor(AppTheme.onPrimary)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 14)
                                .background(AppTheme.primary)
                                .cornerRadius(12)
                        }

                        if isAdding {
                            AddInvestmentForm(
                                date: $date,
                                usdAmount: $usdAmount,
                                buyRate: $buyRate,
                                memo: $memo,
                                currentRate: currentRate,
                                onSave: { saveNewInvestment() }
                            )
                            .transition(.move(edge: .top).combined(with: .opacity))
                        }

                        VStack(alignment: .leading, spacing: 10) {
                            Text("투자 내역")
                                .font(AppTheme.headlineFont)
                                .padding(.top, 8)

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
                                        onDelete: { investmentManager.deleteInvestment(id: inv.id) },
                                        onRevert: { investmentManager.revertToHolding(id: inv.id) }
                                    )
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 16)
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

    private var roi: Double {
        stats.totalHoldingBuyKrw > 0 ? stats.unrealizedProfit / stats.totalHoldingBuyKrw * 100 : 0
    }

    private func won(_ value: Double) -> String { "\(Int(value.rounded()).formatted())원" }

    var body: some View {
        CardView(cornerRadius: 16, shadowRadius: 8) {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("미실현 손익")
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                    if currentRate > 0 {
                        Text("\(stats.unrealizedProfit > 0 ? "+" : "")\(won(stats.unrealizedProfit))")
                            .font(.title.weight(.bold).monospacedDigit())
                            .foregroundColor(profitColor(stats.unrealizedProfit))
                        Text("수익률 \(String(format: "%+.2f", roi))%")
                            .font(AppTheme.subheadlineFont.monospacedDigit())
                            .foregroundColor(profitColor(stats.unrealizedProfit))
                    } else {
                        Text("--")
                            .font(.title.weight(.bold))
                            .foregroundColor(.secondary)
                    }
                }

                Divider()

                VStack(spacing: 10) {
                    SummaryRow(label: "보유 달러", value: usdText(stats.totalHoldingUsd), detail: "원금 \(won(stats.totalHoldingBuyKrw))")
                    SummaryRow(label: "평균 매수가", value: stats.avgBuyRate > 0 ? "\(String(format: "%.1f", stats.avgBuyRate))원" : "--")
                    SummaryRow(label: "오늘 실현 손익", value: won(stats.realizedToday))
                    SummaryRow(label: "이번 달 실현 손익", value: won(stats.realizedMonth))
                }

                Text(currentRate > 0 ? "USD 매매기준율 \(String(format: "%.2f", currentRate))원 기준" : "환율 불러오는 중")
                    .font(AppTheme.footnoteFont)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

/// 한국 관례대로 이익은 빨강, 손실은 파랑.
func profitColor(_ value: Double) -> Color {
    if value > 0 { return AppTheme.rising }
    if value < 0 { return AppTheme.falling }
    return .secondary
}

struct SummaryRow: View {
    let label: String
    let value: String
    var detail: String? = nil

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(AppTheme.subheadlineFont)
                .foregroundColor(.secondary)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(value)
                    .font(AppTheme.subheadlineFont.weight(.semibold).monospacedDigit())
                if let detail {
                    Text(detail)
                        .font(AppTheme.footnoteFont.monospacedDigit())
                        .foregroundColor(.secondary)
                }
            }
        }
    }
}

struct AddInvestmentForm: View {
    @Binding var date: Date
    @Binding var usdAmount: String
    @Binding var buyRate: String
    @Binding var memo: String
    let currentRate: Double
    let onSave: () -> Void

    private var canSave: Bool { parsePositive(usdAmount) != nil && parsePositive(buyRate) != nil }

    var body: some View {
        CardView(cornerRadius: 16, shadowRadius: 8) {
            VStack(spacing: 14) {
                HStack {
                    Text("매수일")
                        .font(AppTheme.subheadlineFont)
                        .foregroundColor(.secondary)
                    Spacer()
                    DatePicker("", selection: $date, displayedComponents: .date)
                        .labelsHidden()
                        .environment(\.locale, Locale(identifier: "ko_KR"))
                }

                field("매수 금액 (USD)", placeholder: "0", text: $usdAmount, keyboard: .decimalPad)

                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("매수 환율 (원)")
                        Spacer()
                        if currentRate > 0 {
                            Button("현재 환율 넣기") { buyRate = String(format: "%.1f", currentRate) }
                                .foregroundColor(AppTheme.accentText)
                        }
                    }
                    .font(AppTheme.captionFont)
                    .foregroundColor(.secondary)
                    TextField("0.0", text: $buyRate)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(CustomTextFieldStyle())
                        .font(AppTheme.bodyFont)
                }

                field("메모 (선택)", placeholder: "간단한 메모", text: $memo, keyboard: .default)

                Button(action: onSave) {
                    Text("저장")
                        .font(AppTheme.headlineFont)
                        .foregroundColor(AppTheme.onPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(AppTheme.primary.opacity(canSave ? 1 : 0.4))
                        .cornerRadius(12)
                }
                .disabled(!canSave)
            }
        }
    }

    private func field(_ label: String, placeholder: String, text: Binding<String>, keyboard: UIKeyboardType) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(AppTheme.captionFont)
                .foregroundColor(.secondary)
            TextField(placeholder, text: text)
                .keyboardType(keyboard)
                .textFieldStyle(CustomTextFieldStyle())
                .font(AppTheme.bodyFont)
        }
    }
}

struct InvestmentRow: View {
    let inv: FXInvestment
    let currentRate: Double
    let onSell: () -> Void
    let onPartialSell: () -> Void
    let onDelete: () -> Void
    let onRevert: () -> Void

    private var targetRate: Double { inv.status == .holding ? currentRate : (inv.sellRate ?? 0) }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Text(usdText(inv.usdAmount))
                        .font(AppTheme.headlineFont.monospacedDigit())
                    if inv.status == .sold {
                        Text("매도완료")
                            .font(AppTheme.footnoteFont.weight(.semibold))
                            .foregroundColor(.secondary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.12))
                            .cornerRadius(4)
                    }
                }
                Text(subtitle)
                    .font(AppTheme.captionFont.monospacedDigit())
                    .foregroundColor(.secondary)
                if !inv.memo.isEmpty {
                    Text(inv.memo)
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                }
            }

            Spacer(minLength: 8)

            if targetRate > 0 && inv.buyRate > 0 {
                let profit = inv.usdAmount * (targetRate - inv.buyRate)
                let roi = (targetRate / inv.buyRate - 1) * 100
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(profit > 0 ? "+" : "")\(Int(profit.rounded()).formatted())원")
                        .font(AppTheme.subheadlineFont.weight(.semibold).monospacedDigit())
                    Text(String(format: "%+.2f%%", roi))
                        .font(AppTheme.captionFont.monospacedDigit())
                }
                .foregroundColor(profitColor(profit))
            } else {
                Text("--").foregroundColor(.secondary)
            }

            Menu {
                if inv.status == .holding {
                    Button(action: onSell) { Label("전체 매도", systemImage: "dollarsign.circle") }
                    Button(action: onPartialSell) { Label("분할 매도", systemImage: "scissors") }
                } else {
                    Button(action: onRevert) { Label("보유로 되돌리기", systemImage: "arrow.uturn.backward") }
                }
                Button(role: .destructive, action: onDelete) { Label("삭제", systemImage: "trash") }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.body.weight(.semibold))
                    .foregroundColor(.secondary)
                    .frame(width: 28, height: 28)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("기록 관리")
        }
        .padding(14)
        .background(Color(UIColor.secondarySystemBackground))
        .cornerRadius(12)
    }

    private var subtitle: String {
        let buy = "매수 \(String(format: "%.1f", inv.buyRate))원"
        if inv.status == .sold, let sell = inv.sellRate {
            return "\(inv.date)\n\(buy) → 매도 \(String(format: "%.1f", sell))원"
        }
        return "\(inv.date)\n\(buy)"
    }
}

struct EmptyStateView: View {
    var body: some View {
        Text("아직 기록이 없습니다.\n달러를 샀다면 매수 기록을 추가해 보세요.")
            .font(AppTheme.subheadlineFont)
            .foregroundColor(.secondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 32)
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
                        .foregroundColor(AppTheme.onPrimary)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(AppTheme.primary)
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
