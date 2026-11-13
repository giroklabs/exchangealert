import SwiftUI

struct WatchSettingsView: View {
    @EnvironmentObject var manager: WatchExchangeManager
    
    var body: some View {
        List {
            Section(header: Text("표시할 통화 선택").font(WatchTheme.captionFont())) {
                ForEach(CurrencyType.allCases, id: \.self) { currency in
                    Button(action: {
                        manager.toggleCurrency(currency)
                    }) {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(currency.rawValue)
                                    .font(WatchTheme.titleFont(size: 14))
                                Text(currency.displayName)
                                    .font(WatchTheme.captionFont(size: 10))
                                    .foregroundColor(.secondary)
                            }
                            
                            Spacer()
                            
                            if manager.watchedCurrencies.contains(currency) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(WatchTheme.primary)
                            } else {
                                Image(systemName: "circle")
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("통화 설정")
    }
}

#Preview {
    WatchSettingsView()
        .environmentObject(WatchExchangeManager())
}
