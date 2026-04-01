# [통합 보고서] KRX 야간 파생상품 활용 KOSPI 시초가 예측 및 구현 가이드

본 보고서는 KRX 야간 파생상품 시장의 데이터를 활용하여 차일 KOSPI 시초가를 예측하기 위한 **이론적 배경**, **실제 구현 가이드**, 그리고 **사전 테스트 방법**을 집약한 최종 보고서입니다.

---

## 1. 연구 배경 및 예측 메커니즘

국내 증시 시초가는 밤사이 발생한 글로벌 매크로 변수를 한 번에 반영합니다. **KRX 야간 파생상품 시장**은 이를 선반영하는 가장 강력한 지표이며, 특히 **'오버나잇 프리미엄(Overnight Premium)'**은 다음 날 KOSPI 시초가 갭(Gap)의 방향과 크기를 결정하는 핵심 독립 변수입니다.

- **예측 수식**: `Overnight Premium = (야간 선물 종가 - 전일 정규장 종가) / 전일 정규장 종가`
- **핵심 가설**: 프리미엄이 +0.5%이고 미국 Nasdaq이 +1.0%라면, KOSPI 시초가는 약 +0.6~0.8% 갭상승 출발할 가능성이 매우 높음.

---

## 2. KIS API 기술 사양 교정 (REST API 중심)

GitHub Actions 환경의 안정성을 위해 웹소켓 대신 REST API 기반의 **오전 1회 호출 방식**을 권장합니다.

| 구분 | 항목 | KIS API 사양 (REST) | 비고 |
|:---|:---|:---|:---|
| **인증 시스템** | 토큰 발급 | `scripts/lib/kis-auth.js` | **1분당 1회 제한** (재시도 로직 필수) |
| **데이터 수집** | 야간/정규 선물 | `scripts/lib/futures-client.js` | `domestic-futureoption` 경로 전용 TR 사용 |
| **계산 엔진** | 프리미엄 산출 | `scripts/lib/market-math.js` | 소수점 4자리 계산 후 2자리 반올림 표준화 |
| **수집 시점** | 최종 데이터 확정 | 평일 오전 **08:10 ~ 08:35** KST | 야간장(05:00~06:00) 종료 후 반영 |

---

## 3. 실제 구현 가이드 (Step-by-Step)

### Step 1. `fetch-market-dashboard.js`에 데이터 수집 로직 추가
기존 수집 흐름에 야간 선물 정보를 포함시킵니다.

```javascript
/**
 * KRX 야간 선물 시세 및 프리미엄 계산
 */
async function fetchNightFuturesScore(token) {
    try {
        // 1. 야간 선물(101N3)의 최신 일봉/틱 데이터 호출
        // URL: /uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice
        // 2. 전일 정규장 종가와 비교하여 'Overnight Premium' 산출
        const nightClose = 352.50; // 예시값
        const regClose = 351.00;   // 예시값
        const premium = ((nightClose - regClose) / regClose * 100).toFixed(2);
        
        return { premium, value: nightClose, status: 'success' };
    } catch (e) {
        return { premium: 0, status: 'fail' };
    }
}
```

### Step 2. AI 분석 프롬프트 주입
Gemini AI가 해당 수치를 인지하도록 프롬프트의 `Context`를 업데이트합니다.

```javascript
const nightData = await fetchNightFuturesScore(token);
// ...
const prompt = `
[실시간 야간 지표]
- KRX 야간 선물 프리미엄: ${nightData.premium}%
- 미국 Nasdaq/SOX 등락: ${nasdaqChange}%
- NDF 환율 변동: ${ndfChange}원

[명령] 위 야간 지표를 최우선으로 고려하여 오늘 KOSPI 시초가 갭(Gap) 방향과 변동 강도를 예측해줘.
`;
```

---

### 4.1 신뢰성 확보를 위한 3단계 검증 프로세스

1. **Mock Verification (`--mode mock`)**:
   - `scripts/data/test-baselines.json`에 정의된 고정 데이터를 사용하여 계산 로직의 수학적 정확성을 검증합니다. (외부 API 의존성 없음)
2. **Historical Backtest (`--mode historical`)**:
   - 특정 과거 일자(`--date YYYYMMDD`)의 KIS 데이터를 호출하여 HTS 마감가와 스크립트 결과의 일치 여부를 대조합니다.
3. **Live Market Test (`--mode live`)**:
   - 실제 장중/야간장 데이터를 수집하여 네트워크 안정성 및 실시간 토큰 발급 상태를 점검합니다.

### 4.2 에러 핸들링 및 보안 수칙
- **재시도 전략**: 네트워크 오류 시 최대 3회 지수 백오프(Exponential Backoff) 재시도를 수행합니다.
- **환경 변수 관리**: `.env` 파일에 발급받은 `KIS_APP_KEY`, `KIS_APP_SECRET`을 안전하게 보관하며, 테스트 시 `--dry-run` 옵션을 지원하여 보안 리스크를 최소화합니다.

---

## 5. 구현 체크리스트

- [ ] **API 권한**: 사용 중인 KIS APP Key가 '국내선물옵션' 시세 조회 권한을 가지고 있는가?
- [ ] **시간차 대응**: 야간 시장 종료 직후 데이터 동기화 지연 시간(약 1~5분)이 고려되었는가?
### 4.3 자동화 운영 스케줄 (GitHub Actions)

매일 아침 사람이 직접 확인하지 않아도, 시스템이 자동으로 분석하여 텔레그램으로 브리핑을 전송합니다.

- **워크플로우**: `.github/workflows/fetch-night-futures.yml`
- **실행 시각**: **평일(월~금) 오전 08:35 (KST)**
- **주요 동작**:
  1. KIS API 실시간(Live) 데이터 수집
  2. Gemini AI 분석 및 텔레그램 브리핑 발송
  3. `prediction-history.json`에 분석 이력 자동 기록

---
**[작성: Antigravity AI 연구팀 | 2026.03.30]**
