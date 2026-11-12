import SwiftUI
import Charts

// MARK: - 일별 환율 기록 (서버가 만든 data/fx-chart-history.json)

struct RateHistoryPoint: Identifiable, Equatable {
    let date: Date
    let rate: Double
    var id: Date { date }
}

private struct ChartHistoryFile: Decodable {
    let updatedAt: String?
    let dates: [String]
    let rates: [String: [Double?]]
}

@MainActor
final class RateHistoryStore: ObservableObject {
    static let shared = RateHistoryStore()

    @Published private(set) var file: ChartHistoryFileData?
    @Published private(set) var isLoading = false
    @Published private(set) var failed = false

    private let url = URL(string: "https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/fx-chart-history.json")!
    private let refreshInterval: TimeInterval = 30 * 60
    private var lastFetch: Date?

    private var cacheURL: URL? {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("fx-chart-history.json")
    }

    private init() {
        if let cacheURL, let data = try? Data(contentsOf: cacheURL) {
            file = ChartHistoryFileData(data: data)
        }
    }

    func points(for currency: CurrencyType) -> [RateHistoryPoint] {
        file?.points[currency.rawValue] ?? []
    }

    func refreshIfNeeded() {
        if isLoading { return }
        if let lastFetch, Date().timeIntervalSince(lastFetch) < refreshInterval, file != nil { return }
        isLoading = true
        Task {
            defer { isLoading = false }
            do {
                var request = URLRequest(url: url)
                request.cachePolicy = .reloadIgnoringLocalCacheData
                request.timeoutInterval = 15
                let (data, response) = try await URLSession.shared.data(for: request)
                guard (response as? HTTPURLResponse)?.statusCode == 200,
                      let parsed = ChartHistoryFileData(data: data) else {
                    failed = file == nil
                    return
                }
                file = parsed
                failed = false
                lastFetch = Date()
                if let cacheURL { try? data.write(to: cacheURL, options: .atomic) }
            } catch {
                failed = file == nil
            }
        }
    }
}

struct ChartHistoryFileData {
    let points: [String: [RateHistoryPoint]]

    init?(data: Data) {
        guard let raw = try? JSONDecoder().decode(ChartHistoryFile.self, from: data) else { return nil }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "Asia/Seoul")
        formatter.dateFormat = "yyyy-MM-dd"
        let dates = raw.dates.map { formatter.date(from: $0) }

        var result: [String: [RateHistoryPoint]] = [:]
        for (code, values) in raw.rates {
            var series: [RateHistoryPoint] = []
            for (index, value) in values.enumerated() where index < dates.count {
                if let date = dates[index], let value, value > 0 {
                    series.append(RateHistoryPoint(date: date, rate: value))
                }
            }
            result[code] = series
        }
        guard !result.isEmpty else { return nil }
        points = result
    }
}

// MARK: - 기간

enum ChartPeriod: String, CaseIterable, Identifiable {
    case month1 = "1개월"
    case month3 = "3개월"
    case month6 = "6개월"
    case year1 = "1년"

    var id: String { rawValue }

    var months: Int {
        switch self {
        case .month1: return 1
        case .month3: return 3
        case .month6: return 6
        case .year1: return 12
        }
    }
}

// MARK: - 차트 카드

struct RateChartCard: View {
    let currency: CurrencyType
    @ObservedObject private var store = RateHistoryStore.shared
    @AppStorage("chartPeriod") private var periodRaw = ChartPeriod.month3.rawValue
    @State private var selectedDate: Date?

    private var period: ChartPeriod { ChartPeriod(rawValue: periodRaw) ?? .month3 }

    private var points: [RateHistoryPoint] {
        let all = store.points(for: currency)
        guard let last = all.last?.date,
              let start = Calendar.current.date(byAdding: .month, value: -period.months, to: last) else { return all }
        return all.filter { $0.date >= start }
    }

    var body: some View {
        CardView(cornerRadius: 16, shadowRadius: 8) {
            VStack(alignment: .leading, spacing: 12) {
                header
                Picker("기간", selection: $periodRaw) {
                    ForEach(ChartPeriod.allCases) { Text($0.rawValue).tag($0.rawValue) }
                }
                .pickerStyle(.segmented)

                content
                    .frame(height: 200)
            }
        }
        .onAppear { store.refreshIfNeeded() }
        .onChange(of: currency) { _, _ in selectedDate = nil }
        .onChange(of: periodRaw) { _, _ in selectedDate = nil }
    }

    // MARK: 헤더 (선택한 날짜 또는 기간 변동)

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Text("환율 추이")
                    .font(AppTheme.headlineFont)
                if let unit = currency.quoteUnitLabel {
                    Text(unit)
                        .font(AppTheme.captionFont)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }

