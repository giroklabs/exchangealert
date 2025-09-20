# iOS 키보드 처리 가이드 (SwiftUI + UIKit 혼합)

이 문서는 텍스트 입력 UX를 안정적으로 유지하면서 의도한 방식으로 키보드를 내리고 유지하는 실전 패턴을 정리했습니다. 다른 앱에도 그대로 복붙해서 적용할 수 있습니다.

## 목표
- 입력 중 키보드가 의도치 않게 내려가지 않도록 방지
- 배경 탭으로 키보드 내리기(현재 기본)
- 선택적으로: 키보드 툴바의 "완료" 버튼, 또는 스와이프(끌어내리기)로 닫기 지원
- SwiftUI `ScrollView` + UIKit `UITextView` 안정적 브릿지

---

## 핵심 레시피

### 1) 포커스는 FocusState 대신 State로 브릿지
SwiftUI `FocusState<Bool>`을 직접 바인딩하면 입력 직후 포커스가 풀리는 사례가 있습니다. 아래처럼 `@State Bool`을 쓰고 `Binding<Bool>`로 UIKit 래퍼에 내려주세요.

```swift
@State private var isEditorFocused: Bool = false
```

### 2) ScrollView: 자동 닫힘 방지 + 배경 탭으로 닫기
```swift
ScrollView {
  // ... content ...
}
.onTapGesture { isEditorFocused = false } // 배경 탭으로 키보드 내리기
.scrollDismissesKeyboard(.never)          // 스크롤 제스처 자동 닫힘 방지
```

### 3) UITextView 래퍼(UIViewRepresentable) 포커스 동기화
`isFirstResponder`를 직접 제어해 SwiftUI 상태와 동기화합니다.

```swift
struct ManuscriptTextEditor: UIViewRepresentable {
  @Binding var text: String
  @Binding var isFocused: Bool
  let fontName: String?
  let fontSize: CGFloat
  let lineHeight: CGFloat

  func makeUIView(context: Context) -> UITextView {
    let tv = UITextView()
    tv.backgroundColor = .clear
    tv.textContainerInset = .zero
    tv.textContainer.lineFragmentPadding = 0
    tv.keyboardDismissMode = .none // 배경 탭 방식 사용 시 .none 유지
    tv.isScrollEnabled = true
    tv.layoutManager.usesFontLeading = false
    tv.delegate = context.coordinator
    applyStyle(tv)
    tv.text = text
    applyStyleToEntireText(tv)
    return tv
  }

  func updateUIView(_ uiView: UITextView, context: Context) {
    if uiView.text != text {
      context.coordinator.isProgrammaticUpdate = true
      uiView.text = text
      applyStyleToEntireText(uiView)
      context.coordinator.isProgrammaticUpdate = false
    }
    if isFocused && !uiView.isFirstResponder { uiView.becomeFirstResponder() }
    if !isFocused && uiView.isFirstResponder { uiView.resignFirstResponder() }
  }

  func applyStyle(_ tv: UITextView) {
    let font: UIFont = {
      if let name = fontName, let f = UIFont(name: name, size: fontSize) { return f }
      return UIFont.systemFont(ofSize: fontSize)
    }()
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = lineHeight
    paragraph.maximumLineHeight = lineHeight
    paragraph.lineBreakMode = .byWordWrapping
    paragraph.alignment = .natural
    tv.typingAttributes = [
      .font: font,
      .paragraphStyle: paragraph,
      .foregroundColor: UIColor.label
    ]
  }

  func applyStyleToEntireText(_ tv: UITextView) {
    let font: UIFont = {
      if let name = fontName, let f = UIFont(name: name, size: fontSize) { return f }
      return UIFont.systemFont(ofSize: fontSize)
    }()
    let paragraph = NSMutableParagraphStyle()
    paragraph.minimumLineHeight = lineHeight
    paragraph.maximumLineHeight = lineHeight
    paragraph.lineBreakMode = .byWordWrapping
    paragraph.alignment = .natural
    let attrs: [NSAttributedString.Key: Any] = [
      .font: font,
      .paragraphStyle: paragraph,
      .foregroundColor: UIColor.label
    ]
    let selected = tv.selectedRange
    tv.textStorage.beginEditing()
    tv.textStorage.setAttributes(attrs, range: NSRange(location: 0, length: tv.textStorage.length))
    tv.textStorage.endEditing()
    tv.selectedRange = selected
  }

  func makeCoordinator() -> Coordinator { Coordinator(self) }
  class Coordinator: NSObject, UITextViewDelegate {
    var parent: ManuscriptTextEditor
    var isProgrammaticUpdate = false
    init(_ parent: ManuscriptTextEditor) { self.parent = parent }
    func textViewDidChange(_ tv: UITextView) { if !isProgrammaticUpdate { parent.text = tv.text } }
    func textViewDidBeginEditing(_ tv: UITextView) { parent.isFocused = true }
    func textViewDidEndEditing(_ tv: UITextView) { parent.isFocused = false }
  }
}
```

