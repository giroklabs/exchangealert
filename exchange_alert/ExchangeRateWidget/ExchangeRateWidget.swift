import AppIntents
import SwiftUI
import WidgetKit

// 환율알라미 프로 전용 홈·잠금화면 위젯.
// 데이터는 앱과 같은 GitHub 파일을 직접 읽고, 프로 여부는 App Group에 앱이 저장한 값을 본다.

private let appGroupID = "group.com.giroklabs.exchangealert"
private let ratesURL = URL(string: "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json")!
private let historyURL = URL(string: "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/fx-chart-history.json")!

// MARK: - 통화 선택

enum WidgetCurrency: String, AppEnum, CaseIterable {
    case USD, EUR, JPY, CNH, GBP, HKD, THB, SGD, MYR, IDR, CHF, CAD, AUD, NZD, NOK, SEK, DKK, AED, BHD, BND, KWD, SAR

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "통화"
    static let caseDisplayRepresentations: [WidgetCurrency: DisplayRepresentation] = [
        .USD: "미국 달러", .EUR: "유로", .JPY: "일본 엔(100엔)", .CNH: "중국 위안", .GBP: "영국 파운드",
        .HKD: "홍콩 달러", .THB: "태국 바트", .SGD: "싱가포르 달러", .MYR: "말레이시아 링깃", .IDR: "인도네시아 루피아(100)",
        .CHF: "스위스 프랑", .CAD: "캐나다 달러", .AUD: "호주 달러", .NZD: "뉴질랜드 달러", .NOK: "노르웨이 크로네",
        .SEK: "스웨덴 크로나", .DKK: "덴마크 크로네", .AED: "UAE 디르함", .BHD: "바레인 디나르", .BND: "브루나이 달러",
        .KWD: "쿠웨이트 디나르", .SAR: "사우디 리얄",
    ]

    /// 데이터 파일에서는 위안화를 CNY로 적는다.
    var dataCodes: [String] { self == .CNH ? ["CNH", "CNY"] : [rawValue] }

    var unitNote: String? {
        switch self {
        case .JPY: return "100엔"
        case .IDR: return "100루피아"
        default: return nil
        }
    }
}

struct SelectCurrencyIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "통화 선택"
    static let description = IntentDescription("위젯에 표시할 통화를 고릅니다.")

    @Parameter(title: "통화", default: .USD)
    var currency: WidgetCurrency
}

// MARK: - 데이터

struct RateEntry: TimelineEntry {
    let date: Date
    let currency: WidgetCurrency
    let isPro: Bool
    let rate: Double?
    let change: Double?
    let history: [Double]
    let updatedAt: Date?

    var changePercent: Double? {
        guard let rate, let change, rate - change != 0 else { return nil }
        return change / (rate - change) * 100
    }

    static func placeholder(_ currency: WidgetCurrency = .USD) -> RateEntry {
        RateEntry(date: .now, currency: currency, isPro: true, rate: 1334.70, change: -2.8,
                  history: [1352, 1348, 1340, 1338, 1345, 1350, 1342, 1336, 1334.7], updatedAt: .now)
    }
}

private struct RateItem: Decodable {
    let cur_unit: String?
    let deal_bas_r: String?
    let fetched_at: String?
    let rate_date: String?
}

private struct HistoryFile: Decodable {
    let dates: [String]
    let rates: [String: [Double?]]
}

enum RateLoader {
    static func load(_ currency: WidgetCurrency) async -> (rate: Double?, updatedAt: Date?, history: [Double]) {
        async let ratesData = fetch(ratesURL)
        async let historyData = fetch(historyURL)

        var rate: Double?
        var updatedAt: Date?
        if let data = await ratesData, let items = try? JSONDecoder().decode([RateItem].self, from: data) {
            for item in items {
                if item.cur_unit == "META" {
                    // 수출입은행 고시일이 있으면 그 날짜, 없으면 수집 시각
                    updatedAt = item.rate_date.flatMap(parseDay) ?? item.fetched_at.flatMap(parseDate)
                }
                if let code = item.cur_unit, currency.dataCodes.contains(code),
                   let value = Double((item.deal_bas_r ?? "").replacingOccurrences(of: ",", with: "")), value > 0 {
                    rate = value
                }
            }
        }

        var history: [Double] = []
        if let data = await historyData, let file = try? JSONDecoder().decode(HistoryFile.self, from: data) {
            let series = currency.dataCodes.lazy.compactMap { file.rates[$0] }.first ?? []
            history = Array(series.compactMap { $0 }.suffix(30))
        }
        return (rate, updatedAt, history)
    }

    private static func fetch(_ url: URL) async -> Data? {
        var request = URLRequest(url: url)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        request.timeoutInterval = 15
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return data
    }

    private static func parseDay(_ text: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: text)
    }

    private static func parseDate(_ text: String) -> Date? {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ssZ"
        return formatter.date(from: text)
    }
}

