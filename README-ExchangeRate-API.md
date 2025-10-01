# ExchangeRate-API 실시간 데이터 업데이트 (중단됨)

⚠️ **이 워크플로우는 현재 중단되었습니다.**

## 📊 현재 상태

- **상태**: ❌ **중단됨** (DISABLED)
- **이유**: 네이버 KEB API가 안정적으로 운영 중
- **대안**: 네이버 KEB API (5분 간격, 23개 통화)

## 🔄 현재 활성화된 데이터 소스

### 1순위: 네이버 KEB API ✅
- **파일**: `fetch-exchange-rates-naver.yml`
- **주기**: 5분마다 자동 업데이트
- **통화**: 23개 주요 통화
- **상태**: 활발히 운영 중

### 2순위: ExchangeRate-API ❌
- **파일**: `fetch-exchangerate-api.yml`
- **주기**: 중단됨 (수동 실행만 가능)
- **통화**: 163개 통화
- **상태**: 비활성화

## 🚀 수동 실행 방법

필요시에만 수동으로 ExchangeRate-API 데이터를 수집할 수 있습니다:

1. GitHub Actions 페이지 이동
2. "Fetch ExchangeRate-API Data (DISABLED)" 워크플로우 선택
3. "Run workflow" 버튼 클릭
4. 수동 실행 확인

## 📈 데이터 구조

ExchangeRate-API 데이터는 여전히 사용 가능합니다:

### exchangerate-api.json
```json
{
  "provider": "https://www.exchangerate-api.com",
  "base": "KRW",
  "date": "2025-10-01",
  "rates": {
    "USD": 0.000713,
    "EUR": 0.000607,
    // ... 기타 통화
  },
  "convertedRates": {
    "USD": 1402.52,
    "EUR": 1647.45,
    // ... 원화 기준 환율
  }
}
```

## 💡 재활성화 방법

나중에 ExchangeRate-API를 다시 활성화하려면:

1. `.github/workflows/fetch-exchangerate-api.yml` 파일 수정
2. `schedule` 섹션의 주석 해제
3. GitHub에 푸시

```yaml
on:
  schedule:
    - cron: '*/30 * * * *'  # 30분마다 실행
  workflow_dispatch:
```

## 🎯 결론

현재 **네이버 KEB API**만으로도 충분히 안정적인 환율 데이터를 제공하고 있으므로, ExchangeRate-API는 백업 목적으로 보관되어 있습니다.

- **메인**: 네이버 KEB API (5분 간격)
- **백업**: ExchangeRate-API (수동 실행 가능)
- **상태**: 안정적 운영 중