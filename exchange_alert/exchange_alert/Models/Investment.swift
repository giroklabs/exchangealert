import Foundation

enum InvestmentStatus: String, Codable, CaseIterable {
    case holding = "holding"
    case sold = "sold"
}

struct FXInvestment: Identifiable, Codable {
    let id: UUID
    var date: String // YYYY-MM-DD
    var usdAmount: Double
    var buyRate: Double
    var sellRate: Double?
    var sellDate: String?
    var status: InvestmentStatus
    var memo: String
    
    init(id: UUID = UUID(), date: String, usdAmount: Double, buyRate: Double, sellRate: Double? = nil, sellDate: String? = nil, status: InvestmentStatus = .holding, memo: String = "") {
        self.id = id
        self.date = date
        self.usdAmount = usdAmount
        self.buyRate = buyRate
        self.sellRate = sellRate
        self.sellDate = sellDate
        self.status = status
        self.memo = memo
    }
}
