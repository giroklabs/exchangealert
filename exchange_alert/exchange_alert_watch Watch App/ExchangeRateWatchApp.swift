import SwiftUI

@main
struct ExchangeRateWatchApp: App {
    @StateObject private var exchangeManager = WatchExchangeManager()
    
    var body: some Scene {
        WindowGroup {
            WatchContentView()
                .environmentObject(exchangeManager)
        }
    }
}