            if let selected = selectedPoint {
                HStack(spacing: 6) {
                    Text(Self.dayFormatter.string(from: selected.date))
                        .foregroundColor(.secondary)
                    Text("\(Self.rateText(selected.rate))원")
                        .fontWeight(.semibold)
                }
                .font(AppTheme.subheadlineFont.monospacedDigit())
            } else if let first = points.first, let last = points.last, points.count > 1 {
                let diff = last.rate - first.rate
                let percent = first.rate > 0 ? diff / first.rate * 100 : 0
                HStack(spacing: 6) {
                    Text("\(period.rawValue) 전보다")
                        .foregroundColor(.secondary)
                    Text("\(diff >= 0 ? "▲" : "▼") \(Self.rateText(abs(diff)))원 (\(String(format: "%+.2f", percent))%)")
                        .fontWeight(.semibold)
                        .foregroundColor(trendColor)
                }
                .font(AppTheme.subheadlineFont.monospacedDigit())
            } else {
                Text(" ").font(AppTheme.subheadlineFont)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if points.count > 1 {
            chart
        } else if store.isLoading || (!store.failed && store.file == nil) {
            ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            VStack(spacing: 8) {
                Image(systemName: "chart.xyaxis.line")
                    .font(.title2)
                    .foregroundColor(.secondary)
                Text(store.failed ? "기록을 불러오지 못했습니다" : "표시할 기록이 없습니다")
                    .font(AppTheme.captionFont)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private var trendColor: Color {
        guard let first = points.first?.rate, let last = points.last?.rate else { return .secondary }
        if last > first { return AppTheme.rising }
        if last < first { return AppTheme.falling }
        return .secondary
    }

    private var yDomain: ClosedRange<Double> {
        let rates = points.map(\.rate)
        guard let low = rates.min(), let high = rates.max() else { return 0...1 }
        let pad = max((high - low) * 0.12, high * 0.002)
        return (low - pad)...(high + pad)
    }

    private var selectedPoint: RateHistoryPoint? {
        guard let selectedDate else { return nil }
        return points.min { abs($0.date.timeIntervalSince(selectedDate)) < abs($1.date.timeIntervalSince(selectedDate)) }
    }

    private var chart: some View {
        let color = trendColor
        return Chart {
            ForEach(points) { point in
                AreaMark(
                    x: .value("날짜", point.date),
                    yStart: .value("하단", yDomain.lowerBound),
                    yEnd: .value("환율", point.rate)
                )
                .foregroundStyle(
                    LinearGradient(colors: [color.opacity(0.22), color.opacity(0.0)], startPoint: .top, endPoint: .bottom)
                )
                .interpolationMethod(.monotone)

                LineMark(x: .value("날짜", point.date), y: .value("환율", point.rate))
                    .foregroundStyle(color)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                    .interpolationMethod(.monotone)
            }

            if let selected = selectedPoint {
                RuleMark(x: .value("선택", selected.date))
                    .foregroundStyle(Color.secondary.opacity(0.5))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 3]))
                PointMark(x: .value("선택", selected.date), y: .value("환율", selected.rate))
                    .foregroundStyle(color)
                    .symbolSize(50)
            }
        }
        .chartYScale(domain: yDomain)
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) { _ in
                AxisGridLine().foregroundStyle(Color.secondary.opacity(0.15))
                // 눈금 가운데에 두어 오른쪽 끝 날짜가 잘리지 않게 한다.
                AxisValueLabel(format: .dateTime.month(.defaultDigits).day(), anchor: .top)
            }
        }
        .chartYAxis {
            AxisMarks(position: .trailing, values: .automatic(desiredCount: 4)) { value in
                AxisGridLine().foregroundStyle(Color.secondary.opacity(0.15))
                AxisValueLabel {
                    if let rate = value.as(Double.self) { Text(Self.axisText(rate)) }
                }
            }
        }
        .chartXSelection(value: $selectedDate)
        .accessibilityLabel("\(currency.displayName) \(period.rawValue) 환율 추이")
    }

    // MARK: 포맷

    private static let dayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "ko_KR")
        f.dateFormat = "yyyy.M.d.(E)"
        return f
    }()

    static func rateText(_ value: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f.string(from: NSNumber(value: value)) ?? String(format: "%.2f", value)
    }

    static func axisText(_ value: Double) -> String {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.maximumFractionDigits = value < 100 ? 2 : 0
        return f.string(from: NSNumber(value: value)) ?? "\(value)"
    }
}
