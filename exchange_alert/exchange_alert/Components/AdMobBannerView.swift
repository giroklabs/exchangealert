import SwiftUI
import GoogleMobileAds

struct AdMobBannerView: UIViewRepresentable {
    let adUnitID: String
    
    init(adUnitID: String) {
        self.adUnitID = adUnitID
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }
    
    func makeUIView(context: Context) -> BannerView {
        // AdSizeBanner는 자동으로 적절한 크기를 선택합니다 (iPhone: 320x50, iPad: 728x90)
        let bannerView = BannerView(adSize: AdSizeBanner)
        bannerView.adUnitID = adUnitID
        bannerView.delegate = context.coordinator
        
        // rootViewController 설정
        if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
           let window = windowScene.windows.first,
           let rootViewController = window.rootViewController {
            bannerView.rootViewController = rootViewController
        } else {
            // 대체 방법: 현재 뷰 컨트롤러 찾기
            DispatchQueue.main.async {
                if let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
                   let window = windowScene.windows.first,
                   let rootViewController = window.rootViewController {
                    bannerView.rootViewController = rootViewController
                }
            }
        }
        
        // 광고 로드
        let request = Request()
        bannerView.load(request)
        
        print("📢 AdMob 배너 광고 로드 시작: \(adUnitID)")
        
        return bannerView
    }
    
    func updateUIView(_ uiView: BannerView, context: Context) {
        // adUnitID가 변경된 경우에만 다시 로드
        if uiView.adUnitID != adUnitID {
            uiView.adUnitID = adUnitID
            let request = Request()
            uiView.load(request)
        }
    }
    
    class Coordinator: NSObject, BannerViewDelegate {
        func bannerViewDidReceiveAd(_ bannerView: BannerView) {
            print("✅ AdMob 배너 광고 로드 성공")
        }
        
        func bannerView(_ bannerView: BannerView, didFailToReceiveAdWithError error: Error) {
            print("❌ AdMob 배너 광고 로드 실패: \(error.localizedDescription)")
        }
        
        func bannerViewDidRecordImpression(_ bannerView: BannerView) {
            print("👁️ AdMob 배너 광고 노출 기록")
        }
        
        func bannerViewWillPresentScreen(_ bannerView: BannerView) {
            print("📱 AdMob 배너 광고 화면 표시")
        }
        
        func bannerViewWillDismissScreen(_ bannerView: BannerView) {
            print("👋 AdMob 배너 광고 화면 닫기")
        }
    }
}

// MARK: - Preview
#Preview {
    AdMobBannerView(adUnitID: "ca-app-pub-4376736198197573/9991728010")
        .frame(height: 50)
}
