import Foundation
import SwiftUI
import Combine

class InvestmentManager: ObservableObject {
    @Published var investments: [FXInvestment] = []
    
    private let storageKey = "fx-investments"
    
    init() {
        loadInvestments()
    }
    
    func loadInvestments() {
        if let data = UserDefaults.standard.data(forKey: storageKey),
           let decoded = try? JSONDecoder().decode([FXInvestment].self, from: data) {
            self.investments = decoded
        }
    }
    
    func saveInvestments() {
        if let encoded = try? JSONEncoder().encode(investments) {
            UserDefaults.standard.set(encoded, forKey: storageKey)
        }
    }
    
    func addInvestment(date: String, amount: Double, rate: Double, memo: String) {
        let newInv = FXInvestment(date: date, usdAmount: amount, buyRate: rate, memo: memo)
        investments.insert(newInv, at: 0)
        saveInvestments()
    }
    
    func deleteInvestment(id: UUID) {
        investments.removeAll { $0.id == id }
        saveInvestments()
    }
    
    func sellInvestment(id: UUID, sellRate: Double, sellDate: String) {
        if let index = investments.firstIndex(where: { $0.id == id }) {
            investments[index].status = .sold
            investments[index].sellRate = sellRate
            investments[index].sellDate = sellDate
            saveInvestments()
        }
    }
    
    func partialSell(id: UUID, amountToSell: Double, sellRate: Double, sellDate: String) {
        guard amountToSell > 0, let index = investments.firstIndex(where: { $0.id == id }) else { return }
        let original = investments[index]
        
        if amountToSell >= original.usdAmount {
            sellInvestment(id: id, sellRate: sellRate, sellDate: sellDate)
            return
        }
        
        // 새 매도 기록 추가
        let soldInv = FXInvestment(
            date: original.date,
            usdAmount: amountToSell,
            buyRate: original.buyRate,
            sellRate: sellRate,
            sellDate: sellDate,
            status: .sold,
            memo: original.memo.isEmpty ? "(분할매도)" : "\(original.memo) (분할매도)"
        )
        
        // 기존 보유 기록 업데이트
        investments[index].usdAmount -= amountToSell
        investments.insert(soldInv, at: 0)
        saveInvestments()
    }
    
    func revertToHolding(id: UUID) {
        if let index = investments.firstIndex(where: { $0.id == id }) {
            investments[index].status = .holding
            investments[index].sellRate = nil
            investments[index].sellDate = nil
            saveInvestments()
        }
    }
    
    // MARK: - 통계 계산
    
    func calculateStats(currentRate: Double) -> InvestmentStats {
        let holdings = investments.filter { $0.status == .holding }
        let solds = investments.filter { $0.status == .sold }
        
        let totalUsd = holdings.reduce(0) { $0 + $1.usdAmount }
        let totalBuyKrw = holdings.reduce(0) { $0 + ($1.usdAmount * $1.buyRate) }
        let currentValKrw = totalUsd * currentRate
        let unrealizedProfit = currentValKrw - totalBuyKrw
        let avgRate = totalUsd > 0 ? totalBuyKrw / totalUsd : 0
        
        let today = formatDate(Date())
        let components = today.split(separator: ".")
        let thisYear = components.count >= 1 ? String(components[0]) + "." : ""
        let thisMonth = components.count >= 2 ? String(components[0]) + "." + String(components[1]) + "." : ""
        
        // 매도 환율이 없는 기록은 손익 0으로 본다. (저장 데이터 손상 시 앱이 종료되지 않도록)
        let realized: (FXInvestment) -> Double = { inv in
            guard let sellRate = inv.sellRate else { return 0 }
            return inv.usdAmount * (sellRate - inv.buyRate)
        }
        let realizedToday = solds.filter { $0.sellDate == today }.reduce(0) { $0 + realized($1) }
        let realizedMonth = solds.filter { $0.sellDate?.hasPrefix(thisMonth) ?? false }.reduce(0) { $0 + realized($1) }
        let realizedYear = solds.filter { $0.sellDate?.hasPrefix(thisYear) ?? false }.reduce(0) { $0 + realized($1) }
        
        let volumeToday = investments.filter { $0.date == today }.reduce(0) { $0 + ($1.usdAmount * $1.buyRate) } +
                          solds.filter { $0.sellDate == today }.reduce(0) { $0 + ($1.usdAmount * ($1.sellRate ?? 0)) }
        
        return InvestmentStats(
            totalHoldingUsd: totalUsd,
            totalHoldingBuyKrw: totalBuyKrw,
            unrealizedProfit: unrealizedProfit,
            avgBuyRate: avgRate,
            realizedToday: realizedToday,
            realizedMonth: realizedMonth,
            realizedYear: realizedYear,
            volumeToday: volumeToday
        )
    }
    
    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy.M.d."
        return formatter.string(from: date)
    }
}

struct InvestmentStats {
    let totalHoldingUsd: Double
    let totalHoldingBuyKrw: Double
    let unrealizedProfit: Double
    let avgBuyRate: Double
    let realizedToday: Double
    let realizedMonth: Double
    let realizedYear: Double
    let volumeToday: Double
}
