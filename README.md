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