struct RateProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> RateEntry { .placeholder() }

    func snapshot(for configuration: SelectCurrencyIntent, in context: Context) async -> RateEntry {
        context.isPreview ? .placeholder(configuration.currency) : await makeEntry(configuration.currency)
    }

    func timeline(for configuration: SelectCurrencyIntent, in context: Context) async -> Timeline<RateEntry> {
        let entry = await makeEntry(configuration.currency)
        // 환율은 영업일 하루 1회 고시된다. 고시 직후를 놓치지 않도록 1시간 간격으로 새로 읽는다.
        return Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(60 * 60)))
    }

    private func makeEntry(_ currency: WidgetCurrency) async -> RateEntry {
        let isPro = UserDefaults(suiteName: appGroupID)?.bool(forKey: "isProUnlocked") ?? false
        guard isPro else {
            return RateEntry(date: .now, currency: currency, isPro: false, rate: nil, change: nil, history: [], updatedAt: nil)
        }
        let loaded = await RateLoader.load(currency)
        // 전일 대비: 일별 기록의 직전 값과 비교한다. (기록의 마지막 값이 오늘이면 그 앞 값)
        var change: Double?
        if let rate = loaded.rate, loaded.history.count >= 2 {
            let last = loaded.history[loaded.history.count - 1]
            let previous = abs(last - rate) < 0.0001 ? loaded.history[loaded.history.count - 2] : last
            change = rate - previous
        }
        return RateEntry(date: .now, currency: currency, isPro: true, rate: loaded.rate,
                         change: change, history: loaded.history, updatedAt: loaded.updatedAt)
    }
}

// MARK: - 화면

private let rising = Color.red
private let falling = Color.blue

private func rateText(_ value: Double) -> String {
    value.formatted(.number.precision(.fractionLength(2)))
}

private func changeColor(_ value: Double?) -> Color {
    guard let value else { return .secondary }
    return value > 0 ? rising : (value < 0 ? falling : .secondary)
}

private func changeText(_ entry: RateEntry) -> String {
    guard let change = entry.change else { return "" }
    let sign = change > 0 ? "▲" : (change < 0 ? "▼" : "")
    let percent = entry.changePercent.map { String(format: " (%+.2f%%)", $0) } ?? ""
    return "\(sign)\(rateText(abs(change)))\(percent)"
}

struct ExchangeRateWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: RateEntry

    var body: some View {
        Group {
            if !entry.isPro {
                lockedView
            } else {
                switch family {
                case .accessoryInline: inlineView
                case .accessoryCircular: circularView
                case .accessoryRectangular: rectangularView
                case .systemMedium: mediumView
                default: smallView
                }
            }
        }
        .containerBackground(for: .widget) { Color(.systemBackground) }
    }

    private var lockedView: some View {
        VStack(spacing: 4) {
            Image(systemName: "lock.fill")
            Text(family == .accessoryInline ? "환율알라미 프로 전용" : "프로 전용 위젯")
                .font(.caption.weight(.semibold))
            if family == .systemSmall || family == .systemMedium {
                Text("앱의 설정에서 프로를 활성화하세요")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var header: some View {
        HStack(spacing: 4) {
            Text(entry.currency.rawValue)
                .font(.headline)
            if let unit = entry.currency.unitNote {
                Text(unit).font(.caption2).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
    }

    private var rateView: some View {
        Text(entry.rate.map(rateText) ?? "--")
            .font(.system(size: 26, weight: .bold).monospacedDigit())
            .minimumScaleFactor(0.6)
            .lineLimit(1)
    }

    private var updatedText: some View {
        Text(entry.updatedAt.map { $0.formatted(.dateTime.month(.defaultDigits).day()) + " 고시" } ?? "")
            .font(.caption2)
            .foregroundStyle(.secondary)
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 4) {
            header
            Spacer(minLength: 0)
            rateView
            Text(changeText(entry))
                .font(.caption.weight(.semibold).monospacedDigit())
                .foregroundStyle(changeColor(entry.change))
            updatedText
        }
    }

    private var mediumView: some View {
        HStack(spacing: 12) {
            smallView
            Sparkline(values: entry.history, color: changeColor(entry.change))
                .frame(maxWidth: .infinity)
        }
    }

    private var rectangularView: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("\(entry.currency.rawValue)/KRW")
                .font(.caption2.weight(.semibold))
                .widgetAccentable()
            Text(entry.rate.map(rateText) ?? "--")
                .font(.title3.weight(.bold).monospacedDigit())
            Text(changeText(entry))
                .font(.caption2.monospacedDigit())
        }
    }

    private var circularView: some View {
        VStack(spacing: 0) {
            Text(entry.currency.rawValue)
                .font(.system(size: 10, weight: .semibold))
            Text(entry.rate.map { $0.formatted(.number.precision(.fractionLength(0))) } ?? "--")
                .font(.system(size: 15, weight: .bold).monospacedDigit())
                .minimumScaleFactor(0.5)
        }
    }

    private var inlineView: some View {
        Text("\(entry.currency.rawValue) \(entry.rate.map(rateText) ?? "--") \(changeText(entry))")
    }
}

/// 최근 30일 일별 환율 선.
struct Sparkline: View {
    let values: [Double]
    let color: Color

    var body: some View {
        GeometryReader { geo in
            if values.count > 1, let low = values.min(), let high = values.max() {
                let range = max(high - low, 0.0001)
                Path { path in
                    for (index, value) in values.enumerated() {
                        let x = geo.size.width * CGFloat(index) / CGFloat(values.count - 1)
                        let y = geo.size.height * (1 - CGFloat((value - low) / range))
                        index == 0 ? path.move(to: CGPoint(x: x, y: y)) : path.addLine(to: CGPoint(x: x, y: y))
                    }
                }
                .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
            }
        }
        .padding(.vertical, 8)
    }
}

// MARK: - 위젯

struct ExchangeRateWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "ExchangeRateWidget", intent: SelectCurrencyIntent.self, provider: RateProvider()) { entry in
            ExchangeRateWidgetView(entry: entry)
        }
        .configurationDisplayName("환율")
        .description("선택한 통화의 매매기준율과 전일 대비 변동을 보여줍니다. (프로)")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

@main
struct ExchangeRateWidgetBundle: WidgetBundle {
    var body: some Widget {
        ExchangeRateWidget()
    }
}
