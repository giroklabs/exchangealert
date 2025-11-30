# AdMob 정책 위반 가능성 분석 보고서

## 📋 분석 개요
- **분석 일자**: 2025년 1월
- **앱**: Exchange Alert (환율알라미)
- **광고 유형**: 배너 광고 (Banner Ad)
- **광고 단위 ID**: `ca-app-pub-4376736198197573/2141928354`
- **정책 위반 사유**: **무효 트래픽 우려로 인한 광고 게재 제한**

---

## 🚨 실제 정책 위반 사유: 무효 트래픽 (Invalid Traffic)

**AdMob 메시지**: "무효 트래픽 우려로 인해 현재 제품에 대한 광고 게재가 제한되고 있습니다"

무효 트래픽은 **의도치 않은 클릭(Accidental Clicks)**이 주된 원인입니다.

---

## ⚠️ 발견된 정책 위반 가능 사항

### 1. **의도치 않은 클릭 유도** 🔴 **매우 높음** ⚠️ **무효 트래픽의 주요 원인**

**현재 구현:**
```swift
.safeAreaInset(edge: .bottom) {
    // 광고가 화면 최하단에 고정 배치
    AdMobBannerView(adUnitID: "ca-app-pub-4376736198197573/2141928354")
        .frame(maxWidth: .infinity, maxHeight: 50)
        .padding(.horizontal, 16)
        .padding(.bottom, 6)
}
```

**문제점:**
- `safeAreaInset`을 사용하여 광고를 화면 최하단에 **항상 고정** 배치
- **스크롤과 관계없이 광고가 항상 화면에 표시**되어 사용자가 스크롤할 때 실수로 광고를 터치하기 쉬움
- 사용자가 콘텐츠를 읽거나 스크롤하려고 할 때 **의도치 않게 광고를 클릭**하게 만듦
- 이는 **무효 트래픽(Invalid Traffic)**의 주요 원인

**정책 위반 근거:**
- Google AdMob 정책: 광고가 의도치 않게 클릭되기 쉬운 위치에 배치되어서는 안 됨
- 의도치 않은 클릭은 무효 트래픽으로 간주되어 계정 제재를 받을 수 있음
- 광고는 사용자가 명확히 인식하고 의도적으로 클릭할 수 있어야 함

---

### 2. **광고와 콘텐츠 간격 부족으로 인한 실수 클릭** 🟡 **중간**

**현재 구현:**
```swift
VStack(spacing: 4) {  // ⚠️ spacing이 4pt로 매우 가까움
    // 제조사 로고 (우측정렬)
    HStack {
        Spacer()
        SignatureView()  // "by GIROK Labs."
    }
    .padding(.horizontal, 16)
    .padding(.bottom, 4)
    
    // AdMob 배너 광고
    AdMobBannerView(adUnitID: "...")
        .frame(maxWidth: .infinity, maxHeight: 50)
        .padding(.horizontal, 16)
        .padding(.bottom, 6)  // ⚠️ 하단 여백도 6pt로 부족
}
```

**문제점:**
- 광고가 앱의 SignatureView와 **너무 가까이** 배치됨 (spacing: 4pt)
- 사용자가 로고나 다른 요소를 터치하려고 할 때 **실수로 광고를 클릭**할 가능성
- 하단 여백이 6pt로 부족하여 화면 가장자리와 너무 가까움
- **의도치 않은 클릭을 유도**하는 배치

**정책 위반 근거:**
- AdMob 정책: 광고는 충분한 여백을 두고 배치되어야 하며, 의도치 않은 클릭을 유도해서는 안 됨

---

### 3. **스크롤 시 의도치 않은 광고 클릭** 🟡 **중간**

**현재 구현:**
- `ScrollView` 내부에 콘텐츠가 있음
- `safeAreaInset`으로 광고가 항상 하단에 고정됨
- 스크롤 제스처와 광고 터치가 겹칠 수 있음

**문제점:**
- 사용자가 스크롤하려고 할 때 **실수로 광고를 터치**할 가능성
- 특히 스크롤을 끝까지 내렸을 때 광고가 항상 보여서 **의도치 않은 클릭** 발생
- 작은 화면(iPhone SE 등)에서 더욱 문제가 됨
- 사용자가 콘텐츠를 읽으려고 할 때 광고가 방해가 되어 실수로 클릭하게 만듦

**정책 위반 근거:**
- AdMob 정책: 광고가 사용자의 정상적인 앱 사용을 방해하거나 의도치 않은 클릭을 유도해서는 안 됨

---

### 4. **광고 크기 및 여백 부족** 🟢 **낮음**

**현재 구현:**
```swift
AdMobBannerView(adUnitID: "...")
    .frame(maxWidth: .infinity, maxHeight: 50)
    .padding(.horizontal, 16)
    .padding(.bottom, 6)
```

