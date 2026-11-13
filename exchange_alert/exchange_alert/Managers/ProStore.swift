import Foundation
import StoreKit
import WidgetKit

/// 환율알라미 프로 평생 이용권 (비소모성 1회 결제).
/// 구매 확인은 StoreKit 2가 기기 안에서 서명을 검증하므로 서버가 필요 없다.
@MainActor
final class ProStore: ObservableObject {
    static let shared = ProStore()

    /// App Store Connect에 같은 ID로 비소모성 상품을 만들어야 한다.
    static let productID = "com.greego86.exchangealert.pro.lifetime"
    /// 프로 출시 전까지 false. false면 프로 화면·버튼이 숨고, 구매 확인도 하지 않으며 모두 무료 사용자로 동작한다.
    /// 다시 켤 때는 이 값과 함께 위젯 확장의 앱 임베드(project.pbxproj)도 되돌린다.
    static let isFeatureEnabled = false
    /// 위젯이 프로 여부를 읽을 수 있도록 App Group에 함께 저장한다.
    static let appGroupID = "group.com.giroklabs.exchangealert"
    static let defaultsKey = "isProUnlocked"

    @Published private(set) var isPro: Bool
    @Published private(set) var product: Product?
    @Published private(set) var isPurchasing = false
    @Published var message: String?

    private var updatesTask: Task<Void, Never>?

    private init() {
        guard Self.isFeatureEnabled else {
            isPro = false
            return
        }
        // 마지막으로 확인한 상태로 먼저 그려서 광고가 잠깐 보였다 사라지지 않게 한다.
        isPro = UserDefaults(suiteName: Self.appGroupID)?.bool(forKey: Self.defaultsKey) ?? false
        updatesTask = Task { [weak self] in
            for await update in Transaction.updates {
                if case .verified(let transaction) = update {
                    await transaction.finish()
                }
                await self?.refreshEntitlement()
            }
        }
        Task {
            await refreshEntitlement()
            await loadProduct()
        }
    }

    var priceText: String { product?.displayPrice ?? "" }

    func loadProduct() async {
        guard product == nil else { return }
        do {
            product = try await Product.products(for: [Self.productID]).first
        } catch {
            NSLog("⚠️ [Pro] 상품 정보를 불러오지 못했습니다: \(error.localizedDescription)")
        }
    }

    func refreshEntitlement() async {
        #if DEBUG
        // 시뮬레이터에서 프로 화면을 확인하기 위한 실행 인자 (-previewPro). 출시 빌드에는 포함되지 않는다.
        if ProcessInfo.processInfo.arguments.contains("-previewPro") {
            setPro(true)
            return
        }
        #endif
        var unlocked = false
        for await entitlement in Transaction.currentEntitlements {
            if case .verified(let transaction) = entitlement,
               transaction.productID == Self.productID,
               transaction.revocationDate == nil {
                unlocked = true
            }
        }
        setPro(unlocked)
    }

    func purchase() async {
        await loadProduct()
        guard let product else {
            message = "상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
            return
        }
        isPurchasing = true
        defer { isPurchasing = false }
        do {
            switch try await product.purchase() {
            case .success(let verification):
                if case .verified(let transaction) = verification {
                    await transaction.finish()
                    setPro(true)
                    message = "프로가 활성화되었습니다. 감사합니다!"
                } else {
                    message = "구매를 확인하지 못했습니다. 구매 복원을 눌러 주세요."
                }
            case .pending:
                message = "결제 승인을 기다리고 있습니다. 승인되면 자동으로 활성화됩니다."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            message = "결제를 완료하지 못했습니다. (\(error.localizedDescription))"
        }
    }

    func restore() async {
        isPurchasing = true
        defer { isPurchasing = false }
        do {
            try await AppStore.sync()
        } catch {
            message = "구매 내역을 불러오지 못했습니다. (\(error.localizedDescription))"
            return
        }
        await refreshEntitlement()
        message = isPro ? "프로 구매를 복원했습니다." : "복원할 구매 내역이 없습니다."
    }

    private func setPro(_ value: Bool) {
        let defaults = UserDefaults(suiteName: Self.appGroupID)
        let changed = defaults?.bool(forKey: Self.defaultsKey) != value
        defaults?.set(value, forKey: Self.defaultsKey)
        if isPro != value { isPro = value }
        if changed { WidgetCenter.shared.reloadAllTimelines() }
    }
}
