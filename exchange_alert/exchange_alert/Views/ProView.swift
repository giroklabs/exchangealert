import SwiftUI

/// 환율알라미 프로 안내·구매 화면.
struct ProView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var store = ProStore.shared

    private let features: [(icon: String, title: String, detail: String)] = [
        ("nosign", "광고 제거", "화면 아래 배너 광고가 사라집니다"),
        ("rectangle.on.rectangle", "홈·잠금화면 위젯", "앱을 열지 않고 환율을 바로 확인합니다"),
        ("chart.line.uptrend.xyaxis", "차트에 평단·목표가 선", "내 평균 매수가와 알림 목표가를 차트에 표시합니다"),
    ]

    var body: some View {
        ZStack(alignment: .top) {
            AppTheme.backgroundGradient.ignoresSafeArea()

            VStack(spacing: 0) {
                SheetHeader(title: "환율알라미 프로", onClose: { dismiss() })

                ScrollView {
                    VStack(alignment: .leading, spacing: 24) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(store.isPro ? "프로를 사용 중입니다" : "한 번 결제로 평생 사용")
                                .font(AppTheme.titleFont)
                            Text(store.isPro ? "응원해 주셔서 감사합니다." : "구독이 아닙니다. 추가 결제 없이 앞으로의 업데이트에도 계속 적용됩니다.")
                                .font(AppTheme.subheadlineFont)
                                .foregroundColor(.secondary)
                        }

                        CardView(cornerRadius: 16, shadowRadius: 8) {
                            VStack(alignment: .leading, spacing: 18) {
                                ForEach(features, id: \.title) { feature in
                                    HStack(alignment: .top, spacing: 14) {
                                        Image(systemName: feature.icon)
                                            .font(.title3)
                                            .foregroundColor(AppTheme.accentText)
                                            .frame(width: 28)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(feature.title)
                                                .font(AppTheme.headlineFont)
                                            Text(feature.detail)
                                                .font(AppTheme.subheadlineFont)
                                                .foregroundColor(.secondary)
                                        }
                                    }
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                        }

                        Text("환율 알림, 환율 추이 차트, 환차익 계산기는 지금처럼 무료로 계속 사용할 수 있습니다.")
                            .font(AppTheme.footnoteFont)
                            .foregroundColor(.secondary)
                    }
                    .padding(20)
                }

                footer
            }
        }
        .task { await store.loadProduct() }
        .alert("환율알라미 프로", isPresented: Binding(
            get: { store.message != nil },
            set: { if !$0 { store.message = nil } }
        )) {
            Button("확인", role: .cancel) { }
        } message: {
            Text(store.message ?? "")
        }
    }

    private var footer: some View {
        VStack(spacing: 10) {
            Divider()
            if store.isPro {
                Label("프로 활성화됨", systemImage: "checkmark.seal.fill")
                    .font(AppTheme.headlineFont)
                    .foregroundColor(AppTheme.accentText)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
            } else {
                Button {
                    Task { await store.purchase() }
                } label: {
                    Group {
                        if store.isPurchasing {
                            ProgressView().tint(AppTheme.onPrimary)
                        } else {
                            Text(store.priceText.isEmpty ? "프로 구매하기" : "\(store.priceText)에 평생 이용권 구매")
                        }
                    }
                    .font(AppTheme.headlineFont)
                    .foregroundColor(AppTheme.onPrimary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(AppTheme.primary)
                    .cornerRadius(14)
                }
                .disabled(store.isPurchasing)
            }

            Button("구매 복원") {
                Task { await store.restore() }
            }
            .font(AppTheme.subheadlineFont)
            .foregroundColor(.secondary)
            .disabled(store.isPurchasing)
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }
}

/// 무료 사용자에게 보여주는 작은 프로 표시.
struct ProBadge: View {
    var body: some View {
        Text("PRO")
            .font(.caption2.weight(.heavy))
            .foregroundColor(AppTheme.onPrimary)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(AppTheme.primary)
            .cornerRadius(4)
    }
}
