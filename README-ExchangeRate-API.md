# ExchangeRate-API 실시간 데이터 업데이트

이 프로젝트는 ExchangeRate-API에서 실시간 환율 데이터를 2분 간격으로 수집하여 GitHub에 자동 업데이트합니다.

## 📊 데이터 구조

### exchangerate-api.json
ExchangeRate-API에서 가져온 실시간 환율 데이터입니다.

```json
{
  "provider": "https://www.exchangerate-api.com",
  "base": "KRW",
  "date": "2025-01-30",
  "time_last_updated": 1738252800,
  "rates": {
    "KRW": 1,
    "USD": 0.000713,
    "EUR": 0.000607,
    "JPY": 0.106,
    // ... 기타 통화
  },
  "convertedRates": {
    "KRW": 1,
    "USD": 1402.52,
    "EUR": 1647.45,
    "JPY": 9.43,
    // ... 기타 통화 (원화 기준)
  },
  "majorCurrencies": {
    "USD": {
      "krwRate": 0.000713,
      "currencyRate": 1402.52
    }
    // ... 주요 통화 상세 정보
  },
  "fetchedAt": "2025-01-30T12:00:00.000Z"
}
```

### exchangerate-api-last-update.txt
마지막 업데이트 시간 (ISO 8601 형식)

```
2025-01-30T12:00:00.000Z
```

## 🔄 업데이트 주기

- **실행 주기**: 30분마다 자동 업데이트
- **백업**: 매 업데이트마다 백업 파일 생성
- **수동 실행**: GitHub Actions 탭에서 수동으로 실행 가능

## 🚀 사용 방법

### Raw URL로 데이터 조회
```javascript
const response = await fetch('https://raw.githubusercontent.com/your-username/exchange-alert/main/data/exchangerate-api.json');
const data = await response.json();

// USD 환율 (원화 기준)
const usdRate = data.convertedRates.USD; // 1402.52
```

### CDN 사용 (더 빠른 로딩)
```javascript
// jsDelivr CDN 사용
const response = await fetch('https://cdn.jsdelivr.net/gh/your-username/exchange-alert@main/data/exchangerate-api.json');
const data = await response.json();
```

## ⚙️ 설정 방법

### 1. GitHub Actions 워크플로우
- `.github/workflows/fetch-exchangerate-api.yml` 파일이 자동으로 실행됩니다
- 2분마다 ExchangeRate-API를 호출하여 데이터를 업데이트합니다

### 2. 로컬 테스트
```bash
# Node.js 스크립트 실행
node scripts/fetch-exchangerate-api.js
```

## 📋 데이터 필드 설명

| 필드 | 설명 |
|------|------|
| `provider` | API 제공업체 URL |
| `base` | 기준 통화 (KRW) |
| `date` | 데이터 날짜 |
| `time_last_updated` | 마지막 업데이트 시간 (Unix timestamp) |
| `rates` | KRW 기준 환율 (1 KRW = X 통화) |
| `convertedRates` | 각 통화 기준 환율 (1 통화 = X KRW) |
| `majorCurrencies` | 주요 통화 상세 정보 |
| `fetchedAt` | 수집 시간 (ISO 8601) |

## 💱 주요 통화 환율 예시

- **USD**: 1 USD = 1,402.52 KRW
- **EUR**: 1 EUR = 1,647.45 KRW  
- **JPY**: 1 JPY = 9.43 KRW (100 JPY = 943 KRW)
- **GBP**: 1 GBP = 1,886.79 KRW
- **CNY**: 1 CNY = 196.85 KRW

## 📁 백업 시스템

- **백업 위치**: `data/backup/`
- **백업 형식**: `exchangerate-api-backup-YYYY-MM-DD_HH-MM-SS.json`
- **보관 기간**: 무제한 (GitHub 저장소 용량 내)

## 🔧 트러블슈팅

### API 호출 실패 시
- GitHub Actions 로그를 확인하여 오류 원인 파악
- ExchangeRate-API 무료 티어 제한 확인 (월 1,500회)
- 네트워크 연결 상태 확인

### 데이터 형식 오류 시
- JSON 유효성 검사 실행
- 백업 파일에서 이전 데이터 복원 가능

## 📈 성능 최적화

- **CDN 활용**: jsDelivr CDN을 통한 빠른 데이터 접근
- **압축**: JSON 데이터 압축으로 전송 속도 향상
- **캐싱**: 브라우저 캐싱을 통한 중복 요청 방지

## 🔒 보안 고려사항

- **API 키**: ExchangeRate-API 무료 버전 사용 (API 키 불필요)
- **공개 데이터**: 모든 환율 데이터는 공개 정보
- **백업 보안**: GitHub 저장소의 보안 설정 활용
