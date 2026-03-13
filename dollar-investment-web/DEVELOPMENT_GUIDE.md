# 📄 Exchange Alert 개발 가이드 (Development Guide)

이 문서는 현재 운영 중인 '환율 투자 보조 서비스'의 기술 스택, 시스템 아키텍처, 그리고 주요 로직에 대한 상세 정보를 제공합니다.

---

## 🏗 전체 시스템 아키텍처

본 서비스는 **Serverless** 아키텍처를 지향하며, 유지비용을 최소화하면서도 실시간성을 확보하도록 설계되었습니다.

- **Frontend**: React (Vite) + Tailwind CSS + Recharts
- **Data Backend (Serverless)**: GitHub Actions (데이터 수집 및 정제)
- **Database/Auth**: Firebase (GCP)
- **Storage**: GitHub Repository (JSON 정적 파일 기반 데이터 서빙)

---

## 🎨 프론트엔드 (Frontend)

### 1. 기술 스택
- **Framework**: `React` (v18+)
- **Build Tool**: `Vite`
- **Styling**: `Tailwind CSS` (유틸리티 퍼스트 디자인)
- **State Management**: 
  - `Context API`: Theme, Auth 관리
  - `Custom Hooks`: `useSyncState` (로컬 스토리지 + Firebase 실시간 동기화)
- **Visualization**: `Recharts` (환율 및 주가 차트)

### 2. 주요 컴포넌트 구조
- `MarketDashboard.tsx`: 메인 화면. 환율 예측 모델 및 통합 차트 요약 정보 제공.
- `UnifiedFXChart.tsx`: 1일/1주/1개월/1년/전체 범위를 커버하는 통합 환율 분석 차트.
- `AssetSplitInvestment.tsx`: 주식/자산별 분할 매수 관리 (멀티 종목 지원).
- `SevenSplitInvestment.tsx`: 7분할 달러 투자 전략 실행 컴포넌트.
- `FXExchangeProfitTracker.tsx`: 매수/매도 기록 및 실현 손익 관리.

### 3. 핵심 로직: `useSyncState`
기기 간 데이터 동기화의 핵심입니다.
- **동작**: 상태 변경 시 `localStorage`에 즉시 저장하고, 로그인 상태일 경우 `Firebase Firestore`의 각 유저 문서에 개별 타임스탬프(`_lastUpdated`)와 함께 저장합니다.
- **정밀도**: 전체 문서가 아닌 변경된 필드만 `merge: true`로 업데이트하여 충돌을 방지합니다.

---

## ⚙️ 백엔드 및 데이터 수집 (Data Logic)

별도의 상시 가동 서버 없이 **GitHub Actions**를 스케줄러(Cron)로 활용합니다.

### 1. 데이터 수집 프로세스 (`.github/workflows/`)
- **환율 데이터 (`fetch-exchange-rates-naver.yml`)**: 네이버 증권에서 실시간 환율을 1분/15분 단위로 수집하여 `public/data/fx-history.json` 및 `fx-intraday.json`을 갱신합니다.
- **달러 지수 (`fetch-dollar-index.yml`)**: 인베스팅닷컴 등에서 달러 인덱스 데이터를 수집합니다.
- **시장 대시보드 (`fetch-market-dashboard.yml`)**: 주요 지수(KOSPI, S&P500 등)와 뉴스 데이터를 수집하여 하나의 JSON 파일로 정제합니다.

### 2. 데이터 서빙 (Static Data Serving)
수집된 데이터는 GitHub 리포지토리에 푸시되어 정적 파일 주소(`.json`)로 서비스됩니다. 프론트엔드는 `fetch` API를 통해 이 파일을 읽어와 화면에 표시합니다.

---

## 🔥 Firebase 연동 전략

### 1. 인증 (Authentication)
- **Google Auth**: 사용자의 UID를 식별하여 개인별 설정 및 투자 데이터를 매칭합니다.

### 2. Firestore 보안 규칙
데이터 오염을 막기 위해 철저한 권한 관리를 적용합니다.
```javascript
match /users/{userId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### 3. 동기화 흐름
1. 사용자가 앱 접속 시 `AuthContext`에서 Firestore의 최신 문서 로드.
2. 로컬 스토리지와 시간을 비교하여 더 최신인 데이터로 로컬 환경 갱신.
3. 데이터 변경 시 `useSyncState`가 클라우드에 비동기적으로 반영.

---

## 🛠 유지보수 및 확장 가이드

1. **데이터 소스 추가**: `.github/workflows/`에 새로운 크롤링 스크립트를 추가하고 `public/data/` 경로에 JSON으로 저장하도록 구성합니다.
2. **새로운 차트 지표**: `UnifiedFXChart`의 `useMemo` 블록에 신규 기술적 지표(RSI, MACD 등) 연산 로직을 추가하고 Recharts 컴포넌트에 매핑합니다.
3. **배포**: GitHub `main` 브랜치에 푸시하면 `deploy-dollar-investment.yml`이 작동하여 GitHub Pages 또는 Vercel 등으로 자동 배포됩니다.
