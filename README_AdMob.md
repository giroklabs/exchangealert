# AdMob 광고 설정 가이드

## 개요
콜레스테롤 트래커 앱에 Google AdMob 배너광고를 추가한 설정 가이드입니다.

## 광고 정보
- **앱 ID**: `ca-app-pub-4376736198197573~4581439845`
- **광고 단위 ID**: `ca-app-pub-4376736198197573/9331611138`
- **광고 위치**: AddRecordView 화면 최하단 (저장 버튼 아래)
- **광고 크기**: 50pt 높이의 표준 배너광고

## 설치된 구성 요소

### 1. CocoaPods 설정
- **Podfile**: `cholesteroltracker/Podfile`
- **설치된 SDK**: Google-Mobile-Ads-SDK
- **설치 명령어**: `pod install --repo-update`

### 2. Info.plist 설정
- **파일 위치**: `cholesteroltracker/Info.plist`
- **추가된 키**: `GADApplicationIdentifier`
- **값**: `ca-app-pub-4376736198197573~4581439845`

### 3. 생성된 파일들
- **AdMobBannerView.swift**: SwiftUI용 배너광고 래퍼 컴포넌트
- **AddRecordView.swift**: 배너광고가 추가된 메인 화면

## 해결된 에러들

### 1. "Missing bundle ID" 에러
**문제**: Bundle Identifier가 Info.plist에 설정되지 않음
**해결방법**: 
```xml
<key>CFBundleIdentifier</key>
<string>com.greego86.cholesteroltracker</string>
<key>CFBundleVersion</key>
<string>1.0</string>
<key>CFBundleShortVersionString</key>
<string>1.0</string>
<key>CFBundleExecutable</key>
<string>cholesteroltracker</string>
```

### 2. "CFBundleExecutable" 에러
**문제**: 실행 파일 이름이 Info.plist에 없음
**해결방법**: Info.plist에 필수 키들 추가
```xml
<key>CFBundlePackageType</key>
<string>APPL</string>
<key>LSRequiresIPhoneOS</key>
<true/>
<key>UILaunchStoryboardName</key>
<string>LaunchScreen</string>
<key>UISupportedInterfaceOrientations</key>
<array>
    <string>UIInterfaceOrientationPortrait</string>
    <string>UIInterfaceOrientationLandscapeLeft</string>
    <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```

### 3. "GENERATE_INFOPLIST_FILE" 설정 문제
**문제**: Xcode가 자동으로 Info.plist를 생성하여 수동 설정이 무시됨
**해결방법**: 
- `GENERATE_INFOPLIST_FILE = NO`로 변경
- `INFOPLIST_FILE = cholesteroltracker/Info.plist` 추가

### 4. Google Mobile Ads SDK API 변경
**문제**: `GADBannerView`가 `BannerView`로 이름 변경됨
**해결방법**: 최신 API 사용
```swift
// 이전 (에러 발생)
func makeUIView(context: Context) -> GADBannerView {
    let bannerView = GADBannerView(adSize: GADAdSizeBanner)
    // ...
}

// 수정 후 (정상 작동)
func makeUIView(context: Context) -> BannerView {
    let bannerView = BannerView(adSize: AdSizeBanner)
    // ...
}
```

### 5. AdMob 초기화 에러
**문제**: `GADMobileAds.sharedInstance().start()` 호출 시 에러 발생
**해결방법**: AdMob 초기화를 제거하고 배너광고만 사용
```swift
// CholesterolTrackerApp.swift에서 초기화 코드 제거
import SwiftUI

@main
struct CholesterolTrackerApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

## 현재 상태

### ✅ 완료된 작업
1. CocoaPods로 Google Mobile Ads SDK 설치
2. Info.plist에 AdMob 앱 ID 설정
3. AdMobBannerView SwiftUI 컴포넌트 생성
4. AddRecordView에 배너광고 추가
5. GENERATE_INFOPLIST_FILE 설정 수정
6. 최신 Google Mobile Ads SDK API 사용
7. 모든 컴파일 에러 해결

### ⚠️ 알려진 이슈
1. **AdMob 초기화 없음**: 현재 AdMob SDK가 초기화되지 않아 런타임에 경고 메시지가 발생할 수 있음
2. **광고 로딩**: 실제 광고가 아닌 테스트 광고를 사용해야 함
3. **네트워크 의존성**: 광고 로드를 위해 인터넷 연결이 필요함

## 사용 방법

### 1. 프로젝트 실행
```bash
cd /Users/greego/Desktop/CholesterolTrackerApp/cholesteroltracker
open cholesteroltracker.xcworkspace
```

### 2. 시뮬레이터에서 테스트
- iPhone 16 시뮬레이터에서 앱 실행
- "수치 기록하기" 화면으로 이동
- 화면 최하단에 배너광고 확인

### 3. 실제 기기에서 테스트
- 실제 iOS 기기에서 앱 실행
- 인터넷 연결 확인
- 광고 로딩 상태 확인

## 파일 구조
```
cholesteroltracker/
├── Podfile
├── cholesteroltracker.xcworkspace
├── cholesteroltracker/
│   ├── Info.plist
│   ├── AdMobBannerView.swift
│   ├── AddRecordView.swift
│   └── CholesterolTrackerApp.swift
└── README_AdMob.md (이 파일)
```

## 추가 설정 필요사항

### 1. AdMob 계정 설정
- Google AdMob 계정 생성
- 앱 등록 및 광고 단위 생성
- 실제 광고 단위 ID로 교체

### 2. 테스트 광고 설정
- 개발 중에는 테스트 광고 사용 권장
- 테스트 광고 단위 ID: `ca-app-pub-3940256099942544/6300978111`

### 3. 광고 정책 준수
- Google AdMob 정책 준수
- 사용자 경험 고려한 광고 배치
- 개인정보 보호 정책 업데이트

## 문제 해결

### 광고가 표시되지 않는 경우
1. 인터넷 연결 확인
2. AdMob 계정 상태 확인
3. 광고 단위 ID 확인
4. 앱 ID 설정 확인
5. 시뮬레이터 vs 실제 기기 테스트

### 빌드 에러가 발생하는 경우
1. `pod install --repo-update` 실행
2. Xcode 클린 빌드 실행
3. DerivedData 폴더 삭제
4. 프로젝트 재설정

## 참고 자료
- [Google Mobile Ads SDK 문서](https://developers.google.com/admob/ios/quick-start)
- [AdMob 정책](https://support.google.com/admob/answer/6123)
- [iOS 광고 가이드라인](https://developer.apple.com/app-store/review/guidelines/#advertising)

---
**작성일**: 2025년 9월 24일  
**작성자**: AI Assistant  
**프로젝트**: 콜레스테롤 트래커 앱