### 4) Placeholder는 제거/삽입 대신 opacity 토글
뷰 리마운트를 막아 포커스가 끊기지 않도록 합니다.

```swift
ZStack(alignment: .topLeading) {
  ManuscriptTextEditor(
    text: $text,
    isFocused: $isEditorFocused,
    fontName: "MaruBuri-Regular",
    fontSize: 18,
    lineHeight: 24
  )
  Text("문구를 입력하세요")
    .opacity(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 1 : 0)
    .allowsHitTesting(false)
}
```

---

## 선택 옵션

### A) 키보드 툴바에 "완료" 버튼 추가
배경 탭 대신/함께 사용 가능.

```swift
.toolbar {
  ToolbarItemGroup(placement: .keyboard) {
    Spacer()
    Button("완료") { isEditorFocused = false }
  }
}
```

### B) 스와이프(끌어내리기)로 닫기 허용
배경 탭 대신 제스처 기반 닫기를 원하면:

```swift
// makeUIView 내부
textView.keyboardDismissMode = .interactive
```

> 주의: 스크롤과 상호작용합니다. `scrollDismissesKeyboard(.never)`와 함께 사용할 때는 제스처 충돌에 유의하세요.

---

## 체크리스트(문제 발생 시)
- 한 글자 입력 후 키보드가 내려간다 → `@State Bool` + `Binding<Bool>` 사용 여부, Placeholder 리마운트 여부(opacity만 토글), 상위 뷰 과도한 리렌더 확인
- 스크롤만 해도 키보드가 내려간다 → `.scrollDismissesKeyboard(.never)` 적용
- 배경 탭이 동작 안 한다 → 탭 제스처가 실제 배경에 붙었는지, 상위 제스처와 충돌 여부 확인
- 키보드가 안 내려간다 → 탭 시 `isEditorFocused = false`가 실제로 호출되는지 확인

---

## 최소 예제 템플릿

```swift
struct ExampleView: View {
  @State private var text = ""
  @State private var isEditorFocused = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 12) {
        ZStack(alignment: .topLeading) {
          ManuscriptTextEditor(
            text: $text,
            isFocused: $isEditorFocused,
            fontName: "MaruBuri-Regular",
            fontSize: 18,
            lineHeight: 24
          )
          Text("문구를 입력하세요")
            .opacity(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 1 : 0)
            .allowsHitTesting(false)
        }
        .frame(minHeight: 176)
      }
      .padding()
    }
    .onTapGesture { isEditorFocused = false }
    .scrollDismissesKeyboard(.never)
  }
}
```

---

## 권장 사항
- 폰트/줄간격 커스텀 시, 스타일 전체 재적용은 스타일 파라미터가 실제로 바뀔 때만 수행(성능)
- 포커스 제어는 한 경로만 사용(배경 탭 / 툴바 / 스와이프 중 택1 또는 병행 시 충돌 주의)

본 가이드는 MinimalPrint 앱에서 검증된 설정을 바탕으로 합니다. 다른 프로젝트에 그대로 복사해 사용하셔도 됩니다.




