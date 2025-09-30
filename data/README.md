# Exchange Rate Data Archive

## 디렉토리 구조

```
data/
├── exchange-rates.json          # 현재 환율 데이터 (최신)
├── last-update.txt             # 마지막 업데이트 시간 (KST)
├── history/                     # 누적 히스토리 데이터
│   ├── exchange-rates-YYYYMMDD.json  # 날짜별 환율 데이터
│   └── meta-YYYYMMDD.json           # 날짜별 메타데이터
└── daily/                       # 일별 아카이브
    └── exchange-rates-YYYYMMDD.json  # 날짜별 환율 데이터 복사본
```

## 파일 설명

### exchange-rates.json
- **용도**: 현재 최신 환율 데이터
- **업데이트**: GitHub Actions에 의해 2분마다 업데이트
- **형식**: JSON 배열

### history/exchange-rates-YYYYMMDD.json
- **용도**: 날짜별 환율 데이터 히스토리
- **형식**: JSON 배열
- **예시**: `exchange-rates-20250929.json` (2025년 9월 29일 데이터)

### history/meta-YYYYMMDD.json
- **용도**: 날짜별 메타데이터
- **포함 정보**:
  - `date`: 날짜 (YYYYMMDD 형식)
  - `fetch_time`: 데이터 수집 시간 (KST)
  - `api_source`: API 소스
  - `data_count`: 통화 개수
  - `search_date`: API 요청 날짜

### daily/exchange-rates-YYYYMMDD.json
- **용도**: history와 동일한 데이터의 백업 복사본
- **목적**: 데이터 중복 보존

## 사용 예시

### 특정 날짜 데이터 조회
```bash
# 2025년 9월 29일 USD 환율 조회
cat data/history/exchange-rates-20250929.json | jq '.[] | select(.cur_unit == "USD")'

# 메타데이터 조회
cat data/history/meta-20250929.json | jq .
```

### 모든 히스토리 데이터 목록
```bash
ls data/history/exchange-rates-*.json
```

## 데이터 소스
- **API**: 한국수출입은행 Open API
- **업데이트 주기**: 2분마다 (영업일 11시 이후)
- **데이터 형식**: 한국수출입은행 표준 형식
