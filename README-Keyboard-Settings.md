# 키보드 설정 및 기능 가이드

## 개요
이 문서는 Exchange Alert 앱에서 구현된 키보드 관련 기능과 설정에 대해 설명합니다.

## 구현된 키보드 기능

### 1. 키보드 완료 버튼 (Toolbar)
- **위치**: TextField 상단에 툴바 형태로 표시
- **기능**: "완료" 버튼을 통해 키보드를 수동으로 내릴 수 있음
- **적용 대상**: 알림 설정의 기준값 입력 필드

#### 구현 코드:
```swift
TextField("기준값", value: $settings.threshold, format: .number)
    .textFieldStyle(CustomTextFieldStyle())
    .keyboardType(.decimalPad)
    .font(AppTheme.bodyFont)
    .toolbar {
        ToolbarItemGroup(placement: .keyboard) {
            Spacer()
            Button("완료") {
                UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            }
        }
    }
```

### 2. 배경 터치 키보드 내림
- **기능**: 화면 배경을 터치하면 키보드가 자동으로 내려감
- **적용 범위**: 전체 ContentView 영역
- **사용자 경험**: 입력 완료 후 자연스럽게 키보드 제거 가능

#### 구현 코드:
```swift
.onTapGesture {
    // 배경 탭 시 키보드 내리기
    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
}
```

### 3. 키보드 상태 감지 및 광고 배너 숨김
- **기능**: 키보드가 나타날 때 광고 배너와 제조사 로고를 자동으로 숨김
- **목적**: 키보드가 화면을 가리지 않도록 UI 최적화
- **상태 관리**: `@State private var isKeyboardVisible` 변수로 키보드 상태 추적

#### 구현 코드:
```swift
// 키보드 상태 변수
@State private var isKeyboardVisible = false

// 키보드 감지
.onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
    isKeyboardVisible = true
}
.onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
    isKeyboardVisible = false
}

// 조건부 광고 표시
.safeAreaInset(edge: .bottom) {
    if !isKeyboardVisible {
        VStack(spacing: 4) {
            // 제조사 로고 (우측정렬)
            HStack {
                Spacer()
                SignatureView()
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 4)
            
            // 광고 배너 자리
            AdBannerPlaceholder()
                .frame(maxWidth: .infinity, maxHeight: 50)
                .padding(.horizontal, 16)
                .padding(.bottom, 6)
        }
    }
}
```

## 키보드 타입 설정

### TextField 키보드 타입
- **타입**: `.decimalPad` (숫자 키패드)
- **용도**: 환율 기준값 입력에 최적화
- **특징**: 소수점 입력 가능, 숫자만 입력 가능

## 키보드 관련 사용자 경험

### 1. 입력 흐름
1. 사용자가 기준값 입력 필드 터치
2. 숫자 키패드가 나타남
3. 광고 배너와 제조사 로고가 자동으로 숨겨짐
4. 사용자가 숫자 입력
5. "완료" 버튼 또는 배경 터치로 키보드 내림
6. 광고 배너와 제조사 로고가 다시 나타남

### 2. 키보드 내림 방법
- **방법 1**: 키보드 상단의 "완료" 버튼 터치
- **방법 2**: 화면 배경 아무 곳이나 터치
- **방법 3**: 다른 화면 영역으로 이동

## 기술적 세부사항

### 사용된 API
- **UIApplication.shared.sendAction**: 키보드 내림 기능
- **UIResponder.resignFirstResponder**: 첫 번째 응답자 상태 해제
- **NotificationCenter**: 키보드 상태 변화 감지
- **UIResponder.keyboardWillShowNotification**: 키보드 표시 알림
- **UIResponder.keyboardWillHideNotification**: 키보드 숨김 알림

### SwiftUI 모디파이어
- **.toolbar**: 키보드 툴바 추가
- **.onTapGesture**: 터치 제스처 처리
- **.onReceive**: 알림 센터 구독
- **.safeAreaInset**: 안전 영역 인셋 설정

## 문제 해결

### 1. 키보드가 광고를 가리는 문제
- **해결책**: 키보드 상태 감지를 통한 조건부 UI 표시
- **효과**: 키보드가 나타날 때 광고가 자동으로 숨겨짐

### 2. 키보드 완료 버튼 없음
- **해결책**: `.toolbar` 모디파이어로 "완료" 버튼 추가
- **효과**: 사용자가 쉽게 키보드를 내릴 수 있음

### 3. 배경 터치로 키보드 내림 불가
- **해결책**: `.onTapGesture`로 배경 터치 감지
- **효과**: 직관적인 키보드 내림 기능 제공

## 향후 개선 가능사항

### 1. 키보드 애니메이션
- 키보드 나타남/사라짐 시 부드러운 애니메이션 추가
- 광고 배너 숨김/표시 시 페이드 효과

### 2. 키보드 높이 대응
- 키보드 높이에 따른 동적 레이아웃 조정
- 스크롤 뷰의 contentInset 자동 조정

### 3. 접근성 개선
- VoiceOver 지원 강화
- 키보드 네비게이션 개선

## 결론
현재 구현된 키보드 기능은 사용자 경험을 크게 향상시키며, 특히 환율 기준값 입력 시 직관적이고 편리한 인터페이스를 제공합니다. 키보드 상태 감지와 조건부 UI 표시를 통해 화면 공간을 효율적으로 활용하고 있습니다.
