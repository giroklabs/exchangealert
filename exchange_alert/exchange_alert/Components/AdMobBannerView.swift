import SwiftUI
// import GoogleMobileAds  // TODO: Xcode에서 Swift Package Manager로 Google Mobile Ads SDK 추가 후 활성화

struct AdMobBannerView: UIViewRepresentable {
    let adUnitID: String
    
    init(adUnitID: String) {
        self.adUnitID = adUnitID
    }
    
    func makeUIView(context: Context) -> UIView {
        // TODO: 실제 AdMob 배너뷰 구현 (SDK 추가 후 활성화)
        /*
        let bannerView = GADBannerView(adSize: GADAdSizeBanner)
        bannerView.adUnitID = adUnitID
        bannerView.rootViewController = UIApplication.shared.windows.first?.rootViewController
        
        let request = GADRequest()
        bannerView.load(request)
        
        return bannerView
        */
        
        // 임시 플레이스홀더 뷰
        let placeholderView = UIView()
        placeholderView.backgroundColor = UIColor.systemGray6
        placeholderView.layer.cornerRadius = 8
        
        let label = UILabel()
        label.text = "AdMob 광고"
        label.textAlignment = .center
        label.textColor = UIColor.systemGray
        label.font = UIFont.systemFont(ofSize: 14)
        label.translatesAutoresizingMaskIntoConstraints = false
        
        placeholderView.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: placeholderView.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: placeholderView.centerYAnchor)
        ])
        
        return placeholderView
    }
    
    func updateUIView(_ uiView: UIView, context: Context) {
        // UIView 업데이트가 필요한 경우 여기에 코드 추가
    }
}

// MARK: - Preview
#Preview {
    AdMobBannerView(adUnitID: "ca-app-pub-4376736198197573/2141928354")
        .frame(height: 50)
}
