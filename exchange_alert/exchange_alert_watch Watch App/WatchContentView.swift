import SwiftUI

struct WatchContentView: View {
    @EnvironmentObject var manager: WatchExchangeManager
    
    var body: some View {
        NavigationView {
            List {
                if manager.exchangeRates.isEmpty && manager.isLoading {
                    VStack {
                        ProgressView()
                        Text("환율 로딩 중...")
                            .font(WatchTheme.captionFont())
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, minHeight: 100)
                    .listRowBackground(Color.clear)
                } else {
                    Section {
                        ForEach(manager.watchedCurrencies, id: \.self) { currency in
                            if let rate = manager.exchangeRates[currency] {
                                CurrencyRow(currency: currency, rate: rate)
                            }
                        }
                    }
                    
                    Section {
                        NavigationLink(destination: WatchSettingsView()) {
                            HStack {
                                Image(systemName: "line.3.horizontal.decrease.circle")
                                    .foregroundColor(WatchTheme.primary)
                                Text("관심 통화 설정")
                                    .font(WatchTheme.bodyFont(size: 13))
                            }
                            .padding(.vertical, 4)
                        }
                    }
                    
                    if let notice = manager.rateNoticeDate {
                        Text("\(formatDay(notice)) 고시 · 한국수출입은행")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                            .listRowBackground(Color.clear)
                    } else if let lastUpdate = manager.lastUpdateTime {
                        Text("업데이트: \(formatDate(lastUpdate))")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                            .listRowBackground(Color.clear)
                    }
                }
            }
            .listStyle(.carousel)
            .navigationTitle {
                HStack {
                    Image(systemName: "dollarsign.circle.fill")
                        .foregroundColor(WatchTheme.primary)
                    Text("환율알라미")
                        .font(WatchTheme.titleFont(size: 14))
                }
            }
            .refreshable {
                manager.fetchExchangeRates()
            }
        }
    }
    
    private func formatDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        formatter.dateFormat = "M/d(E)"
        return formatter.string(from: date)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "M/d HH:mm"
        return formatter.string(from: date)
    }
}

struct CurrencyRow: View {
    let currency: CurrencyType
    let rate: ExchangeRate
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .center, spacing: 4) {
                Text(currency.rawValue)
                    .font(WatchTheme.titleFont(size: 15))
                    .foregroundColor(WatchTheme.primary)
                    .layoutPriority(0)
                
                Spacer(minLength: 4)
                
                Text(rate.dealBasR ?? "0")
                    .font(.system(size: 18, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .fixedSize(horizontal: true, vertical: false)
                    .layoutPriority(1)
            }
            
            HStack {
                Text(currency.displayName)
                    .font(WatchTheme.captionFont(size: 10))
                    .foregroundColor(.secondary)
                
                Spacer()
                
                HStack(spacing: 4) {
                    Image(systemName: "wonsign.circle")
                        .font(.system(size: 8))
                    Text("KRW")
                        .font(.system(size: 9, weight: .medium))
                }
                .foregroundColor(.secondary)
                .padding(.horizontal, 4)
                .padding(.vertical, 1)
                .background(Color.white.opacity(0.1))
                .cornerRadius(4)
            }
        }
        .padding(.vertical, 6)
    }
}

#Preview {
    WatchContentView()
        .environmentObject(WatchExchangeManager())
}
