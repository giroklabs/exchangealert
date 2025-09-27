<<<<<<< HEAD
# Exchange Rates Data Repository

이 Repository는 한국수출입은행 API에서 환율 데이터를 자동으로 수집하여 JSON 형식으로 저장합니다.

## 📊 데이터 구조

### exchange-rates.json
한국수출입은행 API에서 가져온 원본 환율 데이터입니다.

```json
[
  {
    "result": 1,
    "cur_unit": "USD",
    "ttb": "1,386.65",
    "tts": "1,414.53",
    "deal_bas_r": "1,400.60",
    "bkpr": "1,400",
    "yy_efee_r": "0",
    "ten_dd_efee_r": "0",
    "kftc_bkpr": "1,400",
    "kftc_deal_bas_r": "1,400.6",
    "cur_nm": "미국 달러"
  }
]
```

### last-update.txt
마지막 업데이트 시간 (UTC)

```
2025-09-22T06:30:00Z
```

## 🔄 업데이트 주기

- **평일**: 매 5분마다 자동 업데이트 (오전 9시 ~ 오후 3시 30분 KST)
- **주말/공휴일**: API에서 빈 데이터를 반환하므로 업데이트 없음
- **수동 실행**: GitHub Actions 탭에서 수동으로 실행 가능

## 🚀 사용 방법

### Raw URL로 데이터 조회
```javascript
const response = await fetch('https://raw.githubusercontent.com/your-username/exchange-rates-data/main/data/exchange-rates.json');
const data = await response.json();
```

### CDN 사용 (더 빠른 로딩)
```javascript
// jsDelivr CDN 사용
const response = await fetch('https://cdn.jsdelivr.net/gh/your-username/exchange-rates-data@main/data/exchange-rates.json');
const data = await response.json();
```

## ⚙️ 설정 방법

### 1. Repository 생성
1. GitHub에서 새 Repository 생성
2. 이 Repository의 파일들을 업로드

### 2. API 키 설정
1. Repository Settings → Secrets and variables → Actions
2. `KOREA_EXIM_API_KEY` 이름으로 API 키 저장

### 3. 초기 데이터 생성
```bash
mkdir data
echo "[]" > data/exchange-rates.json
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" > data/last-update.txt
```

## 📋 필드 설명

| 필드 | 설명 |
|------|------|
| `cur_unit` | 통화 코드 (USD, EUR, JPY 등) |
| `ttb` | 전신환 매입율 (살 때) |
| `tts` | 전신환 매도율 (팔 때) |
| `deal_bas_r` | 매매기준율 |
| `bkpr` | 장부가격 |
| `cur_nm` | 통화 한글명 |

## 🛡️ 에러 처리

- API 호출 실패 시 워크플로우가 중단됩니다
- 빈 데이터 응답(주말) 시 기존 데이터를 유지합니다
- JSON 파싱 실패 시 워크플로우가 중단됩니다

## 📈 모니터링

- **Actions 탭**: 실행 기록 및 로그 확인
- **Commits**: 데이터 변경 이력 확인
- **Issues**: 문제 발생 시 이슈 생성
=======
# 💱 환율 알리미 (Exchange Alert)

한국수출입은행 API를 활용한 심플한 달러-원 환율 모니터링 iOS 앱입니다.

## ✨ 주요 기능

- **실시간 환율 조회**: 한국수출입은행 공식 API를 통한 정확한 환율 정보
- **임계점 알림**: 설정한 상한선/하한선 도달 시 즉시 알림
- **주기적 모니터링**: 15분~2시간 간격으로 자동 환율 체크
- **직관적인 UI**: nainai 앱 스타일을 참조한 깔끔한 디자인
- **설정 관리**: 알림 임계점과 체크 간격을 자유롭게 설정

## 🛠 기술 스택

- **언어**: Swift 5.0
- **프레임워크**: SwiftUI, UserNotifications
- **API**: 한국수출입은행 Open API
- **최소 지원**: iOS 17.0+

## 📱 화면 구성

### 메인 화면
- 현재 USD/KRW 환율 표시
- 환율 상태 아이콘 (상승/하락/보합)
- 송금 받을 때/보낼 때 환율 정보
- 알림 설정 카드
- 새로고침 버튼

### 설정 화면
- 알림 활성화/비활성화
- 상한선/하한선 설정
- 체크 간격 설정 (15분, 30분, 1시간, 2시간)
- 시스템 알림 권한 설정

## 🔧 설치 및 실행

1. Xcode에서 `ExchangeAlert.xcodeproj` 열기
2. iOS 시뮬레이터 또는 실제 기기 선택
3. 빌드 및 실행 (⌘+R)

## 📋 API 설정

앱에서 사용하는 한국수출입은행 API 정보:
- **API 키**: `cTcUsZGSUum0cSXCpxNdb3TouiJNxSLW`
- **요청 URL**: `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON`
- **데이터 타입**: AP01 (환율)

## 🎨 디자인 특징

- **nainai 앱 스타일 참조**: 깔끔하고 모던한 UI/UX
- **그라데이션 활용**: 파란색 계열의 일관된 컬러 팔레트
- **카드 기반 레이아웃**: 정보를 명확하게 구분하여 표시
- **직관적인 아이콘**: 환율 상태를 한눈에 파악 가능

## 📝 사용법

1. **앱 실행**: 처음 실행 시 알림 권한 허용
2. **임계점 설정**: 설정 화면에서 원하는 상한선/하한선 입력
3. **알림 활성화**: 알림 토글을 켜서 모니터링 시작
4. **자동 모니터링**: 설정한 간격으로 자동으로 환율 체크
5. **알림 수신**: 임계점 도달 시 즉시 알림 받기

## ⚠️ 주의사항

- 비영업일이나 영업당일 11시 이전에는 데이터가 없을 수 있습니다
- 알림은 1시간에 최대 1회까지만 전송됩니다 (스팸 방지)
- 네트워크 연결이 필요합니다

## 🔄 업데이트 내역

### v1.0.0
- 초기 릴리스
- 기본 환율 조회 기능
- 임계점 알림 기능
- 설정 관리 기능

## 📞 문의

개발: GIROK Labs.
이메일: support@giroklabs.com

---

*이 앱은 한국수출입은행의 공식 API를 사용하여 정확한 환율 정보를 제공합니다.*
>>>>>>> d6f027aa22206d6c0f5fec5fa75a22e84282ec0e