**문제점:**
- 광고 하단 여백이 6pt로 매우 작음
- 광고와 화면 하단 가장자리 사이의 여백이 부족할 수 있음

**권장 사항:**
- 최소 8-12pt의 여백 권장

---

### 5. **키보드 처리 로직** 🟢 **양호**

**현재 구현:**
```swift
if !isKeyboardVisible {
    // 광고 표시
}
```

**평가:**
- 키보드가 표시될 때 광고를 숨기는 것은 **올바른 구현**
- 사용자 경험을 고려한 좋은 접근

---

## 🔧 권장 수정 사항

### 1. **앵커 광고 패턴 제거** (최우선)

**수정 전:**
```swift
.safeAreaInset(edge: .bottom) {
    AdMobBannerView(...)
}
```

**수정 후 (권장):**
```swift
ScrollView {
    // 콘텐츠
    VStack(spacing: 16) {
        // ... 기존 콘텐츠 ...
        
        // 광고를 ScrollView 내부에 배치
        VStack(spacing: 12) {
            SignatureView()
                .padding(.top, 20)
            
            AdMobBannerView(adUnitID: "ca-app-pub-4376736198197573/2141928354")
                .frame(maxWidth: .infinity, maxHeight: 50)
                .padding(.horizontal, 16)
                .padding(.bottom, 20)  // 충분한 하단 여백
        }
        .padding(.top, 20)
    }
}
```

**이점:**
- 앵커 광고 패턴 제거
- 스크롤 시 광고가 자연스럽게 콘텐츠와 함께 이동
- 콘텐츠 가림 문제 해결

---

### 2. **광고와 콘텐츠 간격 확대**

**수정:**
```swift
VStack(spacing: 16) {  // spacing을 4에서 16으로 증가
    SignatureView()
        .padding(.top, 20)  // 상단 여백 추가
    
    AdMobBannerView(...)
        .padding(.bottom, 20)  // 하단 여백 증가 (6 → 20)
}
```

---

### 3. **광고 시각적 구분 강화** (선택사항)

**추가 권장:**
- 광고 위/아래에 구분선 추가
- 광고 배경색을 약간 다르게 설정 (선택사항)

```swift
VStack(spacing: 0) {
    Divider()
        .padding(.top, 20)
    
    AdMobBannerView(...)
        .padding(.vertical, 12)
    
    Divider()
        .padding(.bottom, 8)
}
```

---

## 📊 위반 가능성 요약

| 항목 | 위반 가능성 | 심각도 | 우선순위 | 무효 트래픽 영향 |
|------|------------|--------|----------|-----------------|
| 의도치 않은 클릭 유도 (safeAreaInset) | 🔴 매우 높음 | 매우 높음 | **최우선** | ⚠️ **직접 원인** |
| 광고와 콘텐츠 간격 부족 | 🟡 중간 | 중간 | 높음 | ⚠️ **간접 원인** |
| 스크롤 시 실수 클릭 | 🟡 중간 | 중간 | 높음 | ⚠️ **간접 원인** |
| 여백 부족 | 🟢 낮음 | 낮음 | 중간 | - |

---

## ✅ 즉시 조치 필요 사항 (무효 트래픽 해결)

1. **`safeAreaInset` 제거** ⚠️ **최우선** - 의도치 않은 클릭의 주요 원인 제거
2. **광고를 ScrollView 내부로 이동** - 사용자가 의도적으로 스크롤하여 광고를 볼 수 있도록
3. **광고와 콘텐츠 간격 확대** - 최소 20pt 이상 (현재 4pt → 20pt)
4. **하단 여백 확대** - 최소 20pt 이상 (현재 6pt → 20pt)
5. **광고를 콘텐츠 끝에 자연스럽게 배치** - 사용자가 명확히 인식하고 선택적으로 볼 수 있도록

---

## 📚 참고 자료

- [Google AdMob 정책](https://support.google.com/admob/answer/6123)
- [AdMob 광고 배치 가이드라인](https://developers.google.com/admob/ios/banner)
- [iOS 광고 가이드라인](https://developer.apple.com/app-store/review/guidelines/#advertising)

---

## 🔍 추가 확인 사항

1. **실제 앱 스크린샷 확인 필요**
   - 광고가 실제로 어떻게 표시되는지 확인
   - 다양한 화면 크기에서 테스트

2. **AdMob 계정 상태 확인**
   - AdMob 콘솔에서 정확한 위반 사유 확인
   - 정책 위반 알림 메시지 확인

3. **다른 화면 확인**
   - SettingsView 등 다른 화면에도 광고가 있는지 확인
   - 일관된 광고 배치 정책 적용

---

**작성일**: 2025년 1월  
**분석 대상**: Exchange Alert iOS 앱  
**분석 범위**: AdMob 배너 광고 구현 코드

