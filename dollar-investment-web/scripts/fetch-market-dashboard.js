/**
 * 시장 대시보드 데이터 수집 및 예측 모델 분석 스크립트
 * 2026년 실시간 데이터 대응 버전
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

import { calcZScore, rollingZScore } from './utils/zscore.js';
import { calculateEMA } from './utils/ema.js';
import { isTradingHoliday } from './utils/holidays.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRED_API_KEY = process.env.FRED_API_KEY || '0a8892024728a9a0fa015e609cd5d232';
const ECOS_API_KEY = process.env.ECOS_API_KEY;
const KIS_APP_KEY = process.env.KIS_APP_KEY;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";
const KIS_BASE_URL_REAL = "https://openapi.koreainvestment.com:443";

// API 키 상태 로그
console.log(`🔑 API 키 확인: FRED(${FRED_API_KEY ? 'O' : 'X'}), ECOS(${ECOS_API_KEY ? 'O' : 'X'}), KIS(${KIS_APP_KEY ? 'O' : 'X'}), GEMINI(${GEMINI_API_KEY ? 'O' : 'X'})`);

if (!KIS_APP_KEY || !KIS_APP_SECRET) {
    console.warn("⚠️ [Config] KIS_APP_KEY 또는 KIS_APP_SECRET이 설정되지 않았습니다. GitHub Secrets를 확인해 주세요.");
}
if (!ECOS_API_KEY) console.warn("⚠️ [Config] ECOS_API_KEY가 없습니다.");
if (!GEMINI_API_KEY) console.warn("⚠️ [Config] GEMINI_API_KEY가 없습니다.");

const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
const US_SETTLED_SYMBOLS = ['^SOX', '^TNX', '^FVX', '^TYX', '^IXIC', '^GSPC', '^VIX', 'NQ=F', 'ES=F', 'CL=F'];

// [v17.0] KOSPI 투자자별 매매동향 기반 데이터 (단위: 억원)
const KOSPI_INVESTOR_HISTORY = {
    institution: [
        { date: '2026-04-03', value: 1956 }, { date: '2026-04-02', value: -14517 }, { date: '2026-04-01', value: 40419 }, { date: '2026-03-31', value: 10251 }, { date: '2026-03-30', value: 8450 },
        { date: '2026-03-27', value: 7785 }, { date: '2026-03-26', value: -2999 }, { date: '2026-03-25', value: 23230 }, { date: '2026-03-24', value: 9683 },
        { date: '2026-03-23', value: -38173 }, { date: '2026-03-20', value: -10260 }, { date: '2026-03-19', value: -6649 }, { date: '2026-03-18', value: 31093 },
        { date: '2026-03-17', value: 7341 }, { date: '2026-03-16', value: 911 }, { date: '2026-03-13', value: -10434 }, { date: '2026-03-12', value: 775 },
        { date: '2026-03-11', value: 7821 }, { date: '2026-03-10', value: 9164 }, { date: '2026-03-09', value: -15441 }, { date: '2026-03-06', value: -11142 },
        { date: '2026-03-05', value: -17186 }, { date: '2026-03-04', value: -5978 }, { date: '2026-03-03', value: -8859 }, { date: '2026-02-27', value: 5666 }
    ],
    individual: [
        { date: '2026-04-03', value: -957 }, { date: '2026-04-02', value: 12097 }, { date: '2026-04-01', value: -37628 }, { date: '2026-03-31', value: 24400 }, { date: '2026-03-30', value: 8945 },
        { date: '2026-03-27', value: 22596 }, { date: '2026-03-26', value: 30598 }, { date: '2026-03-25', value: -13402 }, { date: '2026-03-24', value: 7270 },
        { date: '2026-03-23', value: 70029 }, { date: '2026-03-20', value: 22338 }, { date: '2026-03-19', value: 24116 }, { date: '2026-03-18', value: -38717 },
        { date: '2026-03-17', value: -5752 }, { date: '2026-03-16', value: 7164 }, { date: '2026-03-13', value: 24512 }, { date: '2026-03-12', value: 22291 },
        { date: '2026-03-11', value: -5086 }, { date: '2026-03-10', value: -18340 }, { date: '2026-03-09', value: 46242 }, { date: '2026-03-06', value: 29488 },
        { date: '2026-03-05', value: 18228 }, { date: '2026-03-04', value: 796 }, { date: '2026-03-03', value: 57974 }, { date: '2026-02-27', value: 62496 }
    ],
    foreigner: [
        { date: '2026-04-03', value: -1194 }, { date: '2026-04-02', value: -1368 }, { date: '2026-04-01', value: -6411 }, { date: '2026-03-31', value: -38386 }, { date: '2026-03-30', value: -20945 },
        { date: '2026-03-27', value: -34286 }, { date: '2026-03-26', value: -29370 }, { date: '2026-03-25', value: -12895 }, { date: '2026-03-24', value: -19863 },
        { date: '2026-03-23', value: -36751 }, { date: '2026-03-20', value: -12402 }, { date: '2026-03-19', value: -18760 }, { date: '2026-03-18', value: 8802 },
        { date: '2026-03-17', value: -1740 }, { date: '2026-03-16', value: -8485 }, { date: '2026-03-13', value: -14502 }, { date: '2026-03-12', value: -23831 },
        { date: '2026-03-11', value: -2563 }, { date: '2026-03-10', value: 10283 }, { date: '2026-03-09', value: -31735 }, { date: '2026-03-06', value: -19411 },
        { date: '2026-03-05', value: -1446 }, { date: '2026-03-04', value: 2303 }, { date: '2026-03-03', value: -51487 }, { date: '2026-02-27', value: -70528 }
    ]
};

async function fetchFromYahooFinanceRealtime(symbol) {
    return new Promise((resolve) => {
        // 1분 간격 실시간 차트 데이터 (1일 범위)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (!json.chart || !json.chart.result || !json.chart.result[0]) {
                        console.warn(`⚠️ Yahoo FinanceRealtime No Result (${symbol})`);
                        return resolve({ observations: [], regularPrice: null });
                    }
                    const result = json.chart.result[0];
                    const timestamps = result.timestamp;
                    if (!timestamps) return resolve({ observations: [], regularPrice: null });
                    const closes = result.indicators.quote[0].close;
                    const regularPrice = result.meta?.regularMarketPrice || (closes && closes.length > 0 ? closes[closes.length - 1] : null);
                    const observations = [];
                    for (let i = 0; i < timestamps.length; i++) {
                        if (closes[i] !== null) {
                            const date = new Date(timestamps[i] * 1000).toLocaleString('en-CA', { timeZone: 'Asia/Seoul' });
                            observations.push({ date, value: closes[i].toFixed(2) });
                        }
                    }
                    resolve({ observations: observations.reverse(), regularPrice });
                } catch (e) {
                    console.error(`❌ Yahoo FinanceRealtime Parse Error (${symbol}):`, e.message);
                    resolve({ observations: [], regularPrice: null });
                }
            });
        }).on('error', (e) => {
            console.error(`❌ Yahoo FinanceRealtime Network Error (${symbol}):`, e.message);
            resolve({ observations: [], regularPrice: null });
        });
    });
}

async function fetchFromYahooFinance(symbol) {
    return new Promise((resolve) => {
        // Yahoo Finance Chart API (v8) - 1년치 데이터 요청 (장기 Z-score 활용)
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (!json.chart || !json.chart.result || !json.chart.result[0]) {
                        console.warn(`⚠️ Yahoo Finance No Result (symbol: ${symbol})`);
                        return resolve({ observations: [], regularPrice: null });
                    }
                    const result = json.chart.result[0];
                    const timestamps = result.timestamp;
                    if (!timestamps) return resolve({ observations: [], regularPrice: null });

                    const closes = result.indicators.quote[0].close;
                    const regularPrice = result.meta.regularMarketPrice || (closes.length > 0 ? closes[closes.length - 1] : null);
                    const regularMarketTime = result.meta.regularMarketTime || null;

                    // 유효한 데이터만 필터링하여 히스토리 생성
                    const observations = [];
                    for (let i = 0; i < timestamps.length; i++) {
                        if (closes[i] !== null) {
                            // 미국 마감 지표(^SOX, ^TNX 등)는 UTC 기준 원본 날짜를 보존하여 거래일 불일치 방지
                            // 그 외 실시간 지표(VIX 등)는 기존 KST(Asia/Seoul) 기준 유지
                            const isSettled = US_SETTLED_SYMBOLS.includes(symbol);
                            const date = isSettled 
                                ? new Date(timestamps[i] * 1000).toISOString().split('T')[0]
                                : new Date(timestamps[i] * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                            
                            observations.push({
                                date: date,
                                value: closes[i].toFixed(2)
                            });
                        }
                    }
                    //  미국 마감 지표(^SOX, ^TNX 등) 전용: 중복 노드 제거 (수평선 방지)
                    // 야후 API가 장 오픈 전 전일 종가와 동일한 날짜 노드를 미리 생성하는 경우 이를 제거함
                    if (US_SETTLED_SYMBOLS.includes(symbol) && observations.length >= 2) {
                        const latest = observations[observations.length - 1];
                        const secondLatest = observations[observations.length - 2];
                        if (latest.value === secondLatest.value) {
                            observations.pop();
                            console.log(`♻️ [Deduplicate] ${symbol}의 중복 마감 노드(${latest.date}) 제거됨`);
                        }
                    }

                    resolve({ observations: observations.reverse(), regularPrice: regularPrice, regularMarketTime: regularMarketTime }); // 최신순으로 반환
                } catch (e) {
                    console.error(`❌ Yahoo Finance Parse Error (${symbol}):`, e.message);
                    resolve({ observations: [], regularPrice: null });
                }
            });
        }).on('error', (e) => {
            console.error(`❌ Yahoo Finance Network Error (${symbol}):`, e.message);
            resolve({ observations: [], regularPrice: null });
        });
    });
}

// 1. Factor Blocks 정의 (연구 자료 기반)
const FACTOR_BLOCKS = {
    RATES_DOLLAR: { id: 'rates-dollar', name: '금리·달러 블록', description: '캐리/글로벌 달러 사이클 요인' },
    RISK: { id: 'risk', name: '리스크 블록', description: '리스크온/오프, 안전통화 수요' },
    ASSETS: { id: 'assets', name: '한국 자산 블록', description: '자본유출입, 한국 위험자산 선호도' },
    FUNDING_POLICY: { id: 'funding-policy', name: '펀딩·정책 블록', description: '유동성·신용/정책에 따른 변동성' },
    GLOBAL_INDICES: { id: 'global-indices', name: '글로벌 지수 블록', description: '미국 및 글로벌 주요 증시 지수 (국내 시장 선행 지표)' }
};

// 2. 해외지표 (FRED)
const FRED_SERIES = [
    { id: 'FEDFUNDS', name: '미국 기준금리(Fed)', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'Federal Reserve', description: '미국 기준 금리, 달러 가치 결정' },
    { id: 'DXY', name: '달러 인덱스(DXY)', unit: 'pt', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'ICE', description: '달러 상대 가치, 환율 핵심 지표', realtimeSymbol: 'DX-Y.NYB', fredId: 'DTWEXBGS' },
    { id: 'TNX', name: '미 10년물 국채금리', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'CBOE', description: '미 국채 금리 상승 시 달러 강세', realtimeSymbol: '^TNX', fredId: 'GS10' },
    { id: 'VIXCLS', name: 'VIX 공포지수', unit: 'pt', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: 'CBOE', description: '시장 불안정성 및 공포 심리 지표', realtimeSymbol: '^VIX' },
    { id: 'BAMLH0A0HYM2', name: '미국 하이일드 스프레드', unit: '%', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: 'ICE BofA', description: '글로벌 신용 리스크 온/오프 지표', fredId: 'BAMLH0A0HYM2' },
    { id: 'SOFR', name: 'SOFR', unit: '%', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: 'NY Fed', description: '금융기관 간 담보부 유동성 지표', fredId: 'SOFR' },
    { id: 'EFFR', name: 'EFFR', unit: '%', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: 'Fed', description: '미 유동성 측정 실효연방기금금리', fredId: 'EFFR' },
    { id: 'DTB3', name: 'T-Bill 3M', unit: '%', block: FACTOR_BLOCKS.RISK.id, impact: 'down', source: 'Fed', description: '미국 무위험 단기 국채 금리', fredId: 'DTB3' },
    { id: 'KOSPI', name: '코스피 지수', unit: 'pt', block: FACTOR_BLOCKS.ASSETS.id, impact: 'down', source: 'Yahoo Finance 실시간', description: '국내 증시 흐름 및 외인 심리', realtimeSymbol: '^KS11', fredId: null },
    { id: 'KOSPI_NIGHT', name: '코스피 야간선물(ETN)', unit: '원', block: FACTOR_BLOCKS.ASSETS.id, impact: 'down', source: 'Yahoo Finance 실시간', description: '야간 시간대 코스피 선물 흐름', realtimeSymbol: '580039.KS', historySymbol: '122630.KS', fredId: null },
    { id: 'NASDAQ', name: '나스닥 종합지수', unit: 'pt', block: FACTOR_BLOCKS.GLOBAL_INDICES.id, impact: 'down', source: 'NASDAQ', description: '미국 기술주 중심 성장성 지표', realtimeSymbol: '^IXIC', fredId: null },
    { id: 'SP500', name: 'S&P 500 지수', unit: 'pt', block: FACTOR_BLOCKS.GLOBAL_INDICES.id, impact: 'down', source: 'S&P', description: '미 대형주 중심 글로벌 벤치마크', realtimeSymbol: '^GSPC', fredId: null },
    { id: 'SOX', name: '필라델피아 반도체지수', unit: 'pt', block: FACTOR_BLOCKS.GLOBAL_INDICES.id, impact: 'down', source: 'NASDAQ', description: '반도체 업황 및 코스피 동조화', realtimeSymbol: '^SOX', fredId: null },
    { id: 'nasdaq-futures', name: '나스닥 100 선물', unit: 'pt', block: FACTOR_BLOCKS.GLOBAL_INDICES.id, impact: 'down', source: 'CME', description: '미 기술주 실시간 투자 심리', realtimeSymbol: 'NQ=F', fredId: null },
    { id: 'sp500-futures', name: 'S&P 500 선물', unit: 'pt', block: FACTOR_BLOCKS.GLOBAL_INDICES.id, impact: 'down', source: 'CME', description: '전 세계 증시 흐름의 실시간 척도', realtimeSymbol: 'ES=F', fredId: null },
    { id: 'DCOILWTICO', name: '국제 유가(WTI)', unit: '$', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: 'WTI', description: '유가 상승 시 인플레 및 달러 수요', realtimeSymbol: 'CL=F' },
    // --- 금리 기대 산출용 (hidden: AI 분석 내부 계산용, 대시보드 미표시) ---
    { id: 'GS1', name: '미 1년물 국채금리', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'Fed', description: '시장 내재 단기 금리 기대치', fredId: 'DGS1', hidden: true },
    { id: 'GS2', name: '미 2년물 국채금리', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'Fed', description: '단기 금리차 계산용', fredId: 'DGS2', hidden: true },
    { id: 'DFEDTARU', name: 'Fed 기준금리 목표 상단', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'Federal Reserve', description: 'FOMC 기준금리 목표 범위 상단', fredId: 'DFEDTARU', hidden: true },
    { id: 'DFEDTARL', name: 'Fed 기준금리 목표 하단', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'Federal Reserve', description: 'FOMC 기준금리 목표 범위 하단', fredId: 'DFEDTARL', hidden: true },
];

// 3. 국내지표 (ECOS)
const ECOS_SERIES = [
    { id: 'bok-rate', statCode: '722Y001', item1: '0101000', name: '한국 기준금리', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'down', source: '한국은행', description: '한국 기준금리, 한미 금리차 결정', cycle: 'D' },
    { id: 'investor-deposits', name: '투자자예탁금', unit: '억원', block: FACTOR_BLOCKS.ASSETS.id, impact: 'down', source: '금융투자협회/Yahoo', description: '증시 대기 자금, 투자 심리 지표', transform: 'wonToEok' },
    { id: 'kr-cpi', statCode: '901Y009', item1: '0', name: '한국 소비자물가', unit: '%', block: FACTOR_BLOCKS.FUNDING_POLICY.id, impact: 'down', source: '한국은행', description: '한국 물가 지표, 금리 정책 영향', cycle: 'M' },
    { id: 'kr-10y', statCode: '817Y002', item1: '010210000', name: '국고채 10년', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'down', source: '한국은행', description: '한국 국고채 금리, 한미 금리차용', cycle: 'D' },
    { id: 'kr-2y', statCode: '817Y002', item1: '010190000', name: '국고채 2년', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'down', source: '한국은행', description: '한미 2년물 금리차 계산용', cycle: 'D', hidden: true },
    { id: 'trade-balance', statCode: '301Y013', item1: '000000', name: '경상수지', unit: 'M$', block: FACTOR_BLOCKS.FUNDING_POLICY.id, impact: 'down', source: '한국은행', description: '수지 흑자 시 원화 가치 안정', cycle: 'M' },
    { id: 'fx-reserves', statCode: '732Y001', item1: '99', name: '외환보유액', unit: '억$', block: FACTOR_BLOCKS.FUNDING_POLICY.id, impact: 'down', source: '한국은행', description: '외환 방어 및 원화 안정화 능력', cycle: 'M', transform: 'thousandUsdToEokUsd' },
    { id: 'short-debt-ratio', statCode: '311Y004', item1: 'A500000', name: '단기외채 비중', unit: '%', block: FACTOR_BLOCKS.FUNDING_POLICY.id, impact: 'up', source: '한국은행', description: '대외채무 건전성 및 상환 능력', cycle: 'Q', customFetch: 'shortDebtRatio' }
];

async function fetchFromFred(seriesId) {
    return new Promise((resolve) => {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=250&sort_order=desc`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.observations || []);
                } catch (e) { resolve([]); }
            });
        }).on('error', () => resolve([]));
    });
}

// --- 모델 고도화 유틸리티 ---
// --- 파생상품 만기일 감지 (KOSPI200 선물/옵션 만기: 매월 두 번째 목요일) ---
function getKospi200ExpiryInfo(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed
    // 해당 월 두 번째 목요일 계산
    let count = 0;
    let expiryDate = null;
    for (let d = 1; d <= 31; d++) {
        const dt = new Date(year, month, d);
        if (dt.getMonth() !== month) break;
        if (dt.getDay() === 4) { // 목요일(4)
            count++;
            if (count === 2) { expiryDate = dt; break; }
        }
    }
    if (!expiryDate) return { isExpiryWeek: false, isExpiryDay: false, daysToExpiry: 99, isQuarterly: false };

    const diffMs = expiryDate.getTime() - date.getTime();
    const daysToExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isExpiryDay = daysToExpiry === 0;
    const isExpiryWeek = daysToExpiry >= 0 && daysToExpiry <= 3;
    // 분기 만기 (3/6/9/12월): 선물 만기로 볼륨 급증
    const isQuarterly = [2, 5, 8, 11].includes(month);

    return { isExpiryWeek, isExpiryDay, daysToExpiry: Math.max(0, daysToExpiry), isQuarterly, expiryDate };
}

function calculateZScore(value, history) {
    if (!history || history.length < 5) return 0;
    const values = history.map(h => h.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    return stdDev === 0 ? 0 : (value - mean) / stdDev;
}

function getFreshnessMultiplier(cycle) {
    if (cycle === 'realtime' || cycle === 'D') return 1.2; // 실시간/일간 데이터 우선
    if (cycle === 'M') return 0.8; // 월간 데이터 감쇠
    if (cycle === 'Q') return 0.5; // 분기 데이터 대폭 감쇠
    return 1.0;
}

// --- 기술적 지표 계산 유틸리티 ---
// 입력: closes = [최신, ..., 과거] 순서의 종가 배열

function calculateMACD(closes) {
    if (!closes || closes.length < 35) return null;
    const prices = [...closes].reverse(); // 과거->최신
    const ema = (data, p) => {
        let k = 2 / (p + 1);
        let emaArray = [data[0]];
        for (let i = 1; i < data.length; i++) {
            emaArray.push(data[i] * k + emaArray[i - 1] * (1 - k));
        }
        return emaArray;
    };
    const ema12 = ema(prices, 12);
    const ema26 = ema(prices, 26);
    const macdLine = [];
    for(let i=0; i<prices.length; i++) {
        macdLine.push(ema12[i] - ema26[i]);
    }
    const signalLine = ema(macdLine, 9);
    
    const latestMacd = parseFloat(macdLine[macdLine.length - 1].toFixed(2));
    const latestSignal = parseFloat(signalLine[signalLine.length - 1].toFixed(2));
    return { macd: latestMacd, signal: latestSignal, hist: parseFloat((latestMacd - latestSignal).toFixed(2)) };
}

function calculateStochastic(historyData, period = 14) {
    if (!historyData || historyData.length < period) return null;
    // historyData는 최신->과거 순서
    const recent = historyData.slice(0, period);
    const currentClose = recent[0].close;
    const highs = recent.map(d => parseFloat(d.high)).filter(h => !isNaN(h));
    const lows = recent.map(d => parseFloat(d.low)).filter(l => !isNaN(l));
    
    if (highs.length === 0 || lows.length === 0) return null;
    const highestHigh = Math.max(...highs);
    const lowestLow = Math.min(...lows);
    
    if (highestHigh === lowestLow) return { k: 50 };
    const fastK = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    return { k: parseFloat(fastK.toFixed(1)) };
}

function calculateRSI(closes, period = 14) {
    if (!closes || closes.length < period + 1) return null;
    // RSI 계산용: 과거→최신 순으로 변환
    const prices = [...closes].reverse();
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        const diff = prices[prices.length - i] - prices[prices.length - i - 1];
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
}

function calculateMA(closes, period) {
    if (!closes || closes.length < period) return null;
    const slice = closes.slice(0, period); // 최신 N개
    return parseFloat((slice.reduce((a, b) => a + b, 0) / period).toFixed(2));
}

function calculateBB(closes, period = 20) {
    const ma = calculateMA(closes, period);
    if (ma === null) return null;
    const slice = closes.slice(0, period);
    const variance = slice.reduce((a, b) => a + Math.pow(b - ma, 2), 0) / period;
    const std = Math.sqrt(variance);
    return {
        upper: parseFloat((ma + 2 * std).toFixed(2)),
        mid: parseFloat(ma.toFixed(2)),
        lower: parseFloat((ma - 2 * std).toFixed(2)),
        bandwidth: parseFloat(((4 * std / ma) * 100).toFixed(2)) // %
    };
}

function calculateMomentum(closes) {
    // 변화율: (현재 - N일 전) / N일 전 × 100
    const pct = (n) => closes.length > n
        ? parseFloat(((closes[0] - closes[n]) / closes[n] * 100).toFixed(2))
        : null;
    return { d1: pct(1), d5: pct(5), d20: pct(20) };
}

function detectKeyLevels(historyData) {
    // historyData: [{date, high, low, close}] 최신→과거 순
    // 최근 60일 기준 고점/저점으로 지지/저항 산출
    const recent = historyData.slice(0, 60);
    if (!recent || recent.length === 0) return { support: null, resistance: null };
    const highs = recent.map(d => d.high).filter(Boolean);
    const lows = recent.map(d => d.low).filter(Boolean);
    const resistance = parseFloat(Math.max(...highs).toFixed(2));
    const support = parseFloat(Math.min(...lows).toFixed(2));
    return { support, resistance };
}

// --- 4단계: 백테스팅 통계 ---
function calcStreak(evaluated) {
    if (!evaluated || evaluated.length === 0) return '이력 없음';
    const last = evaluated[evaluated.length - 1];
    let count = 0;
    const target = last.hit_d1;
    for (let i = evaluated.length - 1; i >= 0; i--) {
        if (evaluated[i].hit_d1 === target) count++;
        else break;
    }
    return target ? `연속 ${count}회 적중` : `연속 ${count}회 미적중`;
}

function calcBacktestSummary(records) {
    if (!records || records.length === 0) return null;

    // USD/KRW 적중률
    const evaluated = records.filter(r => r.hit_d1 !== null);
    if (evaluated.length === 0) return null;
    const hitRate = Math.round((evaluated.filter(r => r.hit_d1).length / evaluated.length) * 100);
    const last5 = evaluated.slice(-5);
    const recentHitRate = Math.round((last5.filter(r => r.hit_d1).length / last5.length) * 100);

    // KOSPI 적중률
    const kospiEvaluated = records.filter(r => r.kospi_hit_d1 !== null && r.kospi_hit_d1 !== undefined);
    const kospiHitRate = kospiEvaluated.length > 0
        ? Math.round((kospiEvaluated.filter(r => r.kospi_hit_d1).length / kospiEvaluated.length) * 100)
        : null;
    const kospiRecent5 = kospiEvaluated.slice(-5);
    const kospiRecentHitRate = kospiRecent5.length > 0
        ? Math.round((kospiRecent5.filter(r => r.kospi_hit_d1).length / kospiRecent5.length) * 100)
        : null;

    return {
        total: evaluated.length,
        hitRate,
        recentHitRate,
        streak: calcStreak(evaluated),
        kospiHitRate,
        kospiRecentHitRate,
        kospiTotal: kospiEvaluated.length
    };
}

// --- 5단계: 복합 신호 감지 (Compound Signal Index) ---
function detectCompoundSignals(indicators) {
    const signals = [];
    const get = (id) => indicators.find(i => i.id.toLowerCase() === id.toLowerCase());
    const val = (id) => { const s = get(id); return s ? parseFloat(String(s.value).replace(/,/g, '')) : null; };
    const trend = (id) => { const s = get(id); return s ? s.trend : null; };

    const vix       = val('vixcls');
    const dxy       = val('dxy');
    const hySpread  = val('bamlh0a0hym2'); // %
    const foreigner = trend('foreigner-net-buy-market');
    const rateDiff  = trend('rate-differential');
    const dxyTrend  = trend('dxy');
    const vixTrend  = trend('vixcls');

    // 시나리오 1: 달러 패닉 (DXY 상승 + VIX 상승 동시)
    if (dxyTrend === 'up' && vixTrend === 'up') {
        signals.push({ type: 'DOLLAR_PANIC', up: 2.5, down: 0, block: 'risk', desc: '달러패닉 (DXY↑+VIX↑): 신흥국 자본 이탈 극가속' });
    }

    // 시나리오 2: 신용위기 (하이일드 4% 돌파 + VIX 30 초과 동시)
    if (hySpread !== null && vix !== null && hySpread > 4.0 && vix > 30) {
        signals.push({ type: 'CREDIT_CRISIS', up: 3.0, down: 0, block: 'risk', desc: `신용위기 (HY스프레드${hySpread}%+VIX${vix})` });
    }

    // 시나리오 3: 자본 유출 복합 (한미 금리차 확대 + 외인 순매도)
    if (rateDiff === 'up' && foreigner === 'down') {
        signals.push({ type: 'CAPITAL_OUTFLOW', up: 2.0, down: 0, block: 'assets', desc: '자본유출 (금리차확대+외인매도 동시)' });
    }

    // 시나리오 4: 안전자산 역전 (VIX 급등 + DXY 하락 → 일부 위험자산 복귀 신호)
    if (vixTrend === 'up' && dxyTrend === 'down' && vix !== null && vix > 25) {
        signals.push({ type: 'RISK_DIVERGE', up: 0, down: 1.5, block: 'risk', desc: `위험/달러 분리 (VIX↑+DXY↓): 일시적 반등 가능성` });
    }

    return signals;
}

function summarizeByBlock(indicators) {

    const summary = {};
    Object.values(FACTOR_BLOCKS).forEach(block => {
        const blockIndicators = indicators.filter(i => i.block === block.id);
        if (blockIndicators.length > 0) {
            summary[block.name] = blockIndicators.map(i => 
                `- ${i.name}: ${i.value}${i.unit} (추세: ${i.trend})`
            ).join('\n');
        }
    });
    return Object.entries(summary).map(([blockName, items]) => `[${blockName}]\n${items}`).join('\n\n');
}

async function fetchFromEcos(item) {
    if (!ECOS_API_KEY) return null;
    return new Promise((resolve) => {
        const today = new Date();
        const currentYear = today.getFullYear();
        let start, end;

        const pad = (n) => String(n).padStart(2, '0');
        const todayStr = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;

        // ECOS 주기별 정확한 날짜 규격 적용
        if (item.cycle === 'Q') {
            start = `${currentYear - 2}Q1`; // YYYYQ1 형식
            end = `${currentYear}Q4`;
        } else if (item.cycle === 'D') {
            // 최신 15개를 가져오기 위해 시작일을 오늘 기준 60일 전으로 설정 (충분한 시계열 확보)
            const sixtyDaysAgo = new Date(today);
            sixtyDaysAgo.setDate(today.getDate() - 60);
            start = `${sixtyDaysAgo.getFullYear()}${pad(sixtyDaysAgo.getMonth() + 1)}${pad(sixtyDaysAgo.getDate())}`;
            end = todayStr;
        } else if (item.cycle === 'M') {
            // 최근 15개월 데이터를 위해 시작일을 15개월 전으로 설정
            const fifteenMonthsAgo = new Date(today);
            fifteenMonthsAgo.setMonth(today.getMonth() - 15);
            start = `${fifteenMonthsAgo.getFullYear()}${pad(fifteenMonthsAgo.getMonth() + 1)}`;
            end = todayStr.substring(0, 6);
        } else {
            start = `${currentYear - 1}01`;
            end = todayStr.substring(0, 6);
        }

        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_API_KEY}/json/kr/1/100/${item.statCode}/${item.cycle}/${start}/${end}/${item.item1}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row) {
                        resolve(json.StatisticSearch.row.reverse());
                    } else {
                        const maskedUrl = url.replace(ECOS_API_KEY, '{ECOS_API_KEY}');
                        console.warn(`ℹ️ [ECOS-API] ${item.name} 데이터 없음: ${json.RESULT?.MESSAGE || '알 수 없는 이유'}`);
                        console.warn(`🔗 요청 URL: ${maskedUrl}`);
                        resolve(null);
                    }
                } catch (e) { 
                    resolve(null); 
                }
            });
        }).on('error', (e) => {
            console.error(`❌ [ECOS-Network] ${item.name} 에러: ${e.message}`);
            resolve(null);
        });
    });
}

// 단기외채 비중 전용 fetch: 단기(A500000) / 총계(A000000)를 각각 가져와 비중(%) 산출
async function fetchShortDebtRatio() {
    if (!ECOS_API_KEY) return null;
    const today = new Date();
    const currentYear = today.getFullYear();
    const start = `${currentYear - 2}Q1`;
    const end = `${currentYear}Q4`;

    const fetchItem = (itemCode) => new Promise((resolve) => {
        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_API_KEY}/json/kr/1/100/311Y004/Q/${start}/${end}/${itemCode}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row) {
                        resolve(json.StatisticSearch.row);
                    } else { resolve(null); }
                } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });

    try {
        const [shortRows, totalRows] = await Promise.all([
            fetchItem('A500000'),  // 1.단기
            fetchItem('A000000')   // 대외채무 총계
        ]);

        if (!shortRows || !totalRows || shortRows.length === 0 || totalRows.length === 0) return null;

        // 같은 분기의 단기/총계를 매칭하여 비중(%) 계산
        const result = shortRows.map(sr => {
            const tr = totalRows.find(t => t.TIME === sr.TIME);
            if (!tr) return null;
            const shortVal = parseFloat(sr.DATA_VALUE);
            const totalVal = parseFloat(tr.DATA_VALUE);
            if (isNaN(shortVal) || isNaN(totalVal) || totalVal === 0) return null;
            return {
                TIME: sr.TIME,
                DATA_VALUE: ((shortVal / totalVal) * 100).toFixed(1)
            };
        }).filter(Boolean);

        return result.length > 0 ? result.reverse() : null;
    } catch (e) {
        console.error('❌ [ECOS] 단기외채 비중 계산 에러:', e.message);
        return null;
    }
}

// --- KIS 전용 안정화 통신 유틸리티 (v15.2 https-request 기반) ---
async function kisRequest(method, path, headers, params = null) {
    const execute = async (baseUrl) => {
        const isGet = method.toUpperCase() === 'GET';
        const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        const cleanPath = path.startsWith('/') ? path : `/${path}`;
        const urlObj = new URL(`${cleanBase}${cleanPath}`);
        let fullUrl = urlObj.toString();
        
        if (isGet && params) {
            const query = Object.entries(params)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
            fullUrl += (fullUrl.includes('?') ? '&' : '?') + query;
        }

        return new Promise((resolve) => {
            const targetUrl = new URL(fullUrl);
            const body = (!isGet && params) ? JSON.stringify(params) : null;
            
            const reqOptions = {
                hostname: targetUrl.hostname,
                port: targetUrl.port || 443,
                path: targetUrl.pathname + targetUrl.search,
                method: method.toUpperCase(),
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    ...headers
                },
                timeout: 15000 
            };

            if (body) {
                reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
            }

            const req = https.request(reqOptions, (res) => {
                let data = '';
                res.setEncoding('utf8');
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (!data) {
                            resolve({ error: `Empty Response (HTTP ${res.statusCode})` });
                            return;
                        }
                        const parsed = JSON.parse(data);
                        if (parsed.rt_cd && parsed.rt_cd !== '0') {
                           console.log(`📡 [KIS-Debug] ${parsed.tr_id || 'UNK'}: [${parsed.msg_cd}] ${parsed.msg1}`);
                           console.log(`🔗 [KIS-DebugURL] ${method} ${fullUrl}`); // 실패 시 전체 URL 노출
                        }
                        resolve(parsed);
                    } catch (e) {
                        resolve({ error: `JSON Parse: ${e.message}`, raw: data, statusCode: res.statusCode });
                    }
                });
            });

            req.on('error', e => resolve({ error: `Network Error: ${e.message}` }));
            req.on('timeout', () => { req.destroy(); resolve({ error: 'Request Timeout' }); });
            if (body) req.write(body);
            req.end();
        });
    };

    // 1차 시도: 9443 (실전투자 기본 포트)
    let result = await execute(KIS_BASE_URL);

    // 문제 발생 시 443 포트로 우회 (단, 404가 확실시되는 시세 API 경로는 제외)
    const isFailed = result.error || (result.rt_cd && result.rt_cd !== '0');
    const isQuotation = path.includes('/quotations/');

    if (isFailed && !isQuotation) {
        const errDetail = result.error || `[${result.msg_cd}] ${result.msg1}`;
        const fallbackBase = 'https://openapi.koreainvestment.com:443';
        console.log(`ℹ️ [KIS-Net] 우회 시도(사유:${errDetail}) → ${fallbackBase}`);
        result = await execute(fallbackBase);
    }
    return result;
}

/**
 * KIS 시장별 투자자 매매동향 (v15.2 최종 성공 버전)
 * [성공 전략] FID_COND_SCR_DIV_CODE: '20403' 필수
 */
async function fetchMarketInvestorTrend() {
    // [v16.0 삼성증권 스크래핑 전략] KIS API 대신 삼성증권 내부 API 사용
    const url = 'https://www.samsungpop.com/wts/fidBuilder.do';
    const payload = JSON.stringify([
        {
            "idx": "fid11500",
            "gid": "1150",
            "fidCodeBean": { "242": "02", "9228": "7,16,9" },
            "outFid": "3,17,19",
            "isList": "1",
            "order": "ASC",
            "reqCnt": "30",
            "actionKey": "0",
            "saveBufLen": "1",
            "saveBuf": "1"
        }
    ]);

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.samsungpop.com/mbw/trading/etc.do?cmd=compositeList',
            'Origin': 'https://www.samsungpop.com',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    try {
        const result = await new Promise((resolve, reject) => {
            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        const rows = parsed.fid11500?.data || [];
                        const trends = { personal: 0, foreigner: 0, institution: 0 };
                        
                        rows.forEach(row => {
                            const val = parseInt(row["17"] || "0"); // 억원 단위
                            if (row["3"] === "0018") trends.personal = val;
                            if (row["3"] === "001C") trends.foreigner = val;
                            if (row["3"] === "001T") trends.institution = val;
                        });
                        resolve(trends);
                    } catch (e) {
                        reject(new Error(`Samsung Parse Error: ${e.message}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        console.log(`✅ [Samsung-Scrape] KOSPI 수급 데이터 획득: 개 ${result.personal}, 외 ${result.foreigner}, 기 ${result.institution}`);
        
        const mergeHistory = (type, currentVal) => {
            const hist = [...KOSPI_INVESTOR_HISTORY[type]];
            //  [개선] 주말/공휴일에는 오늘(KST 토/일) 날짜의 새로운 노드를 생성하지 않음
            const day = new Date().getDay(); // 0:일, 6:토
            const isWeekend = (day === 0 || day === 6);

            // 오늘 날짜 데이터가 히스토리에 이미 있으면 실시간 값으로 업데이트, 
            // 단, 신규로 추가하는 것은 정규장(평일) 기간에만 허용
            if (hist.length > 0 && hist[0].date === today) {
                hist[0].value = currentVal;
            } else if (!isWeekend) {
                hist.unshift({ date: today, value: currentVal });
            }
            return hist;
        };

        return {
            foreigner:   mergeHistory('foreigner', result.foreigner),
            institution: mergeHistory('institution', result.institution),
            individual:  mergeHistory('individual', result.personal),
            status: 'Confirmed', subState: null, realtimeMsg: ''
        };
    } catch (e) {
        console.error('❌ [Samsung-Scrape] 삼성증권 수집 실패:', e.message);
        return { 
            foreigner: KOSPI_INVESTOR_HISTORY.foreigner, 
            institution: KOSPI_INVESTOR_HISTORY.institution, 
            individual: KOSPI_INVESTOR_HISTORY.individual,
            status: 'Error', subState: null, realtimeMsg: 'SamsungScrapeOffline' 
        };
    }
}


/**
 * KIS API: 국내기관_외국인 매매종목 가집계 (FHPTJ04400000)
 * 장중 실시간 추정치 (09:30, 10:00, 11:20, 13:20, 14:30 입력)
 */
async function fetchStockProvisionalTrend(token, iscd = "005930") {
    if (!token) return null;
    try {
        const data = await kisRequest("GET", "/uapi/domestic-stock/v1/quotations/foreign-institution-total", {
            "Authorization": `Bearer ${token}`,
            "appkey": KIS_APP_KEY,
            "appsecret": KIS_APP_SECRET,
            "tr_id": "FHPTJ04400000",
            "custtype": "P"
        }, {
            FID_COND_MRKT_DIV_CODE: "J",
            FID_COND_SCR_DIV_CODE: "20440", // [추가] 가집계 필수 화면코드
            FID_INPUT_ISCD: iscd
        });

        if (data && data.rt_cd === '0' && data.output2 && data.output2.length > 0) {
            const latest = data.output2[0];
            return {
                foreignerQty: parseInt(latest.frgn_fake_ntby_qty),
                institutionQty: parseInt(latest.orgn_fake_ntby_qty),
                sumQty: parseInt(latest.sum_fake_ntby_qty),
                timeGb: latest.bsop_hour_gb, // 1~5
                history: data.output2.map(h => ({
                    timeGb: h.bsop_hour_gb,
                    foreigner: parseInt(h.frgn_fake_ntby_qty),
                    institution: parseInt(h.orgn_fake_ntby_qty)
                })).reverse()
            };
        }
    } catch (e) {
        console.error(`❌ KIS 종목 가집계 조회 에러 (${iscd}):`, e.message);
    }
    return null;
}




/**
 * KIS API를 통한 증시 통계 조회 (예탁금, 신용융자 등)
 * TR ID: FHKST649100C0 (국내 증시자금 종합 [국내주식-193])
 */
async function fetchMarketStats(token) {
    if (!token) return null;

    try {
        const endDate = todayStr.replace(/-/g, '');
        
        // v12 정품 규역: FHKST649100C0 (증시자금종합)
        const data = await kisRequest("GET", "/uapi/domestic-stock/v1/quotations/mktfunds", {
            "Authorization": `Bearer ${token}`,
            "appkey": KIS_APP_KEY,
            "appsecret": KIS_APP_SECRET,
            "tr_id": "FHKST649100C0",
            "custtype": "P"
        }, {
            FID_COND_MRKT_DIV_CODE: "J", 
            FID_INPUT_ISCD: "0000",
            FID_INPUT_DATE_1: endDate
        });

        if (data?.output && Array.isArray(data.output) && data.output.length > 0) {
            // 최신순 정렬
            const sortedOutput = data.output.sort((a, b) => (b.bsop_date || "").localeCompare(a.bsop_date || ""));
            
            const deposits = sortedOutput.map(d => ({
                date: (d.bsop_date || "").replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                // pbmn: 백만원 -> 100으로 나눠서 억원(0.1억 정밀도) 치환
                value: Math.round(parseFloat(d.cst_marg_amt || d.CST_MARG_AMT || 0) / 100)
            })).filter(d => d.date);

            const creditMargin = sortedOutput.map(d => ({
                date: (d.bsop_date || "").replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                value: Math.round(parseFloat(d.marg_cncl_amt || d.MARG_CNCL_AMT || 0) / 100)
            })).filter(d => d.date);

            return { deposits, creditMargin };
        }
    } catch (e) {
        console.error('❌ KIS 증시자금 수집 에러:', e.message);
    }
    return null;
}


/**
 * 금융투자협회(FreeSIS) 데이터 스크래핑
 * @param {string} objNm 대상 오브젝트명 (STATSCU0100000060BO: 예탁금, STATSCU0100000070BO: 신용융자)
 */
async function fetchFromFreeSIS(objNm = "STATSCU0100000060BO") {
    try {
        const today = todayStr.replace(/-/g, '');
        // 3개월치 데이터 요청
        const threeMonthsAgoRaw = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }));
        threeMonthsAgoRaw.setDate(threeMonthsAgoRaw.getDate() - 90);
        const threeMonthsAgo = threeMonthsAgoRaw.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');
        
        const payload = {
            dmSearch: {
                tmpV40: "1000000",
                tmpV41: "1",
                tmpV1: "D",
                tmpV45: threeMonthsAgo,
                tmpV46: today,
                OBJ_NM: objNm
            }
        };

        const res = await fetch("https://freesis.kofia.or.kr/meta/getMetaDataList.do", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win32; x64) AppleWebKit/537.36"
            },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (data.ds1 && Array.isArray(data.ds1)) {
            // TMPV1: 날짜, TMPV2: 값 (백만원 단위)
            return data.ds1.map(row => {
                let rawDate = (row.TMPV1 || "");
                // 날짜 포맷 정규화 (YYYY/MM/DD 또는 YYYYMMDD -> YYYY-MM-DD)
                let dateStr = rawDate.includes('/') 
                    ? rawDate.replace(/\//g, '-') 
                    : rawDate.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');

                return {
                    date: dateStr,
                    value: Math.round(parseFloat(String(row.TMPV2 || "0").replace(/,/g, '')) / 100)
                };
            }).sort((a,b) => b.date.localeCompare(a.date));
        }
    } catch (e) {
        console.warn(`ℹ️ [FreeSIS] 데이터 수집 실패 (${objNm}):`, e.message);
    }
    return null;
}

/**
 * KIS API를 통한 프로그램 매매 현황 조회
 * TR ID: FHKST01010114
 */
async function fetchProgramTrading(token) {
    if (!token) return null;

    try {
        const data = await kisRequest("GET", "/uapi/domestic-stock/v1/quotations/program-trading", {
            "Authorization": `Bearer ${token}`,
            "appkey": KIS_APP_KEY,
            "appsecret": KIS_APP_SECRET,
            "tr_id": "FNGST01010400",
            "custtype": "P"
        }, {
            FID_COND_MRKT_DIV_CODE: "J",
            FID_INPUT_ISCD: "0001"
        });

        if (data?.output && Array.isArray(data.output) && data.output.length > 0) {
            const latest = data.output[0];
            // 백만원(pbmn) -> 억원 변환
            const netBuy = Math.round(parseFloat(latest.nabt_smtn_ntby_tr_pbmn) / 100); 
            return {
                value: netBuy,
                history: data.output.map(d => ({
                    date: d.bsop_hour.substring(0, 4), 
                    value: Math.round(parseFloat(d.nabt_smtn_ntby_tr_pbmn) / 100)
                })).slice(0, 10).reverse()
            };
        }
    } catch (e) {
        console.error("❌ KIS 프로그램 매매 조회 실패:", e.message);
    }
    return null;
}

/**
 * KIS API를 통한 국내 금리 종합 조회
 * TR ID: FHKST01011550
 */
async function fetchBondRates(token) {
    if (!token) return null;

    try {
        const data = await kisRequest("GET", "/uapi/domestic-stock/v1/quotations/comp-interest", {
            "Authorization": `Bearer ${token}`,
            "appkey": KIS_APP_KEY,
            "appsecret": KIS_APP_SECRET,
            "tr_id": "FHPST07020000",
            "custtype": "P"
        }, {
            FID_COND_MRKT_DIV_CODE: "U",
            FID_INPUT_ISCD: "0001"
        });

        if (data?.output && Array.isArray(data.output)) {
            const cd = data.output.find(r => r.bcdt_code === "Y0112");
            const cp = data.output.find(r => r.bcdt_code === "Y0113");
            return {
                cd: cd ? parseFloat(cd.bond_mnrt_prpr) : null,
                cp: cp ? parseFloat(cp.bond_mnrt_prpr) : null
            };
        }
    } catch (e) {
        console.error("❌ KIS 금리 종합 조회 실패:", e.message);
    }
    return null;
}


async function getKisAccessToken() {
    if (!KIS_APP_KEY || !KIS_APP_SECRET) {
        console.warn("⚠️ [Auth] KIS API 키가 소스코드에 로드되지 않았습니다. (process.env 확인 필요)");
        return null;
    }

    const tokenPath = path.join(__dirname, '..', '.kis-token.json');
    
    // 1. 캐시된 토큰 확인 (12시간 유효)
    try {
        if (fs.existsSync(tokenPath)) {
            const cached = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            const now = Date.now();
            const issuedAt = cached.issued_at || 0;
            const hoursPassed = (now - issuedAt) / (1000 * 60 * 60);

            if (hoursPassed < 12) {
                console.log(`✅ KIS 토큰 재사용 중 (발급 후 ${Math.round(hoursPassed)}시간 경과)`);
                return cached.access_token;
            }
        }
    } catch (e) {
        console.warn("⚠️ 토큰 캐시 읽기 실패, 새로 발급합니다.");
    }

    try {
        // 2. v12.1 Stable: https.request 기반 토큰 신규 발급
        console.log("🚀 KIS 신규 토큰 발급 시도 중...");
        const tokenRes = await kisRequest("POST", "/oauth2/tokenP", {}, {
            grant_type: "client_credentials",
            appkey: KIS_APP_KEY,
            appsecret: KIS_APP_SECRET
        });

        if (tokenRes.access_token) {
            console.log("✅ KIS 토큰 신규 발급 성공");
            fs.writeFileSync(tokenPath, JSON.stringify({
                access_token: tokenRes.access_token,
                issued_at: Date.now()
            }, null, 2));
            return tokenRes.access_token;
        } else {
            console.error("❌ KIS 토큰 발급 최종 실패:", JSON.stringify(tokenRes));
            return null;
        }
    } catch (e) {
        console.error("❌ KIS 토큰 발급 에러:", e.message);
        return null;
    }
}

async function fetchDomesticStockFromKIS(code, token) {
    try {
        const data = await kisRequest("GET", "/uapi/domestic-stock/v1/quotations/inquire-price", {
            "Authorization": `Bearer ${token}`,
            "appkey": KIS_APP_KEY,
            "appsecret": KIS_APP_SECRET,
            "tr_id": "FHKST01010100",
            "custtype": "P"
        }, {
            FID_COND_MRKT_DIV_CODE: "J",
            FID_INPUT_ISCD: code
        });
        
        if (data.output) {
            return {
                price: parseFloat(data.output.stck_prpr),
                changePercent: (parseFloat(data.output.prdy_ctrt)).toFixed(2),
                trend: parseFloat(data.output.prdy_vrss) > 0 ? 'up' : (parseFloat(data.output.prdy_vrss) < 0 ? 'down' : 'neutral')
            };
        }
    } catch (e) {
        console.error(`❌ KIS 국내주식 조회 에러 (${code}):`, e.message);
    }
    return null;
}

async function fetchOverseasStockFromKIS(excd, symbol, token) {
    try {
        const data = await kisRequest("GET", "/uapi/overseas-stock/v1/quotations/price", {
            "Authorization": `Bearer ${token}`,
            "appkey": KIS_APP_KEY,
            "appsecret": KIS_APP_SECRET,
            "tr_id": "HHDFS00000300",
            "custtype": "P"
        }, {
            EXCD: excd,
            SYMB: symbol
        });

        if (data.output) {
            return {
                price: parseFloat(data.output.last),
                changePercent: (parseFloat(data.output.rate)).toFixed(2),
                trend: parseFloat(data.output.diff) > 0 ? 'up' : (parseFloat(data.output.diff) < 0 ? 'down' : 'neutral')
            };
        }
    } catch (e) {
        console.error(`❌ KIS 해외주식 조회 에러 (${symbol}):`, e.message);
    }
    return null;
}

async function fetchAiAnalysis(indicators, usdKrwHistory = [], technicals = null, backtest = null, kospiTechnicals = null, upProb = 50, downProb = 50, kospiUpProb = 50, kospiDownProb = 50, kospiHistory = [], correlations = null, majorRates = [], additionalMetrics = null) {
    if (!GEMINI_API_KEY) {
        return "Gemini API 키가 설정되지 않아 기본 분석 시스템을 사용합니다.";
    }

    const blockSummary = summarizeByBlock(indicators);

    let techSection = '';
    let kospiTechSection = '';
    let corrSection = '';
    let newsSection = '';

    if (technicals) {
        const { rsi14, ma5, ma20, ma60, bb, momentum, keyLevels } = technicals;
        const rsiSignal = rsi14 > 70 ? '과매수 주의' : (rsi14 < 30 ? '과매도 반등 가능' : '중립');
        const maSignal = ma5 && ma20 ? (ma5 > ma20 ? '단기 상승 모멘텀' : '단기 하락 모멘텀') : '';
        techSection = `
기술적 환율 지표 (USD/KRW):
- RSI(14일): ${rsi14} → ${rsiSignal}
- MACD: MACD=${technicals.macd?.macd || 'N/A'}, Signal=${technicals.macd?.signal || 'N/A'}, Hist=${technicals.macd?.hist || 'N/A'}
- Stochastic(14): %K=${technicals.stochastic?.k || 'N/A'}%
- 이동평균: MA5=${ma5}원, MA20=${ma20}원, MA60=${ma60}원 (${maSignal})
- 볼린저밴드: 상단=${bb?.upper}원 / 중단=${bb?.mid}원 / 하단=${bb?.lower}원 (밴드폭=${bb?.bandwidth}%)
- 단기 모멘텀: 1일=${momentum?.d1}%, 5일=${momentum?.d5}%, 20일=${momentum?.d20}%
- 핵심 레벨: 60일 지지=${keyLevels?.support}원, 저항=${keyLevels?.resistance}원`;

        const { compoundSignals } = technicals;
        if (compoundSignals && compoundSignals.length > 0) {
            techSection += `\n\n⚡ 복합 위험 신호 (동시 발생):`;
            compoundSignals.forEach(s => { techSection += `\n- [${s.type}] ${s.desc}`; });
        }
    }

    if (kospiTechnicals) {
        const { rsi14, ma5, ma20, ma60, bb, momentum, keyLevels } = kospiTechnicals;
        kospiTechSection = `
기술적 코스피 지표:
- RSI(14일): ${rsi14}
- 이동평균: MA5=${ma5}pt, MA20=${ma20}pt, MA60=${ma60}pt
- 볼린저밴드: 상단=${bb?.upper}pt / 하단=${bb?.lower}pt
- 모멘텀: 1일=${momentum?.d1}%, 5일=${momentum?.d5}%, 20일=${momentum?.d20}%
- 지지/저항: 지지=${keyLevels?.support}pt, 저항=${keyLevels?.resistance}pt`;
    }

    if (correlations && correlations.usdkrw) {
        corrSection = "\n주요 지표별 환율 상관계수 (최근 60일):";
        Object.entries(correlations.usdkrw).forEach(([id, val]) => {
            if (typeof val === 'number' && Math.abs(val) > 0.5) {
                corrSection += `\n- ${id}: ${val > 0 ? '정적' : '부적'} 상관 (${val.toFixed(2)})`;
            }
        });
    }

    let macroContext = "[CONTEXT: 거시경제 및 리스크 지표]\n";
    let koreaContext = "\n[CONTEXT: 한국 시장 및 기술지표]\n";
    let fxContext = "\n[CONTEXT: 환율 및 외환 흐름]\n";
    let globalContext = "\n[CONTEXT: 주요 해외 지수 및 상황]\n";

    // 지표별 카테고리 분류
    macroContext += blockSummary.split('\n').filter(l => l.includes('금리') || l.includes('리스크') || l.includes('정책')).join('\n');
    macroContext += `\n${corrSection || ''}`;

    koreaContext += blockSummary.split('\n').filter(l => l.includes('한국') || l.includes('자산') || l.includes('수급')).join('\n');
    koreaContext += `\n${kospiTechSection || ''}`;
    if (kospiHistory && kospiHistory.length > 0) {
        koreaContext += `\n- 코스피 최근 추세 (최신순): ${kospiHistory.slice(0, 7).map((h, idx) => `${idx === 0 ? '[최신]' : ''}${h.close}pt`).join(' ← ')}`;
        koreaContext += `\n- 코스피 기준일: ${kospiHistory[0].date}`;
    }

    fxContext += `\n- 원/달러 최근 추세 (최신순): ${usdKrwHistory.slice(0, 7).map((h, idx) => `${idx === 0 ? '[최신]' : ''}${h.value}원`).join(' ← ')}`;
    fxContext += `\n- 환율 기준일: ${usdKrwHistory[0]?.date || 'N/A'}`;
    if (majorRates && majorRates.length > 0) {
        majorRates.forEach(r => { fxContext += `\n- ${r.name}: ${r.value} (${r.changePercent}%)`; });
    }

    globalContext += `\n${newsSection || ''}`;
    globalContext += `\n${techSection || ''}`;

    let coreDriversContext = "";
    if (additionalMetrics) {
        coreDriversContext = `
[Market Core Drivers - 환율/코스피 방향성 판단 최우선 단기 요인]
- 한미 2년물 금리차 (단기스프레드): ${additionalMetrics.spread_2y}% (해당 값이 전일/과거대비 확대일 경우 환율 상승 압력 강화)
- 달러(DXY) 단기 5일 모멘텀: ${additionalMetrics.dxy_d5}%
- 반도체(SOX) 단기 5일 모멘텀: ${additionalMetrics.sox_d5}% (SOX 모멘텀은 코스피 삼성/하이닉스 선행 지표로 직접 활용)
- 나스닥 선물 단기 흐름: ${additionalMetrics.nq_d5}%
`;
    }

    const combinedDataContext = coreDriversContext + macroContext + koreaContext + fxContext + globalContext;

    const nowKst = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
    const kstHour = nowKst.getUTCHours();
    const kstMinute = nowKst.getUTCMinutes();
    const kstTimeVal = kstHour * 100 + kstMinute;

    let marketSession = "";
    let sessionKeyFocus = "";

    if (kstTimeVal >= 900 && kstTimeVal < 1530) {
        marketSession = "한국 증시 정규장 (장중)";
        sessionKeyFocus = "현재 실시간 수급 상황과 매매 동향, 장중 변동성을 최우선으로 분석하세요. 환율은 한미 2년물 단기 금리 스프레드와 DXY 모멘텀을 핵심 지표로 평가하고, 코스피는 나스닥/SOX 단기 선행 모멘텀을 강하게 반영하여 결론을 도출하세요.";
    } else {
        marketSession = "한국 증시 장마감 후 (야간 및 차일 준비)";
        sessionKeyFocus = "글로벌 지표를 바탕으로 차일 시초가 및 추세 연장을 분석하세요. 야간 구간에서는 한미 2년물 스프레드와 달러 모멘텀의 방향성 변화, 그리고 나스닥/SOX 미국 선물의 흐름이 가장 결정적인 예측 인자입니다.";
    }

    const kstTimeStr = `${nowKst.getUTCFullYear()}년 ${nowKst.getUTCMonth() + 1}월 ${nowKst.getUTCDate()}일 ${nowKst.getUTCHours()}시 ${nowKst.getUTCMinutes()}분`;

    const getVal = id => indicators.find(i => i.id === id)?.value || 0;
    
    // ---  [추가] Anchor Prediction Signal 생성 ---
    const anchorSignal = {
        market: "KOSPI & USD/KRW (Korea Standard)",
        fxCurrent: getVal('usdkrw') || (usdKrwHistory[0]?.value),
        kospiCurrent: getVal('kospi') || (kospiHistory[0]?.close),
        fxUpProb: upProb,
        kospiUpProb: kospiUpProb,
        kospiTechSignal: kospiTechnicals ? (kospiTechnicals.rsi14 > 70 ? "과열(Bullish)" : (kospiTechnicals.rsi14 < 30 ? "침체(Bearish)" : "보합(Neutral)")) : "보합",
        fxTechSignal: technicals ? (technicals.rsi14 > 70 ? "과열(Bullish)" : (technicals.rsi14 < 30 ? "침체(Bearish)" : "보합(Neutral)")) : "보합",
        wtiLevel: getVal('dcoilwtico'),
        vixLevel: getVal('vixcls'),
        dxyLevel: getVal('dxy')
    };

    const prompt = `당신은 대한민국 외환 및 증시 분석 전문가입니다.
현재 시각은 KST **${kstTimeStr}**이며, 현재의 시장 세션은 **[${marketSession}]**입니다.

제공된 규칙 기반 예측 신호와 실시간 지표를 바탕으로 원/달러 환율과 코스피 지수의 1~5거래일 전망을 분석해 주세요. 

[정량 예측 모델 데이터 (QUANTITATIVE MODEL)]
${JSON.stringify(anchorSignal, null, 2)}

이 데이터는 다음을 의미합니다:
- KOSPI 상승 확률: 향후 1~5거래일 내 지수 상승 확률 (%)
- 환율 상승 확률: 향후 1~5거래일 내 환율 상승 확률 (%)
- 기술적 강도(techSignal): 과열/침체 신호

[입력 데이터 컨텍스트]
${combinedDataContext}

출력 형식은 반드시 아래 구조를 **토씨 하나 틀리지 말고 정확히** 따르세요:

🤖 달러 인베스트 AI 분석

**${kstTimeStr.split(' ')[0]}년 ${kstTimeStr.split(' ')[1]} ${kstTimeStr.split(' ')[2]} 한국 외환 및 증시 분석 보고서**

파트A: 원/달러 환율 분석
현재 원/달러 환율, 모델 상승 확률, 예상 도달 지수, 핵심 지지/저항선, 매수/매도/관망 대응 전략을 포함하여 하나의 흐름 있는 단락으로 상세히 작성하세요. 핵심 근거 2~3개는 반드시 문장 끝에 ①... ②... ③... 형태로 포함하세요.

파트B: 코스피 지수 분석
현재 코스피 지수, 모델 상승 확률, 예상 도달 지수, 핵심 지지/저항선, 매수/매도/관망 대응 전략을 포함하여 하나의 흐름 있는 단락으로 상세히 작성하세요. 핵심 근거 2~3개는 반드시 문장 끝에 ①... ②... ③... 형태로 포함하세요.

실전 투자 대응
환율: [수치 포함 60자 이내 요약]
코스피: [수치 포함 60자 이내 요약]

중요 지침:
1. 마크다운 헤더(#) 기호 사용 절대 금지.
2. 모든 분석에 지지선, 저항선 등 구체적 숫자를 반드시 포함할 것.
3. 분석 내용 중 모델을 언급할 때는 반드시 '정량예측모델'이라는 용어를 사용하세요.
4. 불렛 포인트(-)를 사용하여 항목을 나누지 말고, 파트별로 하나의 긴 문단으로 작성하세요.`;

    const data = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
    });

    let lastError = '';

    // 1. 등록된 모델 리스트 시도
    // 2026년 기준 실제 사용 가능한 모델 우선순위 목록
    // 비용 최적화를 위해 Flash-8B 모델을 1순위로 배치 (Pro/Flash 2.0/2.5 대비 월등히 저렴)
    const modelConfigs = [
        { ver: 'v1beta', model: 'gemini-2.5-flash' },
        { ver: 'v1beta', model: 'gemini-2.0-flash-exp' },
        { ver: 'v1beta', model: 'gemini-2.0-flash' },
        { ver: 'v1beta', model: 'gemini-1.5-flash' },
    ];

    for (const config of modelConfigs) {
        console.log(`🤖 AI 분석 요청 중... (${config.model} - ${config.ver})`);
        try {
            const result = await new Promise((resolve, reject) => {
                const url = `https://generativelanguage.googleapis.com/${config.ver}/models/${config.model}:generateContent?key=${GEMINI_API_KEY}`;
                const req = https.request(url, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
                    }
                }, (res) => {
                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        try {
                            const body = Buffer.concat(chunks).toString('utf8');
                            const json = JSON.parse(body);
                            if (res.statusCode === 200 && json.candidates?.[0]?.content?.parts?.[0]?.text) {
                                resolve(json.candidates[0].content.parts[0].text.trim());
                            } else {
                                reject(new Error(`[${config.model}] Status ${res.statusCode}: ${json.error?.message || JSON.stringify(json)}`));
                            }
                        } catch (e) { reject(new Error(`[${config.model}] Parse Error: ${e.message}`)); }
                    });
                });
                req.on('error', reject);
                req.write(data);
                req.end();
            });
            return result; // 성공 시 즉시 반환
        } catch (err) {
            console.warn(`⚠️ ${config.model} 실패: ${err.message}`);
            lastError += err.message + '\n';
            continue; // 다음 모델로 시도
        }
    }

    // 2. 실패 시, 동적 모델 탐색 시도
    console.log(`🤖 모든 기본 모델 실패. 사용 가능한 모델 탐색 중...`);
    try {
        const availableModels = await new Promise((resolve, reject) => {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
            https.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36' }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (res.statusCode === 200 && json.models) {
                            const validModels = json.models.filter(m => m.supportedGenerationMethods?.includes('generateContent'));
                            resolve(validModels.map(m => m.name.replace('models/', '')));
        } else {
                            resolve([]);
                        }
                    } catch (e) { resolve([]); }
                });
            }).on('error', () => resolve([]));
        });

        if (availableModels.length > 0) {
            const fallbackModel = availableModels[0];
            console.log(`💡 대체 모델 발견: ${fallbackModel}. 시도 중...`);
            const result = await new Promise((resolve, reject) => {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${GEMINI_API_KEY}`;
                const req = https.request(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
                    }
                }, (res) => {
                    const chunks = [];
                    res.on('data', chunk => chunks.push(chunk));
                    res.on('end', () => {
                        try {
                            const body = Buffer.concat(chunks).toString('utf8');
                            const json = JSON.parse(body);
                            if (res.statusCode === 200 && json.candidates?.[0]?.content?.parts?.[0]?.text) {
                                resolve(json.candidates[0].content.parts[0].text.trim());
                            } else {
                                reject(new Error(`[Dynamic-${fallbackModel}] Failed`));
                            }
                        } catch (e) { reject(e); }
                    });
                });
                req.on('error', reject);
                req.write(data);
                req.end();
            });
            return result;
        }
    } catch (err) {
        console.warn('동적 모델 탐색 실패:', err.message);
    }

    return `AI 분석 요청 실패 내역:\n${lastError.trim()}`;
}

async function sendTelegramNotification(forecast, lastUpdate) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.warn("⚠️ [Telegram] TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않아 알림을 건너뜁니다.");
        return;
    }

    // 마크다운 V2 대신 기본 마크다운 사용 (이스케이프 복잡도 감소)
    const title = forecast.sentiment === '환율 상승 우세' ? '📈 환율 상승 우세 예측' : (forecast.sentiment === '환율 하락 우세' ? '📉 환율 하락 우세 예측' : '⚖️ 환율 보합/관망 분석');
    const kTitle = (forecast.kospiSentiment || '보합') === '코스피 상승 우세' ? '📈 코스피 상승 우세 예측' : ((forecast.kospiSentiment || '보합') === '코스피 하락 우세' ? '📉 코스피 하락 우세 예측' : '⚖️ 코스피 보합/관망 분석');
    
    // AI 분석 내용 중 파트별 요약과 투자 대응 추출
    const analysisLines = forecast.aiAnalysis.split('\n');
    let fxSummary = '';
    let kSummary = '';
    let strategy = '';
    let currentPart = '';
    let captureStrategy = false;
    
    for (const line of analysisLines) {
        const trimmed = line.trim();
        if (trimmed.includes('파트A:') || trimmed.includes('[파트A:')) { currentPart = 'A'; continue; }
        if (trimmed.includes('파트B:') || trimmed.includes('[파트B:')) { currentPart = 'B'; continue; }
        
        // 투자 대응 - 헤더 문구 유연화
        if (trimmed.includes('실전 투자 대응') || trimmed.includes('실전 대응') || trimmed.includes('[실전 투자 대응]')) { 
            captureStrategy = true; 
            continue; 
        }
        
        if (captureStrategy) {
            // 리스트 항목(환율/코스피 대응) 추출
            if (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•') || (trimmed.length > 5 && (trimmed.includes('환율:') || trimmed.includes('코스피:')))) {
                strategy += trimmed + '\n';
            } else if (trimmed.length === 0 && strategy.length > 20) {
                // 이미 내용을 충분히 읽었다면 종료
                captureStrategy = false;
            } else if (trimmed.startsWith('[') && strategy.length > 0) {
                captureStrategy = false;
            }
        }

        // 요약 추출 (각 파트별 최신 문장 전체 추출) - 기준 완화 (30자 -> 15자)
        if (!captureStrategy && trimmed.length > 15 && !trimmed.startsWith('[') && !trimmed.startsWith('1)') && !trimmed.startsWith('2)')) {
            if (currentPart === 'A' && !fxSummary) fxSummary = trimmed;
            if (currentPart === 'B' && !kSummary) kSummary = trimmed;
        }
    }

    // 마크다운 V1 bold (*text*) 형식으로 변환 (Gemini는 **text** 사용)
    const formatForTelegram = (text) => text.replace(/\*\*/g, '*').trim();
    const finalStrategy = formatForTelegram(strategy);
    const finalFxSum = formatForTelegram(fxSummary);
    const finalKSum = formatForTelegram(kSummary);

    const kstOptions = { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: true };
    const analysisTime = forecast.lastAiUpdate 
        ? new Date(forecast.lastAiUpdate).toLocaleTimeString('ko-KR', kstOptions)
        : new Date().toLocaleTimeString('ko-KR', kstOptions);

    const message = `
🤖 *달러 인베스트 AI 시장 분석*

${title} / ${kTitle}

📝 *핵심 요약:*
• *환율:* ${finalFxSum || '분석 참조'}
• *코스피:* ${finalKSum || '분석 참조'}

🎯 *투자 대응 가이드:*
${finalStrategy || '사이트에서 상세 내용을 확인하세요.'}

🌐 [시장 대시보드 바로가기](https://giroklabs.github.io/exchangealert/)
⏰ 분석 시점: ${analysisTime}
    `.trim();

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const data = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    });

    return new Promise((resolve) => {
        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const isOk = res.statusCode === 200;
                if (isOk) console.log("✅ [Telegram] 알림 전송 완료");
                else console.error(`❌ [Telegram] API 응답 오류 (${res.statusCode}): ${body}`);
                resolve(isOk);
            });
        });

        req.on('error', (e) => {
            console.error("❌ [Telegram] 네트워크 에러:", e.message);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('🚀 2026년 실시간 데이터 수집 시작...');

    // API 키 누락 시 UI가 텅 비어보이지 않도록 시각적 그래프용 가상 히스토리(history) 데이터 포함
    const fallbacks = {
        'bok-rate': { value: '2.50', trend: 'neutral', history: [{ date: '2025-08', value: 2.5 }, { date: '2025-09', value: 2.5 }, { date: '2025-10', value: 2.5 }, { date: '2025-11', value: 2.5 }, { date: '2025-12', value: 2.5 }, { date: '2026-01', value: 2.5 }, { date: '2026-02', value: 2.5 }] },
        'kr-cpi': { value: '2.8', trend: 'down', history: [{ date: '2025-12', value: 3.2 }, { date: '2026-01', value: 3.1 }, { date: '2026-02', value: 2.9 }, { date: '2026-03', value: 2.8 }] },
        'kr-gdp': { value: '2.6', trend: 'up', history: [{ date: '2024Q4', value: 1.7 }, { date: '2025Q1', value: 2.0 }, { date: '2025Q2', value: 2.3 }, { date: '2026Q1', value: 2.6 }] },
        'm2-supply': { value: '4500', trend: 'up', history: [{ date: '2025-12', value: 4420 }, { date: '2026-01', value: 4480 }, { date: '2026-02', value: 4500 }] },
        'trade-balance': { value: '15200', trend: 'up', history: [{ date: '2025-12', value: 11800 }, { date: '2026-01', value: 13500 }, { date: '2026-02', value: 15200 }] },
        'kr-10y': { value: '3.45', trend: 'up', history: [{ date: '2026-03-01', value: 3.3 }, { date: '2026-03-05', value: 3.4 }, { date: '2026-03-10', value: 3.45 }] },
        'kr-2y': { value: '3.35', trend: 'up', history: [{ date: '2026-03-01', value: 3.2 }, { date: '2026-03-05', value: 3.3 }, { date: '2026-03-10', value: 3.35 }] },
        'foreigner-net-buy-market': { value: '520', trend: 'up', history: [{ date: '2026-03-10', value: -200 }, { date: '2026-03-11', value: 100 }, { date: '2026-03-12', value: 400 }, { date: '2026-03-13', value: 520 }] },
        'bamlh0a0hym2': { value: '3.10', trend: 'up', history: [{ date: '2026-03-10', value: 2.90 }, { date: '2026-03-11', value: 2.95 }, { date: '2026-03-12', value: 3.05 }, { date: '2026-03-13', value: 3.10 }] },
        'fx-reserves': { value: '4097', trend: 'neutral', history: [{ date: '202501', value: 4110 }, { date: '202502', value: 4092 }, { date: '202503', value: 4097 }] },

        'investor-deposits': { value: '555786', trend: 'up', history: [{ date: '202501', value: 555786 }, { date: '202502', value: 560529 }, { date: '202503', value: 584743 }] },
        'bok-rate': { value: '3.50', trend: 'neutral', history: [{ date: '2025-12-01', value: 3.5 }, { date: '2026-01-01', value: 3.5 }] },
        'short-debt-ratio': { value: '23.3', trend: 'up', history: [{ date: '2025Q2', value: 22.7 }, { date: '2025Q3', value: 21.9 }, { date: '2025Q4', value: 23.3 }] },
        'ted-spread': { value: '0.09', trend: 'neutral', history: [{ date: '2026-03-10', value: 0.08 }, { date: '2026-03-11', value: 0.09 }, { date: '2026-03-12', value: 0.09 }, { date: '2026-03-13', value: 0.09 }] },
        'sofr-ois': { value: '0.18', trend: 'neutral', history: [{ date: '2026-03-10', value: 0.17 }, { date: '2026-03-11', value: 0.18 }, { date: '2026-03-12', value: 0.18 }, { date: '2026-03-13', value: 0.18 }] },
        'sofr': { value: '5.31', trend: 'neutral', history: [{ date: '2026-03-10', value: 5.31 }, { date: '2026-03-11', value: 5.31 }, { date: '2026-03-12', value: 5.31 }, { date: '2026-03-13', value: 5.31 }] },
        'effr': { value: '5.33', trend: 'neutral', history: [{ date: '2026-03-10', value: 5.33 }, { date: '2026-03-11', value: 5.33 }, { date: '2026-03-12', value: 5.33 }, { date: '2026-03-13', value: 5.33 }] },
        'dtb3': { value: '5.24', trend: 'neutral', history: [{ date: '2026-03-10', value: 5.24 }, { date: '2026-03-11', value: 5.24 }, { date: '2026-03-12', value: 5.24 }, { date: '2026-03-13', value: 5.24 }] },
        // --- Phase 3 전용 폴백 ---
        'gs1': { value: '4.80', trend: 'down', history: [{ date: '2026-03-10', value: 4.90 }, { date: '2026-03-20', value: 4.80 }] },
        'GS2': { value: '4.60', trend: 'down', history: [{ date: '2026-03-10', value: 4.70 }, { date: '2026-03-20', value: 4.60 }] },
        'dfedtaru': { value: '5.50', trend: 'neutral', history: [] },
        'dfedtarl': { value: '5.25', trend: 'neutral', history: [] }
    };

    const indicators = [];
    const kisToken = await getKisAccessToken();
    const investorTrend = await fetchMarketInvestorTrend();
    
    // ⚠️ [Disabled] 현재 작동하지 않는 KIS API 들 (FID_DIV_CLS_CODE 등 에러) - 필요시 복구
    // const marketStats = kisToken ? await fetchMarketStats(kisToken) : null;
    // const samsungProvisional = kisToken ? await fetchStockProvisionalTrend(kisToken, "005930") : null;
    // const programTrading = kisToken ? await fetchProgramTrading(kisToken) : null;
    // const bondRates = kisToken ? await fetchBondRates(kisToken) : null;
    const marketStats = null;
    const samsungProvisional = null;
    const programTrading = null;
    const bondRates = null;
    const freesisDeposits = await fetchFromFreeSIS("STATSCU0100000060BO");
    const freesisCreditMargin = await fetchFromFreeSIS("STATSCU0100000070BO");
    
    // 블록별 점수 합산용 (정규화용)
    const blockScores = {
        'rates-dollar': { up: 0, down: 0 },
        'risk': { up: 0, down: 0 },
        'assets': { up: 0, down: 0 },
        'funding-policy': { up: 0, down: 0 },
        'global-indices': { up: 0, down: 0 }
    };

    const kospiScores = { up: 0, down: 0 }; // 코스피 상승요인 점수

    //  동적 상관관계 데이터 로드 (Dynamic Scoring 적용용)
    let correlations = null;
    try {
        let actualCorrPath = path.join(process.cwd(), 'dollar-investment-web', 'public', 'data', 'correlations.json');
        if (!fs.existsSync(actualCorrPath)) actualCorrPath = path.join(process.cwd(), 'public', 'data', 'correlations.json');

        if (fs.existsSync(actualCorrPath)) {
            correlations = JSON.parse(fs.readFileSync(actualCorrPath, 'utf8'));
            console.log('🔗 [Dynamic Model] correlations.json 성공적으로 로드 완료. (동적 가중치 작동중)');
        }
    } catch(e) {
        console.warn('⚠️ correlations.json 로드 실패. 기존 패턴 가중치로 롤백합니다.');
    }

    // 상관계수 가중치 매핑 유틸 함수 (다중공선성 제어 포함)
    const getCorrelationWeight = (id, target = 'usdkrw') => {
        if (!correlations) return 1.0;
        const keyMap = {
            'DXY': 'dxy', 'TNX': 'tnx', 'VIXCLS': 'vix', 'SOX': 'sox', 'DCOILWTICO': 'wti',
            'KOSPI': 'kospi'
        };
        const key = keyMap[id];
        if (key && correlations[target] && typeof correlations[target][key] === 'number') {
            const corr = correlations[target][key];
            const absCorr = Math.abs(corr);
            //  [추가] 다중공선성(Multi-collinearity) 관리: |r| > 0.8 시 가중치 절반 축소 (Pruning)
            if (absCorr > 0.8) {
                return 1.0 + (absCorr * 0.5); // 과적합 방지
            }
            return 1.0 + absCorr; // 상관계수에 비례하여 가중치 1.0x ~ 2.0x 앰플리파이
        }
        return 1.0;
    };

    //  [추가] 이전 데이터 로드하여 히스토리 연속성 확보 (야후 히스토리 누락 대응)
    let prevDashboard = null;
    try {
        const paths = [
            path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json'),
            path.join(process.cwd(), 'public', 'data', 'market-dashboard.json')
        ];
        for (const p of paths) {
            if (fs.existsSync(p)) {
                prevDashboard = JSON.parse(fs.readFileSync(p, 'utf8'));
                console.log(`📦 [History] 이전 대시보드 데이터 로드 성공 (${p})`);
                break;
            }
        }
    } catch (e) {
        console.warn('⚠️ 이전 대시보드 데이터 로드 실패:', e.message);
    }

    for (const s of FRED_SERIES) {
        //  [개선] 국제 유가(WTI)는 지연된 FRED 데이터 대신 야후 실시간(CL=F)만 사용하기 위해 FETCH 건너뜀
        let obs = (s.id === 'DCOILWTICO') ? [] : await fetchFromFred(s.fredId || s.id);

        // 실시간 데이터 가져오기 (일별 히스토리 + 실시간 현재가)
        const { observations: rawRtObs, regularPrice: rtPriceRaw, regularMarketTime } = await fetchFromYahooFinance(s.realtimeSymbol);
        
        //  [가짜 노드 제거] 야후가 보낸 오늘 날짜 데이터가 가짜 평탄선인 경우 제거
        const rtObs = (rawRtObs || []).filter((o, idx) => {
            if (o.date === todayStr) {
                // 1. 한국 지수(^KS11 등)인데 토요일/일요일 데이터가 들어오면 가짜로 간주
                const isKorean = s.realtimeSymbol.endsWith('.KS') || s.realtimeSymbol.endsWith('.KQ') || s.realtimeSymbol === '^KS11' || s.realtimeSymbol === '^KQ11';
                const day = new Date().getDay(); // 0:일, 6:토
                if (isKorean && (day === 0 || day === 6)) return false;

                // 2. [v18.0] 공식 거래 휴장일(Trading Holiday) 체크 (VIX 평행선 문제 해결)
                const region = s.realtimeSymbol ? (s.realtimeSymbol.endsWith('.KS') || s.realtimeSymbol.endsWith('.KQ') || s.realtimeSymbol === '^KS11' || s.realtimeSymbol === '^KQ11' ? 'KR' : 'US') : 'US';
                if (isTradingHoliday(o.date, region)) {
                    // console.log(`💤 [Holiday] ${s.name}의 휴장일 데이터(${o.date}, ${region}) 스킵`);
                    return false;
                }

                // 3. 오늘 시세가 어제 시세와 100% 같고, 거래 시각(regularMarketTime)이 오늘 오전 9시 이전이면 가짜로 간주
                if (idx < rawRtObs.length - 1) {
                    const prevVal = rawRtObs[idx + 1].value;
                    const todayOpeningTime = new Date();
                    todayOpeningTime.setHours(9, 0, 0, 0);
                    const isTrulyLive = regularMarketTime ? (regularMarketTime * 1000 > todayOpeningTime.getTime()) : false;
                    
                    if (o.value === prevVal && !isTrulyLive) {
                        // console.log(`♻️ [Deduplicate] ${s.name}의 가짜 실시간 노드(${o.date}) 스킵`);
                        return false;
                    }
                }
            }
            return true;
        });

        const rtPrice = (rtPriceRaw !== null && rtPriceRaw !== undefined)
            ? rtPriceRaw
            : (rtObs && rtObs.length > 0 ? parseFloat(rtObs[0].value) : null);

        
        if (s.realtimeSymbol) {
            // 만약 주 기호(realtimeSymbol)의 히스토리가 부족한 경우(예: 580039.KS), 보조 히스토리 기호(historySymbol) 사용 시도
            if (rtObs.length <= 1 && s.historySymbol) {
                console.log(`🔍 [History] ${s.name} 히스토리 부족으로 보조 기호(${s.historySymbol}) 데이터 연동 시도...`);
                const { observations: hObs } = await fetchFromYahooFinance(s.historySymbol);
                if (hObs && hObs.length > 1 && rtObs.length > 0) {
                    // 보조 기호의 과거 데이터와 주 기호의 현재가 결합
                    //  [추가] 가격 레벨 차이로 인한 그래프 왜곡 방지를 위해 히스토리 스케일링 수행
                    const currentTargetPrice = parseFloat(rtObs[0].value);
                    const currentProxyPrice = parseFloat(hObs[0].value);
                    const scaleFactor = currentProxyPrice > 0 ? currentTargetPrice / currentProxyPrice : 1.0;
                    
                    const scaledHistory = hObs
                        .filter(h => h.date < rtObs[0].date)
                        .map(h => ({
                            date: h.date,
                            value: (parseFloat(h.value) * scaleFactor).toFixed(2)
                        }));

                    obs = [rtObs[0], ...scaledHistory];
                    console.log(`⚖️ [Scale] ${s.name} 히스토리 스케일링 완료 (배율: ${scaleFactor.toFixed(2)}x)`);
                } else if (hObs.length > 1) {
                    obs = hObs;
                }
            } else if (rtObs && rtObs.length > 0) {
                const latestFredDate = obs.length > 0 ? obs[0].date : '0000-00-00';
                // 야후 데이터가 FRED보다 최신이거나 같으면 보정 (중복분 제외하고 최신치만 업데이트)
                const newerObs = rtObs.filter(r => r.date >= latestFredDate);
                
                if (newerObs.length > 0) {
                    obs = [...newerObs, ...obs.filter(o => o.date < newerObs[newerObs.length-1].date)];
                } else if (rtObs.length > 0) {
                    // [v18.0] API가 과거 데이터만 리턴할 경우(주말/공휴일 후 또는 일시적 누락)를 위해 병합
                    const existingDates = new Set(obs.map(o => o.date));
                    const toAdd = rtObs.filter(r => !existingDates.has(r.date));
                    if (toAdd.length > 0) {
                        obs = [...toAdd, ...obs].sort((a,b) => b.date.localeCompare(a.date));
                    }
                }
            }
            
            // 공통: 야후 데이터가 반영된 시점에서 소스 표기 업데이트
            if (rtObs && rtObs.length > 0) {
                s.isRealtime = true;
                s.source = 'Yahoo Finance 실시간';
                console.log(`⚡ [Realtime] ${s.name} 보정 완료 (${rtObs[0].value}) - 소스: ${s.source}`);
            } else {
                console.warn(`⚠️ [Realtime] ${s.name} 실시간 데이터 없음 - 기존 데이터 유지`);
            }
        }
        
        //  [v18.0 Persistence] Yahoo API 누락 대응: 이전 대시보드 히스토리와 강제 병합
        // 4.2 코스피 누락 사태 방지를 위해, API 결과가 불완전해도 이전 데이터를 절대 버리지 않음
        if (prevDashboard) {
            const prevInd = prevDashboard.indicators.find(i => i.id === s.id.toLowerCase());
            if (prevInd && prevInd.history && prevInd.history.length > 0) {
                const apiDates = new Set(obs.map(o => o.date));
                const day = new Date().getDay(); // 0:일, 6:토
                const isWeekend = (day === 0 || day === 6);

                const persisted = prevInd.history
                    .map(h => ({ date: h.date, value: String(h.value) }))
                    .filter(h => {
                        // 1. 이미 API 결과에 있는 날짜는 제외 (업데이트 우선)
                        if (apiDates.has(h.date)) return false;
                        
                        // 2.  [추가] 오늘이 주말인데 파일에 '오늘' 날짜가 있다면, 
                        // 이는 이전 세션의 가짜 노드일 확률이 높으므로 복구하지 않음 (한국 마켓 한정)
                        if (isWeekend && h.date === todayStr) {
                            const isKorean = s.realtimeSymbol ? (s.realtimeSymbol.endsWith('.KS') || s.realtimeSymbol.endsWith('.KQ') || s.realtimeSymbol === '^KS11' || s.realtimeSymbol === '^KQ11') : false;
                            if (isKorean) return false;
                        }
                        
                        // 3. [v18.0] 공식 거래 휴장일(Holiday) 데이터는 과거 파일에 있더라도 복구하지 않음 (오염 전파 방지)
                        const region = s.realtimeSymbol ? (s.realtimeSymbol.endsWith('.KS') || s.realtimeSymbol.endsWith('.KQ') || s.realtimeSymbol === '^KS11' || s.realtimeSymbol === '^KQ11' ? 'KR' : 'US') : 'US';
                        if (isTradingHoliday(h.date, region)) return false;

                        return true;
                    });
                
                if (persisted.length > 0) {
                    obs = [...obs, ...persisted].sort((a,b) => b.date.localeCompare(a.date));
                    console.log(`♻️ [Persistence] ${s.name} 누락 데이터 복구 완료 (${persisted.length}건 병합)`);
                }
            }
        }
        
        //  [추가] 최종적으로도 히스토리가 턱없이 부족한 경우 이전 데이터에서 히스토리 복원 (Stateful Persistence)
        if (obs.length <= 1 && prevDashboard) {
            const prevInd = prevDashboard.indicators.find(i => i.id === s.id.toLowerCase());
            if (prevInd && prevInd.history && prevInd.history.length > 0) {
                const latestDate = obs.length > 0 ? obs[0].date : '0000-00-00';
                const persisted = prevInd.history
                    .map(h => ({ date: h.date, value: String(h.value) }))
                    .filter(h => h.date < latestDate);
                
                if (persisted.length > 0) {
                    obs = [...obs, ...persisted];
                    console.log(`♻️ [History] ${s.name} 히스토리 복원 완료 (${persisted.length}건 복구)`);
                }
            }
        }

        // 야후 데이터 반영 후 오늘 날짜(todayStr) 강제 추가 로직 폐기 (실제 수집된 데이터만 사용)

        // FRED 데이터 클리닝 (특히 '.' 으로 들어오는 누락 데이터 필터링)
        const cleanedObs = obs
            .filter(o => o.value && o.value !== '.' && !isNaN(parseFloat(o.value)))
            .map(o => ({ date: o.date, value: parseFloat(o.value) }));

        //  [개선] 메인 표시값(numVal) 결정 로직: 
        // FRED 히스토리보다 실시간(rtPrice) 데이터가 있다면 이를 최우선으로 메인 가격에 반영
        let numVal = cleanedObs.length > 0 ? cleanedObs[0].value : 0;
        if (s.realtimeSymbol && rtPrice !== null && rtPrice !== undefined) {
            numVal = parseFloat(String(rtPrice));
        }

        if (cleanedObs.length === 0 && fallbacks[s.id.toLowerCase()]) {
            const fb = fallbacks[s.id.toLowerCase()];
            const history = fb.history || [];
            const displayValue = (s.realtimeSymbol && rtPrice !== null) ? String(rtPrice) : fb.value;
            if (!s.hidden) indicators.push({ ...s, id: s.id.toLowerCase(), value: displayValue, trend: fb.trend, realizedImpact: fb.trend, history });
            console.log(`⚠️ [FRED-Fallback] ${s.name} 데이터 누락으로 폴백 대체`);
            continue;
        }

        const currentPoint = cleanedObs.length > 0 ? cleanedObs[0] : { value: 0 };
        const prevVal = cleanedObs.length > 1 ? cleanedObs[1].value : numVal;
        const trend = numVal > prevVal ? 'up' : (numVal < prevVal ? 'down' : 'neutral');
        const diff = parseFloat((numVal - prevVal).toFixed(2));
        const diffPercent = prevVal !== 0 ? parseFloat(((diff / prevVal) * 100).toFixed(2)) : 0;

        //  [추가] 히스토리 데이터의 일별 단일화(Granularity) 강제 적용
        // 동일 날짜에 여러 데이터(분 단위 등)가 있으면 최신(배열 앞쪽) 것 1개만 남김
        const seenDates = new Set();
        const dailyHistory = cleanedObs.filter(o => {
            const datePart = o.date.split(',')[0].trim(); // "2026-04-03, 5:51:00 a.m." -> "2026-04-03"
            if (seenDates.has(datePart)) return false;
            seenDates.add(datePart);
            return true;
        });

        const history = dailyHistory.slice(0, 10).reverse();
        
        //  [추가] 실시간 값(Real-time)과 히스토리(History) 동기화
        // 카드 상단 헤더(Realtime)와 하단 그래프(History)의 마지막 점이 불일치하는 현상 해결
        if (s.realtimeSymbol && rtPrice !== null && rtPrice !== undefined && history.length > 0) {
            // 히스토리의 가장 마지막 요소(최신 데이터)를 실시간 값으로 업데이트
            history[history.length - 1].value = parseFloat(rtPrice.toFixed(2));
        }
        
        // --- 오늘 날짜 보장 로직 폐기 (데이터 무결성 우선) ---
        
        // --- 고도화 로직 적용 ---
        const reversedDailyHist = [...dailyHistory].reverse().map(o => o.value);
        const zScores = rollingZScore(reversedDailyHist, 252);
        const zScore = zScores.length > 0 ? zScores[zScores.length - 1] : 0;
        const freshness = getFreshnessMultiplier(s.realtimeSymbol ? 'realtime' : 'D');
        
        //  상관계수 기반 동적 가중치 산출
        const dynamicWeight = getCorrelationWeight(s.id, 'usdkrw'); // 환율용
        const kospiDynamicWeight = getCorrelationWeight(s.id, 'kospi'); // 코스피용
        
        // 변동 강도 반영 (Z-Score가 클수록 점수 가중)
        const volatilityWeight = Math.min(Math.abs(zScore), 2.0); // 최대 2배까지만
        
        // 최종 가중치 산출 시 동적 상관계수 가중치(dynamicWeight)를 곱합
        let finalWeight = (1.0 + volatilityWeight) * freshness * dynamicWeight;

        // 임계값(Threshold) 기반 특수 가중치 (FRED 지표)
        if (s.id === 'BAMLH0A0HYM2' && numVal > 4.0) finalWeight *= 1.5; // 하이일드 400bp(4.0%) 돌파 시 글로벌 위기 가중
        if (s.id === 'VIXCLS' && numVal > 30) finalWeight *= 1.3; // VIX 30 돌파 시 공포 장세 가중

        if (s.impact === 'up') {
            blockScores[s.block].up += 0.5 * finalWeight;
            if (trend === 'up') blockScores[s.block].up += 1.0 * finalWeight;
            else if (trend === 'down') blockScores[s.block].down += 1.0 * finalWeight;
        } else {
            blockScores[s.block].down += 0.5 * finalWeight;
            if (trend === 'up') blockScores[s.block].down += 1.0 * finalWeight;
            else if (trend === 'down') blockScores[s.block].up += 1.0 * finalWeight;
        }

        // KOSPI 전용 점수 반영 (동적 상관계수 가중치 사용)
        if (['DXY', 'FEDFUNDS', 'TNX', 'VIXCLS', 'BAMLH0A0HYM2'].includes(s.id)) {
            const kWeight = (1.0 + volatilityWeight) * freshness * kospiDynamicWeight;
            if (trend === 'up') kospiScores.down += 1.2 * kWeight;
            else if (trend === 'down') kospiScores.up += 0.8 * kWeight;
        }
        
        // KOSPI 직접 상관 지표 (SOX)
        if (s.id === 'SOX') {
            const kWeight = (1.0 + volatilityWeight) * freshness * kospiDynamicWeight;
            if (trend === 'up') kospiScores.up += 2.5 * kWeight; // 반도체 상승 -> 코스피 강력 상승
            else if (trend === 'down') kospiScores.down += 2.0 * kWeight;
        }

        const realizedImpact = trend === 'neutral' ? 'neutral' : 
            ((s.impact === 'up' && trend === 'up') || (s.impact === 'down' && trend === 'down') ? 'up' : 'down');

        let displayVal = numVal.toLocaleString();
        if ((s.id === 'CPIAUCSL' || s.fredId === 'CPIAUCSL') && obs.length > 12) {
            const yoy = ((numVal / parseFloat(obs[12].value)) - 1) * 100;
            displayVal = yoy.toFixed(1);
        }

        if (!s.hidden) {
            // 코스피 지수의 경우 KIS 연동 여부에 따라 소스 표기 차별화
            const finalSource = (s.id === 'KOSPI' && s.isRealtime) ? 'Yahoo Finance 실시간' : (s.source || 'FRED');
            indicators.push({ ...s, id: s.id.toLowerCase(), value: displayVal, diff, diffPercent, trend, realizedImpact, history, source: finalSource });
            const latestDate = obs.length > 0 ? obs[0].date : 'N/A';
            console.log(`✅ [FRED/RT] ${s.name}: ${displayVal} (${latestDate}, Z:${zScore.toFixed(2)}) - Source: ${finalSource}`);
        } else {
            // 히든 지표도 데이터는 보유 (계산용)
            indicators.push({ ...s, id: s.id.toLowerCase(), value: numVal, diff, diffPercent, trend, realizedImpact, history, isInternal: true });
        }
    }


    for (const item of ECOS_SERIES) {
        // 단기외채 비중은 커스텀 fetch 사용 (두 항목을 나눠서 비중 계산)
        let rows = null;
        if (item.customFetch === 'shortDebtRatio') {
            rows = await fetchShortDebtRatio();
        } else if (item.id !== 'investor-deposits') {
            // 투자자예탁금은 ECOS 대신 FreeSIS/Yahoo 데이터를 우선 사용하므로 불필요한 ECOS 호출 제외
            rows = await fetchFromEcos(item);
        }
            
        // 투자자예탁금 데이터 우선순위: 1. FreeSIS(금투협), 2. KIS 실시간 (ECOS 폴백 제거)
        if (item.id === 'investor-deposits') {
            if (freesisDeposits && freesisDeposits.length > 0) {
                rows = freesisDeposits.map(s => ({
                    TIME: s.date.replace(/-/g, ''),
                    DATA_VALUE: (s.value * 100000000).toString() 
                }));
                item.source = '금융투자협회 실시간';
                console.log(`⚡ [FreeSIS] 투자자예탁금 적용 완료 (${freesisDeposits[0].value}억원)`);
            } else if (marketStats?.deposits && marketStats.deposits.length > 0) {
                rows = marketStats.deposits.map(s => ({
                    TIME: s.date.replace(/-/g, ''),
                    DATA_VALUE: (s.value * 100000000).toString() 
                }));
                item.source = 'Yahoo Finance 실시간';
                console.log(`⚡ [KIS] 투자자예탁금 실시간 적용 완료 (${marketStats.deposits[0].value}억원)`);
            }
        }
        
        let val, trend, displayVal, history, diff, diffPercent;

        if (rows && rows.length > 0) {
            val = parseFloat(String(rows[0].DATA_VALUE).replace(/,/g, ''));

            // 단위 변환 처리
            if (item.transform === 'wonToEok') {
                // 원 → 억원 변환 (1억 = 100,000,000)
                val = Math.round(val / 100000000);
            } else if (item.transform === 'thousandUsdToEokUsd') {
                // 천달러 → 억달러 변환 (1억 = 100,000 천)
                val = Math.round(val / 100000);
            }

            const calcRes = rows.length > 1 ? (() => {
                let prevVal = parseFloat(String(rows[1].DATA_VALUE).replace(/,/g, ''));
                if (item.transform === 'wonToEok') prevVal = Math.round(prevVal / 100000000);
                else if (item.transform === 'thousandUsdToEokUsd') prevVal = Math.round(prevVal / 100000);
                const d = parseFloat((val - prevVal).toFixed(2));
                const dp = prevVal !== 0 ? parseFloat(((d / prevVal) * 100).toFixed(2)) : 0;
                return { diff: d, diffPercent: dp, trend: val > prevVal ? 'up' : (val < prevVal ? 'down' : 'neutral') };
            })() : { diff: 0, diffPercent: 0, trend: 'neutral' };
            
            diff = calcRes.diff;
            diffPercent = calcRes.diffPercent;
            trend = calcRes.trend;
            displayVal = val.toLocaleString();
            // ECOS 데이터 히스토리 매핑 및 날짜 포맷 정문화 (YYYYMMDD -> YYYY-MM-DD)
            history = rows.slice(0, 10).map(r => {
                let v = parseFloat(String(r.DATA_VALUE).replace(/,/g, ''));
                if (item.transform === 'wonToEok') v = Math.round(v / 100000000);
                else if (item.transform === 'thousandUsdToEokUsd') v = Math.round(v / 100000);
                
                let dateStr = r.TIME;
                if (dateStr.length === 8) dateStr = dateStr.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3');
                else if (dateStr.length === 6) dateStr = dateStr.replace(/(\d{4})(\d{2})/, '$1-$2');
                
                return { date: dateStr, value: v };
            }).reverse();

            // --- 강제 늘여 그리기 폐기 (수집된 데이터만 사용) ---
        } else {
            const fallback = fallbacks[item.id] || { value: '0', trend: 'neutral', history: [] };
            val = parseFloat(String(fallback.value).replace(/,/g, ''));
            trend = fallback.trend;
            displayVal = fallback.value;
            history = fallback.history;
        }

        // --- 고도화 로직 적용 ---
        let zScore = 0;
        if (rows && rows.length > 0) {
            const reversedFullHist = [...rows].reverse().map(r => {
                let v = parseFloat(String(r.DATA_VALUE).replace(/,/g, ''));
                if (item.transform === 'wonToEok') v = Math.round(v / 100000000);
                else if (item.transform === 'thousandUsdToEokUsd') v = Math.round(v / 100000);
                return v;
            });
            const zScores = rollingZScore(reversedFullHist, 252);
            zScore = zScores.length > 0 ? zScores[zScores.length - 1] : 0;
        } else if (history && history.length > 0) {
            zScore = calculateZScore(val, history);
        }
        
        const freshness = getFreshnessMultiplier(item.cycle);
        const volatilityWeight = Math.min(Math.abs(zScore), 1.5);
        let finalWeight = (1.0 + volatilityWeight) * freshness;

        // 임계값(Threshold) 기반 특수 가중치
        if (item.id === 'short-debt-ratio' && val > 25) finalWeight *= 1.3; // 단기외채 비중 25%(대외채무 대비) 돌파 시 가중
        if (item.id === 'fx-reserves' && val < 3500) finalWeight *= 1.5; // 외환보유액 3500억$ 이하 시 리스크 가중

        if (item.impact === 'up') {
            blockScores[item.block].up += 0.6 * finalWeight;
            if (trend === 'up') blockScores[item.block].up += 0.8 * finalWeight;
            else if (trend === 'down') blockScores[item.block].down += 0.8 * finalWeight;
        } else {
            blockScores[item.block].down += 0.6 * finalWeight;
            if (trend === 'up') blockScores[item.block].down += 0.8 * finalWeight;
            else if (trend === 'down') blockScores[item.block].up += 0.8 * finalWeight;
        }

        const realizedImpact = trend === 'neutral' ? 'neutral' : 
            ((item.impact === 'up' && trend === 'up') || (item.impact === 'down' && trend === 'down') ? 'up' : 'down');

        indicators.push({ ...item, value: displayVal, diff, diffPercent, trend, realizedImpact, history });
        const latestDate = history.length > 0 ? history[0].date : 'N/A';
        const statusIcon = rows && rows.length > 0 ? '✅' : '⚠️';
        const dataSource = rows && rows.length > 0 ? 'ECOS' : 'Fallback';
        console.log(`${statusIcon} [${dataSource}] ${item.name}: ${displayVal} (${latestDate}, Z:${zScore.toFixed(2)})`);
    }

    // --- 신규 Kofia/KIS 지표: 신용융자잔고 ---
    {
        let creditMarginData = null;
        let creditSource = 'FreeSIS';

        if (freesisCreditMargin && freesisCreditMargin.length > 0) {
            creditMarginData = freesisCreditMargin;
            creditSource = '금융투자협회';
            console.log(`⚡ [FreeSIS] 신용융자잔고 적용 완료 (${freesisCreditMargin[0].value}억원)`);
        } else if (marketStats?.creditMargin && marketStats.creditMargin.length > 0) {
            creditMarginData = marketStats.creditMargin;
            console.log(`⚡ [KIS] 신용융자잔고: ${marketStats.creditMargin[0].value}억원`);
        }

        if (creditMarginData) {
            const latest = creditMarginData[0].value;
            const prev = creditMarginData.length > 1 ? creditMarginData[1].value : latest;
            const diff = parseFloat((latest - prev).toFixed(2));
            const diffPercent = prev !== 0 ? parseFloat(((diff / prev) * 100).toFixed(2)) : 0;
            const trend = latest >= prev ? 'up' : 'down';
            
            // 신용융자 증가 -> 리스크 증가 (+1.5), 코스피 하락 요인 (-2.0)
            if (trend === 'up') {
                blockScores['risk'].up += 1.5;
                kospiScores.down += 2.0;
            }

            indicators.push({
                id: 'credit-margin',
                name: '신용융자잔고',
                unit: '억원',
                block: 'risk',
                impact: 'up',
                source: creditSource,
                description: '개인 부채 매수 규모, 급증 시 반대매매 리스크',
                value: latest.toLocaleString(),
                diff,
                diffPercent,
                trend,
                history: [...creditMarginData].reverse()
            });
        }
    }

    // --- 신규 KIS 지표: 프로그램 매매 ---
    if (programTrading) {
        const trend = programTrading.value >= 0 ? 'up' : 'down';
        // 비차익 순매수 -> 코스피 상승 (+3.0), 환율 하락 압력 (-1.5)
        if (programTrading.value > 0) {
            kospiScores.up += 3.0;
            blockScores['assets'].down += 1.5;
        } else if (programTrading.value < 0) {
            kospiScores.down += 2.0;
            blockScores['assets'].up += 1.0;
        }

        indicators.push({
            id: 'program-trading',
            name: '프로그램 매매(비차익)',
            unit: '억원',
            block: 'assets',
            impact: 'down',
            source: '한국투자증권 실시간',
            description: '기관/외국인의 바스켓 매매 동향, 시장의 실질적 수급 강도',
            value: programTrading.value.toLocaleString(),
            trend,
            history: programTrading.history
        });
        console.log(`⚡ [KIS] 프로그램 매매(비차익): ${programTrading.value}억원`);
    }

    // --- 신규 KIS 지표: 단기 금리 (CD) ---
    if (bondRates && bondRates.cd) {
        // CD 금리 상승 -> 원화 금리 매력 상승 -> 환율 하락 요인 (-1.0)
        blockScores['rates-dollar'].down += 1.0;

        indicators.push({
            id: 'cd-rate',
            name: 'CD 금리 (91일)',
            unit: '%',
            block: 'rates-dollar',
            impact: 'down',
            source: '한국투자증권 실시간',
            description: '시중 은행간 단기 자금 금리, 국내 유동성 지표',
            value: bondRates.cd.toFixed(2),
            trend: 'neutral',
            history: [] // 실시간 값만 사용
        });
        console.log(`⚡ [KIS] CD 금리: ${bondRates.cd}%`);
    }



    // 2.1 외국인/기관 순매도 영향권 (KIS API 연동)
    // foreignerData, institutionData 등은 이미 상단에서 kisToken을 통해 수집됨
    
    // 외국인 및 기관 수급 처리 (v7 마스터 설계 적용)
    const investorStatus = investorTrend?.status || 'Confirmed';
    const investorSubState = investorTrend?.subState;
    const investorRealtimeMsg = investorTrend?.realtimeMsg || "";

    //  [추가] 삼성전자 가집계 데이터 반영 (장중 모니터링 최적화)
    if (samsungProvisional) {
        const { foreignerQty, institutionQty, timeGb } = samsungProvisional;
        const timeMap = { '1': '09:30', '2': '11:20', '3': '13:20', '4': '14:30', '5': '15:30+' };
        const timeStr = timeMap[timeGb] || '집계중';
        
        indicators.push({
            id: 'samsung-provisional',
            name: `삼성전자 수급 가집계 (${timeStr})`,
            unit: '주',
            block: FACTOR_BLOCKS.ASSETS.id,
            impact: 'down',
            source: '삼성증권 실시간',
            description: `장중 주요 기관 수급 추정치 (현재 ${timeStr} 기준)`,
            value: `외:${(foreignerQty/10000).toFixed(1)}만 / 기:${(institutionQty/10000).toFixed(1)}만`,
            trend: (foreignerQty + institutionQty) > 0 ? 'up' : 'down',
            history: samsungProvisional.history.map(h => ({
                date: timeMap[h.timeGb] || h.timeGb,
                value: h.foreigner + h.institution
            }))
        });
        console.log(`⚡ [KIS] 삼성전자 가집계(${timeStr}): 외인 ${foreignerQty}, 기관 ${institutionQty}`);
        
        // 가집계가 강하면 코스피 점수에 가중치 부여
        if (foreignerQty > 500000) kospiScores.up += 2.0;
        else if (foreignerQty < -500000) kospiScores.down += 2.0;
    }

    //  [최종 하이브리드] 시장 전체 실시간 수급(0403) + 삼성전자 가집계(0440)
    const invStatus = investorTrend?.status || 'Confirmed';

    // 1. 시장 전체 외국인 수급 (보고서 5. 필드명 준수)
    const foreignerTrend = investorTrend?.foreigner;
    if (foreignerTrend && foreignerTrend.length > 0) {
        const latest = foreignerTrend[0].value;
        const realizedImpact = latest < 0 ? 'up' : (latest > 100 ? 'down' : 'neutral');
        
        indicators.push({
            id: 'foreigner-net-buy-market',
            name: 'KOSPI 외국인 (실시간)',
            unit: '억원',
            block: FACTOR_BLOCKS.ASSETS.id,
            impact: 'down',
            source: '삼성증권 실시간',
            status: invStatus,
            description: `KOSPI 시장 전체 외국인 실시간 누적 순매수 대금 (단위: 억원)`,
            value: (latest || 0).toLocaleString(),
            diff: parseFloat((latest - (foreignerTrend[1]?.value || latest)).toFixed(2)),
            diffPercent: (foreignerTrend[1]?.value || 0) !== 0 ? parseFloat((( (latest - foreignerTrend[1].value) / Math.abs(foreignerTrend[1].value) ) * 100).toFixed(2)) : 0,
            trend: (latest - (foreignerTrend[1]?.value || latest)) >= 0 ? 'up' : 'down',
            realizedImpact,
            history: foreignerTrend.map(d => ({ date: d.date, value: d.value })).reverse()
        });

        // 점수 반영
        if (latest > 300) kospiScores.up += 3.0;
        else if (latest < -300) kospiScores.down += 3.0;
    }

    // 2. 시장 전체 기관 수급 (세부 내역 포함)
    const institutionTrend = investorTrend?.institution;
    if (institutionTrend && institutionTrend.length > 0) {
        const latest = institutionTrend[0].value;
        const det = investorTrend.detailed;
        let detailTxt = "";
        if (det) {
            detailTxt = ` (연기금:${det.pension > 0 ? '+' : ''}${det.pension}, 투신:${det.investment > 0 ? '+' : ''}${det.investment}, 금투:${det.financial > 0 ? '+' : ''}${det.financial})`;
        }

        indicators.push({
            id: 'institution-net-buy-market',
            name: 'KOSPI 기관 (실시간)',
            unit: '억원',
            block: FACTOR_BLOCKS.ASSETS.id,
            impact: 'down',
            source: '삼성증권 실시간',
            status: invStatus,
            description: `KOSPI 시장 전체 기관 실시간 누적 순매수 대금${detailTxt}`,
            value: (latest || 0).toLocaleString(),
            diff: parseFloat((latest - (institutionTrend[1]?.value || latest)).toFixed(2)),
            diffPercent: (institutionTrend[1]?.value || 0) !== 0 ? parseFloat((( (latest - institutionTrend[1].value) / Math.abs(institutionTrend[1].value) ) * 100).toFixed(2)) : 0,
            trend: (latest - (institutionTrend[1]?.value || latest)) >= 0 ? 'up' : 'down',
            history: institutionTrend.map(d => ({ date: d.date, value: d.value })).reverse()
        });

        if (latest > 200) kospiScores.up += 2.0;
        else if (latest < -200) kospiScores.down += 2.0;
    }

    // 3. 시장 전체 개인 수급
    const individualTrend = investorTrend?.individual;
    if (individualTrend && individualTrend.length > 0) {
        const latest = individualTrend[0].value;
        indicators.push({
            id: 'individual-net-buy-market',
            name: 'KOSPI 개인 (실시간)',
            unit: '억원',
            block: FACTOR_BLOCKS.ASSETS.id,
            impact: 'down',
            source: '삼성증권 실시간',
            status: invStatus,
            description: `KOSPI 시장 전체 개인 실시간 누적 순매수 대금 (단위: 억원)`,
            value: (latest || 0).toLocaleString(),
            diff: parseFloat((latest - (individualTrend[1]?.value || latest)).toFixed(2)),
            diffPercent: (individualTrend[1]?.value || 0) !== 0 ? parseFloat((( (latest - individualTrend[1].value) / Math.abs(individualTrend[1].value) ) * 100).toFixed(2)) : 0,
            trend: (latest - (individualTrend[1]?.value || latest)) >= 0 ? 'up' : 'down',
            history: individualTrend.map(d => ({ date: d.date, value: d.value })).reverse()
        });
    }

    //  [추가] 삼성전자 가집계 데이터 반영 (v15.0 - 교차 검증용)
    if (samsungProvisional) {
        const { foreignerQty, institutionQty, timeGb, signal, signalType } = samsungProvisional;
        const timeMap = { '1': '09:30', '2': '11:20', '3': '13:20', '4': '14:30', '5': '15:30+' };
        const timeStr = timeMap[timeGb] || '집계중';
        
        indicators.push({
            id: 'samsung-provisional',
            name: `삼전 가집계 (${timeStr})`,
            unit: '주',
            block: FACTOR_BLOCKS.ASSETS.id,
            impact: 'down',
            source: '삼성증권 실시간',
            description: `삼성전자 종목별 실시간 수입/수급 가집계 신호: ${signal}`,
            value: `외:${(foreignerQty/10000).toFixed(1)}만 / 기:${(institutionQty/10000).toFixed(1)}만`,
            trend: signalType,
            realizedImpact: signalType === 'up' ? 'down' : (signalType === 'down' ? 'up' : 'neutral'),
            history: samsungProvisional.history.map(h => ({
                date: timeMap[h.timeGb] || h.timeGb,
                value: h.foreigner + h.institution
            }))
        });
    }



    // 2.2 한·미 금리차 산출 (US 10Y - KR 10Y)
    const us10y = indicators.find(i => i.id === 'tnx');
    const kr10y = indicators.find(i => i.id === 'kr-10y');

    if (us10y && kr10y) {
        const usVal = parseFloat(us10y.value);
        const krVal = parseFloat(kr10y.value);
        const diff = (usVal - krVal).toFixed(2);
        
        const prevUs = us10y.history[1]?.value || usVal;
        const prevKr = kr10y.history[1]?.value || krVal;
        const prevDiff = (prevUs - prevKr).toFixed(2);
        const trend = diff > prevDiff ? 'up' : (diff < prevDiff ? 'down' : 'neutral');

        // 금리차는 가장 핵심 지표이므로 블록 점수에 강력히 반영
        if (trend !== 'neutral') {
            trend === 'up' ? blockScores['rates-dollar'].up += 2.5 : blockScores['rates-dollar'].down += 2.5;
        } else if (parseFloat(diff) > 0.5) {
            blockScores['rates-dollar'].up += 1.0;
        }

        indicators.push({
            id: 'rate-differential',
            name: '한·미 금리차 (10Y)',
            unit: '%p',
            block: FACTOR_BLOCKS.RATES_DOLLAR.id,
            impact: 'up',
            source: '계산치',
            description: '금리차 확대 시 자본 유출 압력 가중 (환율 상승 요인)',
            value: diff,
            trend,
            realizedImpact: trend,
            history: us10y.history.map((h, idx) => {
                // 날짜 형식 통일하여 비교하되, 해당 날짜 이하인 데이터 중 가장 최신 것을 선택
                const norm = (d) => d.replace(/-/g, '');
                const targetDate = norm(h.date);
                const krH = [...kr10y.history].reverse().find(kh => norm(kh.date) <= targetDate) || kr10y.history[0];
                return { date: h.date, value: parseFloat((h.value - krH.value).toFixed(2)) };
            })
        });
        console.log(`✅ [Calc] 한미 금리차: ${diff}%p (추세: ${trend})`);
    }

    // 2.3 유동성 리스크 스프레드 산출 (TED, SOFR-OIS)
    const sofr = indicators.find(i => i.id === 'sofr');
    const effr = indicators.find(i => i.id === 'effr');
    const dtb3 = indicators.find(i => i.id === 'dtb3');

    if (sofr && dtb3 && effr) {
        const calculateSpread = (id, name, base, ref, desc) => {
            const val = parseFloat((base.value - ref.value).toFixed(3));
            let prevVal;
            if (base.history && base.history.length > 1 && ref.history && ref.history.length > 1) {
                // history는 과거->최신 순이므로 마지막이 최신, 마지막-1이 전일
                const bHistory = base.history;
                const rHistory = ref.history;
                prevVal = (bHistory[bHistory.length - 2].value - rHistory[rHistory.length - 2].value);
            } else {
                prevVal = val;
            }
            
            const diff = parseFloat((val - prevVal).toFixed(3));
            const diffPercent = prevVal !== 0 ? parseFloat(((diff / prevVal) * 100).toFixed(2)) : 0;
            const trend = val > prevVal ? 'up' : (val < prevVal ? 'down' : 'neutral');
            
            let spreadWeight = 1.0;
            if (val > 0.5) spreadWeight *= 2.0;

            blockScores['risk'].up += (trend === 'up' ? 1.5 : 0.5) * spreadWeight;
            
            indicators.push({
                id, name, unit: '%', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: '계산치',
                description: desc, value: val.toFixed(3), diff, diffPercent, trend, realizedImpact: trend,
                history: base.history.map((h, idx) => {
                    // 역순 탐색으로 가장 가까운 시점의 참조 데이터를 찾음
                    const rh = [...ref.history].reverse().find(r => r.date <= h.date) || ref.history[0];
                    return { date: h.date, value: parseFloat((h.value - rh.value).toFixed(3)) };
                })
            });
            console.log(`✅ [Calc] ${name}: ${val}% (추세: ${trend})`);
        };

        calculateSpread('ted-spread', 'TED 스프레드', sofr, dtb3, '은행간 신용 위험 (상승 시 달러 조달 경색)');
        calculateSpread('sofr-ois', 'SOFR-OIS 스프레드', sofr, effr, '금융시장 유동성 리스크 (상승 시 위험회피 강화)');
    }

    // --- [신규] 금리 인하 기대 스프레드 산출 (GS1 - EFFR: 음수=인하기대, 양수=인상/유지기대) ---
    {
        const effr = indicators.find(i => i.id === 'effr');
        const gs1 = indicators.find(i => i.id === 'gs1' && i.isInternal);
        const dfedtaru = indicators.find(i => i.id === 'dfedtaru' && i.isInternal);
        const dfedtarl = indicators.find(i => i.id === 'dfedtarl' && i.isInternal);

        if (effr && gs1 && dfedtaru && dfedtarl) {
            const effrVal = parseFloat(String(effr.value).replace(/,/g, ''));
            const gs1Val = parseFloat(String(gs1.value).replace(/,/g, ''));
            const upperBound = parseFloat(String(dfedtaru.value).replace(/,/g, ''));
            const lowerBound = parseFloat(String(dfedtarl.value).replace(/,/g, ''));
            const targetMid = (upperBound + lowerBound) / 2;
            
            // 스프레드 산출: 타겟 중간값 - 시장금리 (양수 = 인하 기대, 음수 = 인상 기대)
            const cutExpectation = parseFloat((targetMid - gs1Val).toFixed(3)); 
            const cutsCount = (cutExpectation / 0.25).toFixed(1); // 25bp 단위 횟수

            // 금리 인하 기대가 강하면 (+0.6% 이상 혹은 2회 이상 인하 기대) 코스피 상승 요인
            if (cutExpectation > 0.5) {
                kospiScores.up += cutExpectation * 4; 
                console.log(`📉 [금리기대] 인하 기대: ${cutsCount}회 (${cutExpectation}%p) → 코스피 상승 압력 +${(cutExpectation*4).toFixed(1)}`);
            } else if (cutExpectation < -0.3) {
                // 금리 인상 기대 → 코스피 하락 압력
                kospiScores.down += Math.abs(cutExpectation) * 3;
                console.log(`📈 [금리기대] 인상 기대: ${Math.abs(cutsCount)}회 (${cutExpectation}%p) → 코스피 하락 압력 -${(Math.abs(cutExpectation)*3).toFixed(1)}`);
            } else {
                console.log(`➡️ [금리기대] 시장 기대: ${cutsCount}회 인하/인상 (${cutExpectation}%p) → 중립 (동결 기대)`);
            }

            // Fed 목표 범위와 실제 EFFR 비교 (하단에 가까울수록 dovish)
            const targetGap = parseFloat((effrVal - targetMid).toFixed(3));
            if (Math.abs(targetGap) > 0.05) {
                console.log(`⚖️ [금리기대] EFFR vs 목표 중앙(${targetMid}%): 괴리 ${targetGap}%`);
            }

            // 히스토리 산출 (TargetMid - GS1)
            const spreadHistory = gs1.history.map(h => {
                // 과거 타겟 상하단 찾기 (역순 탐색)
                const uh = [...dfedtaru.history].reverse().find(u => u.date <= h.date) || dfedtaru.history[0];
                const lh = [...dfedtarl.history].reverse().find(l => l.date <= h.date) || dfedtarl.history[0];
                const tm = (uh.value + lh.value) / 2;
                return { date: h.date, value: parseFloat((tm - h.value).toFixed(3)) };
            });

            // 금리 기대 지표 대시보드 추가
            indicators.push({
                id: 'rate-cut-expectation',
                name: '금리 인하 기대 횟수',
                unit: '회',
                block: FACTOR_BLOCKS.RATES_DOLLAR.id,
                impact: 'up',
                source: 'FRED(Target-GS1)',
                description: '연내 기준금리 인하/인상 기대 횟수 (25bp)',
                value: cutsCount,
                trend: cutExpectation > 0 ? 'up' : 'down',
                realizedImpact: cutExpectation > 0.3 ? 'up' : (cutExpectation < -0.2 ? 'down' : 'neutral'),
                history: spreadHistory
            });
            console.log(`✅ [Calc] 금리인하 기대: ${cutExpectation}%p`);
        }
    }

    // --- [신규] WTI → 코스피 직접 연결 (에너지 비용 → 기업이익 영향) ---
    {
        const wti = indicators.find(i => i.id === 'dcoilwtico');
        if (wti) {
            const wtiTrend = wti.trend;
            const wtiVal = parseFloat(String(wti.value).replace(/,/g, ''));
            // 유가 상승 → 수입 비용 증가 → 기업이익 압박 → 코스피 하락 요인
            if (wtiTrend === 'up') {
                const wtiWeight = wtiVal > 90 ? 1.5 : 1.0; // $90 초과 시 추가 가중
                kospiScores.down += 1.2 * wtiWeight;
                console.log(`🛢️ [WTI→KOSPI] 유가 상승(${wtiVal}$) → 코스피 하락 압력 -${(1.2*wtiWeight).toFixed(1)}`);
            } else {
                console.log(`🛢️ [WTI→KOSPI] 유가 보합(${wtiVal}$) → 영향 중립`);
            }
        }
    }

    // --- [신규] 파생상품 만기 변동성 감지 ---
    {
        const expiryInfo = getKospi200ExpiryInfo(new Date());
        if (expiryInfo.isExpiryWeek) {
            const label = expiryInfo.isQuarterly ? '분기 선물 만기' : '월간 옵션 만기';
            const volatilityBoost = expiryInfo.isQuarterly ? 2.5 : 1.5;
            // 만기 주간: 양방향 변동성 확대 → 기존 방향에 가중치 (방향 자체는 기존 모멘텀 따름)
            if (kospiScores.up > kospiScores.down) {
                kospiScores.up += volatilityBoost;
            } else {
                kospiScores.down += volatilityBoost;
            }
            console.log(`📅 [만기주간] ${label} D-${expiryInfo.daysToExpiry} (${expiryInfo.isQuarterly ? '분기' : '월간'}) → 변동성 가중치 +${volatilityBoost}`);
        }
    }

    // --- 최종 점수 정규화 및 블록 간 밸런싱 ---
    let upScore = 0;
    let downScore = 0;

    Object.keys(blockScores).forEach(blockId => {
        const b = blockScores[blockId];
        const blockTotal = b.up + b.down;
        
        // 블록 내 점수가 너무 크면 감쇠 적용 (중복 계산 및 다중공선성 방지)
        // 로그 스케일을 활용해 지표가 많아져도 점수가 무한히 커지지 않게 함
        const dampenedUp = b.up > 0 ? Math.log1p(b.up) * 5 : 0;
        const dampenedDown = b.down > 0 ? Math.log1p(b.down) * 5 : 0;
        
        upScore += dampenedUp;
        downScore += dampenedDown;
        // 📊 [Score Breakdown] 각 블록의 상세 기여도 출력 (디버깅 투명성 확보)
        console.log(`📊 [Block Score] ${blockId.padEnd(15)} | Up: ${dampenedUp.toFixed(1).padStart(4)} | Down: ${dampenedDown.toFixed(1).padStart(4)} | Contribution: ${((dampenedUp + dampenedDown) / 1).toFixed(1)}`);
    });

    //  [추가] 비선형 상호작용 항 (Non-linear Interactions) 및 Regime 스위칭
    // 금리/달러 상승(Rates Up)과 시장 공포(Risk Up)가 동시 발생 시 변동성 증폭 
    const ratesUp = blockScores['rates-dollar']?.up || 0;
    const riskUp = blockScores['risk']?.up || 0;
    
    // 단순 변동성이 아닌 실제 시장 레짐(Regime) 파악
    const vixTarget = indicators.find(i => i.id === 'vixcls');
    const bamlTarget = indicators.find(i => i.id === 'bamlh0a0hym2');
    const isHighVolRegime = (vixTarget && parseFloat(String(vixTarget.value)) > 25) || (bamlTarget && parseFloat(String(bamlTarget.value)) > 4.0);

    if (ratesUp > 0 && riskUp > 0) {
        // High Volatility 레짐일 때만 상호작용(Interaction) 항을 강하게 반영하고, Normal엔 축소하여 과적합/노이즈 방지
        const regimeMultiplier = isHighVolRegime ? 1.0 : 0.2; 
        const interactionWeight = Math.min((ratesUp * riskUp * 0.05 * regimeMultiplier), 5.0); // 가중치 최대 +5점
        upScore += interactionWeight;
        console.log(`🔥 [Interaction] 금리 상승 + 리스크 오프 폭발적 시너지 (${isHighVolRegime ? '위기 레짐' : '평시 레짐'}): 변동성 압력 +${interactionWeight.toFixed(1)}점 우대`);
    }

    // --- 5단계: 복합 신호 적용 (블록 점수 최종 적용 후) ---
    const compoundSignals = detectCompoundSignals(indicators);
    if (compoundSignals.length > 0) {
        compoundSignals.forEach(sig => {
            if (sig.up > 0) {
                blockScores[sig.block].up += sig.up;
                upScore += Math.log1p(sig.up) * 3; // 로그 감쇠 적용
            }
            if (sig.down > 0) {
                blockScores[sig.block].down += sig.down;
                downScore += Math.log1p(sig.down) * 3;
            }
            console.log(`⚡ [Compound] ${sig.type}: up+${sig.up}/down+${sig.down} → ${sig.desc}`);
        });
    } else {
        console.log(`⚡ [Compound] 활성 복합 신호 없음`);
    }

    // --- 4단계: 백테스팅 통계 로드 ---
    let backtest = null;
    let predHist = null;
    try {
        const predHistPath = path.join(__dirname, '..', 'public', 'data', 'prediction-history.json');
        const altPath = path.join(process.cwd(), 'public', 'data', 'prediction-history.json');
        const predFile = fs.existsSync(predHistPath) ? predHistPath : (fs.existsSync(altPath) ? altPath : null);
        if (predFile) {
            predHist = JSON.parse(fs.readFileSync(predFile, 'utf8'));
            backtest = calcBacktestSummary(predHist.records || []);
            if (backtest) {
                console.log(`📈 [Backtest Summary] 총 ${backtest.total}일 | 적중률 ${backtest.hitRate}% | 최근5일 ${backtest.recentHitRate}% | ${backtest.streak}`);
                
                // 🔍 [추가] 최근 3일간의 상세 적중 내역 출력
                const recentLogs = (predHist.records || []).slice(-3).reverse();
                recentLogs.forEach(r => {
                    const resultEmoji = r.hit_d1 ? '✅ Hit' : '❌ Miss';
                    const predDir = (r.predicted?.d1_up > 50) ? '상승' : '하락';
                    const actualDir = r.actual_next_close > r.rateAtPrediction ? '상승' : '하락';
                    if (r.actual_next_close) {
                        console.log(`   └ [${r.date}] 예측: ${predDir}(${r.predicted?.d1_up}%) | 실제: ${actualDir} (${r.rateAtPrediction}→${r.actual_next_close}) | 결과: ${resultEmoji}`);
                    }
                });
            }
        }
    } catch (btErr) {
        console.warn('⚠️ 백테스팅 통계 로드 실패 (비치명적):', btErr.message);
    }

    // 노이즈 점수 (극단적 쏠림 방지)
    let upScoreFinal = upScore + 0.5;
    let downScoreFinal = downScore + 0.5;

    const total = upScoreFinal + downScoreFinal;
    const upProb = Math.round((upScoreFinal / total) * 100);
    const downProb = 100 - upProb;

    // --- KOSPI 점수 정규화 및 확률 산출 ---
    const kUp = kospiScores.up > 0 ? Math.log1p(kospiScores.up) * 8 : 0;
    const kDown = kospiScores.down > 0 ? Math.log1p(kospiScores.down) * 8 : 0;
    const kTotal = kUp + kDown;
    const rawKospiUpProb = kTotal > 0 ? Math.round((kUp / kTotal) * 100) : 50;
    
    // --- 고도화 로직: KOSPI Score EMA 평활화 ---
    let kospiUpProb = rawKospiUpProb;
    if (predHist && predHist.records) {
        const pastKospiProbs = predHist.records
            .filter(r => r.predicted && r.predicted.kospi_predicted_up !== undefined)
            .map(r => r.predicted.kospi_predicted_up);
        if (pastKospiProbs.length > 0) {
            const probSeries = [...pastKospiProbs, rawKospiUpProb].slice(-5); // 최근 5일치로 3일 EMA 산출
            const emaProbs = calculateEMA(probSeries, 3);
            let finalEmaProb = Math.round(emaProbs[emaProbs.length - 1]);
            
            //  [Lag 완화] 원시 확률(Raw)과 EMA 간 괴리가 15% 이상 크게 벌어지면 (급격한 추세 전환/역재 발생)
            // EMA의 지연(Lag) 리스크가 더 크다고 판단하여 실시간 Raw 점수 방향으로 가중 평균을 둡니다.
            if (Math.abs(rawKospiUpProb - finalEmaProb) >= 15) {
                finalEmaProb = Math.round((rawKospiUpProb * 0.6) + (finalEmaProb * 0.4));
                console.log(`⚠️ [EMA-Lag 방어] Raw(${rawKospiUpProb}%)와 EMA(${Math.round(emaProbs[emaProbs.length - 1])}%) 괴리 발생 → Raw 가중치 상승반영(${finalEmaProb}%)`);
            } else {
                console.log(`📊 [KOSPI Smoothing] Raw Prob: ${rawKospiUpProb}% -> EMA(3) Prob: ${finalEmaProb}%`);
            }
            kospiUpProb = finalEmaProb;
        }
    }

    const kospiDownProb = 100 - kospiUpProb;
    console.log(`📊 [KOSPI Score] Up:${kUp.toFixed(1)}, Down:${kDown.toFixed(1)} → Smoothed Up Prob: ${kospiUpProb}%`);

    console.log('🤖 AI 시장 분석 생성 중...');

    const { observations: usdKrwHistory } = await fetchFromYahooFinance('USDKRW=X');

    // --- 코스피 히스토리 자동 수집 (KIS API 우선, Yahoo Finance 폴백) ---
    try {
        console.log('📈 코스피(KOSPI) 히스토리 수집 중...');
        const kospiHistPath = path.join(__dirname, '..', 'public', 'data', 'kospi-history-6m.json');
        fs.mkdirSync(path.dirname(kospiHistPath), { recursive: true });
        let kospiHistorySaved = false;

        // ⚠️ [Disabled] KIS API 코스피 조회 실패 대응 - Yahoo Finance 폴백으로 일원화
        /*
        if (kisToken) {
            try {
                console.log('  → KIS API로 코스피 일봉 조회 시도...');
                const endDate = todayStr.replace(/-/g, '');
                const startDate = (() => {
                    const d = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }));
                    d.setMonth(d.getMonth() - 6);
                    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).replace(/-/g, '');
                })();

// v13 Stable: kisRequest 통합 호출 (9443 -> 443 자동우회)
                const kisData = await kisRequest("GET", "/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice", {
                    "tr_id": "FHKUP03500100",
                    "custtype": "P",
                    "authorization": `Bearer ${kisToken}`
                }, {
                    FID_COND_MRKT_DIV_CODE: "U",
                    FID_INPUT_ISCD: "0001",
                    FID_INPUT_DATE_1: startDate,
                    FID_INPUT_DATE_2: endDate,
                    FID_PERIOD_DIV_CODE: "D"
                });

                if (kisData.output2 && kisData.output2.length > 0) {
                    const kHistory = kisData.output2
                        .filter(d => d.stck_bsop_date && d.bstp_nmix_prpr)
                        .map(d => ({
                            date: d.stck_bsop_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                            open: parseFloat(d.bstp_nmix_oprc) || 0,
                            high: parseFloat(d.bstp_nmix_hgpr) || 0,
                            low: parseFloat(d.bstp_nmix_lwpr) || 0,
                            close: parseFloat(d.bstp_nmix_prpr) || 0,
                            volume: parseInt(d.acml_vol) || 0
                        }))
                        .sort((a, b) => b.date.localeCompare(a.date));

                    if (kHistory.length > 0) {
                        const kospiIdx = indicators.findIndex(i => i.id === 'kospi');
                        if (kospiIdx !== -1) {
                            const latestKVal = kHistory[0].close;
                            indicators[kospiIdx].value = latestKVal.toLocaleString();
                            indicators[kospiIdx].source = '한국투자증권 실시간'; // 통일된 소스 명칭 사용
                            indicators[kospiIdx].history = kHistory.map(h => ({ date: h.date, value: h.close })).slice(0, 15).reverse();
                            console.log(`✅ [KIS] KOSPI 지수 동기화 완료: ${latestKVal}pt`);
                        }
                        
                        // MA60(60일선) 예측을 위한 히스토리는 최소 60~65일 이상 필요함
                        // KIS API가 제한(예: 50일)에 걸릴 경우 히스토리는 Yahoo 폴백을 활용
                        if (kHistory.length >= 65) {
                            fs.writeFileSync(kospiHistPath, JSON.stringify({
                                symbol: 'KOSPI', name: '코스피', source: 'KIS',
                                lastUpdate: new Date().toISOString(), data: kHistory
                            }, null, 2));
                            console.log(`  ✅ KIS API 코스피 히스토리 저장 완료 (${kHistory.length}일치, 최신: ${kHistory[0]?.date} → ${kHistory[0]?.close}pt)`);
                            kospiHistorySaved = true; // 통과
                        } else {
                            console.log(`  ⚠️ KIS 데이터 부족: ${kHistory.length}일치. 기술적지표(MA60) 계산을 위해 Yahoo Finance 폴백 연동 개시`);
                            // kospiHistorySaved를 false로 남겨두어 아래 백업 로직이 가동되게 함.
                        }
                    }
                } else {
                    console.log('  ⚠️ KIS API 응답에 코스피 데이터 없음, Yahoo Finance 폴백 시도...');
                }
            } catch (kisErr) {
                console.warn('  ⚠️ KIS API 코스피 조회 실패:', kisErr.message, '→ Yahoo Finance 폴백');
            }
        }
        */

        // 2순위: Yahoo Finance (KIS 실패 시 폴백)
        if (!kospiHistorySaved) {
            console.log('  → Yahoo Finance 폴백으로 코스피 히스토리 수집...');
            const kospiUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?range=6mo&interval=1d';
            const kospiRaw = await new Promise((resolve, reject) => {
                const req = https.get(kospiUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                    timeout: 10000
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
                    });
                });
                req.on('error', reject);
                req.on('timeout', () => { req.destroy(); reject(new Error('Yahoo Finance 타임아웃')); });
            });
            if (kospiRaw.chart?.result?.[0]) {
                const kResult = kospiRaw.chart.result[0];
                const kTimestamps = kResult.timestamp;
                const kQuotes = kResult.indicators.quote[0];
                const kHistoryMap = new Map();
                const day = new Date().getDay(); // 0:일, 6:토
                const isWeekend = (day === 0 || day === 6);

                kTimestamps.forEach((ts, i) => {
                    const date = new Date(ts * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
                    
                    //  [추가] 야후가 보낸 데이터 중 주말(토/일) 데이터가 '오늘' 날짜인 경우 제외
                    if (isWeekend && date === todayStr) return;

                    if (kQuotes.high[i] !== null && kQuotes.low[i] !== null && kQuotes.close[i] !== null) {
                        kHistoryMap.set(date, {
                            date,
                            open: parseFloat(kQuotes.open[i]?.toFixed(2) || '0'),
                            high: parseFloat(kQuotes.high[i].toFixed(2)),
                            low: parseFloat(kQuotes.low[i].toFixed(2)),
                            close: parseFloat(kQuotes.close[i].toFixed(2)),
                            volume: kQuotes.volume[i] || 0
                        });
                    }
                });
                const kHistory = Array.from(kHistoryMap.values()).sort((a, b) => b.date.localeCompare(a.date));
                
                // [v18.0 Persistence] 기존 파일 데이터 로드 및 병합
                let finalKHistory = kHistory;
                if (fs.existsSync(kospiHistPath)) {
                    try {
                        const existing = JSON.parse(fs.readFileSync(kospiHistPath, 'utf8')).data || [];
                        const apiDates = new Set(kHistory.map(h => h.date));
                        const missing = existing.filter(h => !apiDates.has(h.date));
                        finalKHistory = [...kHistory, ...missing].sort((a,b) => b.date.localeCompare(a.date));
                    } catch(e) { console.warn('⚠️ 기존 코스피 히스토리 파싱 실패:', e.message); }
                }

                fs.writeFileSync(kospiHistPath, JSON.stringify({
                    symbol: '^KS11', name: 'KOSPI', source: 'Yahoo',
                    lastUpdate: new Date().toISOString(), data: finalKHistory
                }, null, 2));
                console.log(`  ✅ Yahoo Finance 코스피 히스토리 저장 완료 (${finalKHistory.length}일치, 누락복구 포함)`);
            }
        }
    } catch (kospiHistErr) {
        console.warn('⚠️ 코스피 히스토리 수집 실패 (비치명적):', kospiHistErr.message);
    }

    // --- 기술적 지표 계산 (fx-history-6m.json 활용) ---
    let technicals = null;
    try {
        const fxHistPath = path.join(__dirname, '..', 'public', 'data', 'fx-history-6m.json');
        const altFxHistPath = path.join(process.cwd(), 'public', 'data', 'fx-history-6m.json');
        const fxHistFile = fs.existsSync(fxHistPath) ? fxHistPath : (fs.existsSync(altFxHistPath) ? altFxHistPath : null);
        if (fxHistFile) {
            const fxHist = JSON.parse(fs.readFileSync(fxHistFile, 'utf8'));
            const closes = fxHist.data.map(d => d.close); // 최신→과거 순
            const rsi14    = calculateRSI(closes);
            const ma5      = calculateMA(closes, 5);
            const ma20     = calculateMA(closes, 20);
            const ma60     = calculateMA(closes, 60);
            const bb       = calculateBB(closes, 20);
            const momentum = calculateMomentum(closes);
            const levels   = detectKeyLevels(fxHist.data);
            const macd     = calculateMACD(closes);
            const stochastic = calculateStochastic(fxHist.data, 14);
            technicals = { rsi14, ma5, ma20, ma60, bb, momentum, keyLevels: levels, macd, stochastic, compoundSignals };
            console.log(`📐 [Tech] RSI14=${rsi14}, MA5=${ma5}, MA20=${ma20}, MA60=${ma60}`);
            console.log(`📐 [Tech] MACD=${macd?.hist}, Stochastic=%K ${stochastic?.k}%`);
            console.log(`📐 [Tech] BB(상단=${bb?.upper}, 하단=${bb?.lower}), 지지=${levels.support}, 저항=${levels.resistance}`);
            console.log(`📐 [Tech] 모멘텀: 1일=${momentum.d1}%, 5일=${momentum.d5}%, 20일=${momentum.d20}%`);
        }
    } catch (techErr) {
        console.warn('⚠️ 기술적 지표 계산 실패 (비치명적):', techErr.message);
    }

    // --- 코스피 기술적 지표 계산 (kospi-history-6m.json 활용) ---
    let kospiTechnicals = null;
    try {
        const kospiHistPath = path.join(__dirname, '..', 'public', 'data', 'kospi-history-6m.json');
        const altKospiHistPath = path.join(process.cwd(), 'public', 'data', 'kospi-history-6m.json');
        const kospiHistFile = fs.existsSync(kospiHistPath) ? kospiHistPath : (fs.existsSync(altKospiHistPath) ? altKospiHistPath : null);
        if (kospiHistFile) {
            const kospiHist = JSON.parse(fs.readFileSync(kospiHistFile, 'utf8'));
            const kCloses = kospiHist.data.map(d => d.close); // 최신→과거 순
            const kRsi14    = calculateRSI(kCloses);
            const kMa5      = calculateMA(kCloses, 5);
            const kMa20     = calculateMA(kCloses, 20);
            const kMa60     = calculateMA(kCloses, 60);
            const kBb       = calculateBB(kCloses, 20);
            const kMomentum = calculateMomentum(kCloses);
            const kLevels   = detectKeyLevels(kospiHist.data);
            const kMacd     = calculateMACD(kCloses);
            const kStochastic = calculateStochastic(kospiHist.data, 14);
            kospiTechnicals = { rsi14: kRsi14, ma5: kMa5, ma20: kMa20, ma60: kMa60, bb: kBb, momentum: kMomentum, keyLevels: kLevels, macd: kMacd, stochastic: kStochastic };
            console.log(`📐 [KOSPI Tech] RSI14=${kRsi14}, MA5=${kMa5}, MA20=${kMa20}, MA60=${kMa60}`);
            console.log(`📐 [KOSPI Tech] MACD=${kMacd?.hist}, Stochastic=%K ${kStochastic?.k}%`);
            console.log(`📐 [KOSPI Tech] BB(상단=${kBb?.upper}, 하단=${kBb?.lower}), 지지=${kLevels.support}, 저항=${kLevels.resistance}`);
            console.log(`📐 [KOSPI Tech] 모멘텀: 1일=${kMomentum.d1}%, 5일=${kMomentum.d5}%, 20일=${kMomentum.d20}%`);
        } else {
            console.log('📐 [KOSPI Tech] kospi-history-6m.json 파일 없음 (fetch-kospi-history.js 실행 필요)');
        }
    } catch (kospiTechErr) {
        console.warn('⚠️ 코스피 기술적 지표 계산 실패 (비치명적):', kospiTechErr.message);
    }


    let aiAnalysis = "";
    let lastAiUpdate = null;
    let sentiment = '보합';
    let kospiSentiment = '보합';

    // --- [신규] 시장 시간대별 지능형 AI 분석 스케줄링 ---
    const getMinInterval = () => {
        const now = new Date();
        const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // KST (UTC+9)
        const day = kstDate.getUTCDay(); // 0(일)-6(토)
        const hour = kstDate.getUTCHours();
        const minute = kstDate.getUTCMinutes();
        const timeVal = hour + minute / 60;

        // 1. 토요일: 전면 중단
        if (day === 6) return -1; 

        // 2. 일요일: 23:00 정기 알림 1회만 허용 (월요일 개장 준비)
        // 60분 간격으로 설정하여 23:00~23:59 사이에 단 한 번만 실행되도록 보장
        if (day === 0) return (hour === 23) ? 60 : -1;

        // 3. 평일 (월-금)
        // 02:00 ~ 07:30: 휴지기 (중단)
        if (timeVal >= 2 && timeVal < 7.5) return -1;

        // 22:00 ~ 02:00: 글로벌 시장 (2시간 간격)
        if (hour >= 22 || hour < 2) return 115; 

        // 07:30 ~ 22:00: 활성 시장 (1시간 간격: 07:30 ~ 16:00, 16:00 ~ 22:00)
        return 55;
    };

    let shouldSkipAi = process.env.SKIP_AI_ANALYSIS === 'true';
    const minInterval = getMinInterval();

    if (minInterval === -1 && !shouldSkipAi) {
        console.log(`💤 KST ${new Date(new Date().getTime() + (9 * 60 * 60 * 1000)).getUTCHours()}시: AI 분석 휴지기입니다.`);
        shouldSkipAi = true;
    }
    
    // 휴지기 상태라도 기존에 남은 정상적인 과거 분석 내용이 있다면 초기화하지 않고 유지
    try {
        const paths = [
            path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json'),
            path.join(__dirname, '..', '..', 'data', 'market-dashboard.json'),
            path.join(process.cwd(), 'public', 'data', 'market-dashboard.json'),
            path.join(process.cwd(), 'data', 'market-dashboard.json')
        ];
        
        let prevData = null;
        for (const p of paths) {
            if (fs.existsSync(p)) {
                prevData = JSON.parse(fs.readFileSync(p, 'utf8'));
                break;
            }
        }

        if (prevData && prevData.forecast) {
            const lastAiTime = prevData.forecast.lastAiUpdate || 0;
            const diffMin = (Date.now() - lastAiTime) / (1000 * 60);
            const prevAiAnalysis = prevData.forecast.aiAnalysis || prevData.forecast.detailedAnalysis || "";
            
            // 이전 분석 결과가 오류 메시지라면 즉시 재시도
            const isErrorMessage = prevAiAnalysis.includes("API 키가 설정되지 않아") || prevAiAnalysis.includes("분석 요청 실패");

            if (isErrorMessage) {
                console.log(`🔄 이전 분석 오류가 감지되어 (휴지기 여부 무관하게) 재분석을 시도합니다.`);
                shouldSkipAi = false;
            } else if (shouldSkipAi) {
                // 이미 스킵하기로 결정된 상태(휴지기, SKIP env)면 기존 텍스트 및 점수 그대로 복구
                aiAnalysis = prevAiAnalysis;
                sentiment = prevData.forecast.sentiment || "보통";
                kospiSentiment = prevData.forecast.kospiSentiment || "보합";
                lastAiUpdate = lastAiTime; 
            } else {
                // 활성 시간대라면 설정된 주기 충족 여부 체크
                const isTooSoon = minInterval > 0 && diffMin < minInterval;

                if (isTooSoon) {
                    console.log(`⏱️ 마지막 AI 분석 이후 ${Math.round(diffMin)}분 경과. (설정 간격 ${minInterval}분 미달로 기존 정보 유지)`);
                    aiAnalysis = prevAiAnalysis;
                    sentiment = prevData.forecast.sentiment || "보통";
                    kospiSentiment = prevData.forecast.kospiSentiment || "보합";
                    lastAiUpdate = lastAiTime; 
                    shouldSkipAi = true;
                }
            }
        }
    } catch (e) {
        console.warn('⚠️ 이전 분석 데이터 로드 실패 (기본값 사용됨):', e.message);
    }

    if (shouldSkipAi && !aiAnalysis) {
        console.log('⏭️ SKIP_AI_ANALYSIS 설정에 의해 AI 분석을 건너뜁니다. (비용 절감)');
        aiAnalysis = "실시간 지표 업데이트 중입니다. 상세 분석은 정기 리포트(1시간 주기)에서 확인 가능합니다. 결론: 관망 우세";
        lastAiUpdate = 0;
    } else if (!shouldSkipAi) {
        // AI 분석은 모든 데이터 수집 후 하단에서 실행하기 위해 이곳에서 제거
    }

    // 마크다운 기호 및 깨진 글자 세밀하게 제거 (단, ** 강조와 [헤더]는 유지하여 프론트엔드에서 활용)
    aiAnalysis = aiAnalysis
        .replace(/###|##|#/g, '') // 헤더 기호 제거 (#, ##, ###)
        .replace(/(?<!\*)\*(?!\*)/g, '') // 단일 별표(*)만 제거 (기울임 방지, ** 강조 유지)
        .replace(/\uFFFD/g, '') // 유니코드 대체 문자 확실히 제거
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // 제어 문자 제거
        .replace(/[“”]/g, '"') // 특수 따옴표 ASCII로 변경
        .replace(/[‘’]/g, "'") // 특수 작은 따옴표 ASCII로 변경
        .replace(/—|–/g, '-') // 특수 대시 ASCII로 변경
        .trim();

    // --- [결합] 방향성 판정 로직 (AI 정성 분석 최우선) ---
    sentiment = '보합';
    kospiSentiment = '보합';

    // 1. 환율(FX) 방향성 추출 (- 환율: ... 결론: 상승 우세)
    const fxPattern = /-\s*환율[:\s].*\(결론:\s*(상승|하락|보합|강세|약세)/i;
    const fxMatch = aiAnalysis.match(fxPattern);
    if (fxMatch) {
        const res = fxMatch[1];
        if (res === '상승' || res === '강세') sentiment = '환율 상승 우세';
        else if (res === '하락' || res === '약세') sentiment = '환율 하락 우세';
    } else {
        // Fallback: 기존 확률 기반
        sentiment = upProb > 55 ? '환율 상승 우세' : (downProb > 55 ? '환율 하락 우세' : '보합');
    }

    // 2. 코스피(KOSPI) 방향성 추출 (- 코스피: ... 결론: 하락 우세)
    const kospiPattern = /-\s*코스피[:\s].*\(결론:\s*(상승|하락|보합|강세|약세)/i;
    const kospiMatch = aiAnalysis.match(kospiPattern);
    if (kospiMatch) {
        const res = kospiMatch[1];
        if (res === '상승' || res === '강세') kospiSentiment = '코스피 상승 우세';
        else if (res === '하락' || res === '약세') kospiSentiment = '코스피 하락 우세';
    } else {
        // Fallback: 기존 확률 기반
        kospiSentiment = kospiUpProb > 55 ? '코스피 상승 우세' : (kospiDownProb > 55 ? '코스피 하락 우세' : '보합');
    }

    console.log(`📊 [Sentiment Sync] 환율: ${sentiment} | 코스피: ${kospiSentiment} (AI 정성 분석 결론 기준)`);

    // 3. 주요국 환율 정보 (환율알라미 앱 데이터 - Naver/Hana Bank)
    const majorRates = [];
    const MAJOR_CURRENCIES_MAP = {
        'USD': { id: 'usd-krw', name: '미국 달러', unit: '원', flag: '🇺🇸' },
        'JPY': { id: 'jpy-krw', name: '일본 엔 (100엔)', unit: '원', flag: '🇯🇵', is100Yen: true },
        'EUR': { id: 'eur-krw', name: '유럽 유로', unit: '원', flag: '🇪🇺' },
        'CNY': { id: 'cny-krw', name: '중국 위안', unit: '원', flag: '🇨🇳' }
    };

    console.log('💱 주요국 환율 수집 중 (Local App Data)...');
    try {
        const currentDataPath = path.join(__dirname, '..', '..', 'data', 'exchange-rates.json');
        const currentRates = JSON.parse(fs.readFileSync(currentDataPath, 'utf8'));

        // 전일 데이터 로드 (변동량 계산용)
        const yesterdayRaw = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }));
        yesterdayRaw.setDate(yesterdayRaw.getDate() - 1);
        const yDateStr = yesterdayRaw.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const yesterdayDataPath = path.join(__dirname, '..', '..', 'data', 'daily', `exchange-rates-${yDateStr}.json`);

        let yesterdayRates = [];
        if (fs.existsSync(yesterdayDataPath)) {
            yesterdayRates = JSON.parse(fs.readFileSync(yesterdayDataPath, 'utf8'));
        } else {
            // 어제가 없으면 그저께 시도 (주말 등 대비)
            yesterdayRaw.setDate(yesterdayRaw.getDate() - 1);
            const yDateStr2 = yesterdayRaw.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
            const yesterdayDataPath2 = path.join(__dirname, '..', '..', 'data', 'daily', `exchange-rates-${yDateStr2}.json`);
            if (fs.existsSync(yesterdayDataPath2)) {
                yesterdayRates = JSON.parse(fs.readFileSync(yesterdayDataPath2, 'utf8'));
            }
        }

        for (const [curUnit, config] of Object.entries(MAJOR_CURRENCIES_MAP)) {
            const currentItem = currentRates.find(r => r.cur_unit === curUnit);
            if (currentItem) {
                const currentValStr = currentItem.deal_bas_r.replace(/,/g, '');
                const currentVal = parseFloat(currentValStr);

                const yesterdayItem = yesterdayRates.find(r => r.cur_unit === curUnit);
                const prevVal = yesterdayItem ? parseFloat(yesterdayItem.deal_bas_r.replace(/,/g, '')) : currentVal;

                const change = currentVal - prevVal;
                const changePercent = (prevVal > 0) ? (change / prevVal) * 100 : 0;
                const trend = change > 0 ? 'up' : (change < 0 ? 'down' : 'neutral');

                majorRates.push({
                    ...config,
                    value: currentVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    change: (change > 0 ? '+' : '') + change.toFixed(2),
                    changePercent: (change > 0 ? '+' : '') + changePercent.toFixed(2),
                    trend
                });
                console.log(`✅ [Exchange] ${config.name}: ${currentVal}`);
            }
        }
    } catch (err) {
        console.warn(`⚠️ 앱 데이터 수집 실패: ${err.message}`);
    }

    // 4. 주요 주식 시세 정보 (자산 스플릿 자동화용) - KIS API 활용
    const trackedStocks = [
        { id: 'samsung', symbol: '005930', market: 'domestic', name: '삼성전자', enName: 'Samsung Electronics' },
        { id: 'hynix', symbol: '000660', market: 'domestic', name: 'SK하이닉스', enName: 'SK Hynix' },
        { id: 'hyundai', symbol: '005380', market: 'domestic', name: '현대차', enName: 'Hyundai Motor' },
        { id: 'kia', symbol: '000270', market: 'domestic', name: '기아', enName: 'Kia' },
        { id: 'naver', symbol: '035420', market: 'domestic', name: '네이버', enName: 'NAVER' },
        { id: 'kakao', symbol: '035720', market: 'domestic', name: '카카오', enName: 'Kakao' },
        { id: 'apple', symbol: 'AAPL', market: 'overseas', excd: 'NAS', name: '애플', enName: 'Apple' },
        { id: 'tesla', symbol: 'TSLA', market: 'overseas', excd: 'NAS', name: '테슬라', enName: 'Tesla' },
        { id: 'nvidia', symbol: 'NVDA', market: 'overseas', excd: 'NAS', name: '엔비디아', enName: 'NVIDIA' },
        { id: 'microsoft', symbol: 'MSFT', market: 'overseas', excd: 'NAS', name: '마이크로소프트', enName: 'Microsoft' },
        { id: 'google', symbol: 'GOOGL', market: 'overseas', excd: 'NAS', name: '구글', enName: 'Google' },
        { id: 'amazon', symbol: 'AMZN', market: 'overseas', excd: 'NAS', name: '아마존', enName: 'Amazon' },
        { id: 'qqq', symbol: 'QQQ', market: 'overseas', excd: 'NAS', name: 'QQQ', enName: 'Invesco QQQ Trust' },
        { id: 'spy', symbol: 'SPY', market: 'overseas', excd: 'NYS', name: 'SPY', enName: 'SPDR S&P 500 ETF' },
        { id: 'schd', symbol: 'SCHD', market: 'overseas', excd: 'NYS', name: 'SCHD', enName: 'Schwab US Dividend Equity ETF' }
    ];

    const stockPrices = [];


    if (kisToken) {
        console.log('📈 주요 주식 시세 수집 중 (KIS API)...');
        for (const stock of trackedStocks) {
            try {
                let kisData = null;
                if (stock.market === 'domestic') {
                    kisData = await fetchDomesticStockFromKIS(stock.symbol, kisToken);
                } else {
                    kisData = await fetchOverseasStockFromKIS(stock.excd, stock.symbol, kisToken);
                }

                if (kisData) {
                    stockPrices.push({
                        ...stock,
                        price: kisData.price,
                        changePercent: (kisData.changePercent >= 0 ? '+' : '') + kisData.changePercent,
                        trend: kisData.trend
                    });
                    console.log(`✅ [KIS] ${stock.name}: ${kisData.price}`);
                }

                // 초당 요청 제한(TPS) 방지를 위한 넉넉한 지연 (200ms)
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (e) {
                console.warn(`⚠️ KIS 주식 시세 수집 실패 (${stock.symbol}):`, e.message);
            }
        }
    } else {
        // KIS 실패 시 Yahoo FinanceFallback 시도 (기존 로직)
        console.log('📈 KIS 토큰 없음. Yahoo Finance로 대체 수집 중...');
        const yahooFallbackStocks = trackedStocks.map(s => ({
            ...s,
            symbol: s.market === 'domestic' ? `${s.symbol}.KS` : s.symbol
        }));

        for (const stock of yahooFallbackStocks) {
            try {
                const { observations: history } = await fetchFromYahooFinance(stock.symbol);
                if (history && history.length > 0) {
                    const currentVal = parseFloat(history[0].value);
                    const prevVal = history.length > 1 ? parseFloat(history[1].value) : currentVal;
                    const change = currentVal - prevVal;
                    const changePercent = (change / prevVal * 100).toFixed(2);

                    stockPrices.push({
                        ...stock,
                        price: currentVal,
                        changePercent: (change >= 0 ? '+' : '') + changePercent,
                        trend: change >= 0 ? 'up' : 'down'
                    });
                    console.log(`✅ [Fallback-Yahoo] ${stock.name}: ${currentVal}`);
                }
            } catch (e) {
                console.warn(`⚠️ Yahoo 주식 시세 수집 실패 (${stock.symbol}):`, e.message);
            }
        }
    }

    // --- 2단계: 타임프레임별 예측 확률 계산 ---
    // d1(1일): 기술적 지표 70% + 실시간 거시 30%
    // d5(5일): 기술적 30% + 거시 70%
    // d20(20일): 기술적 10% + ECOS 거시 90%
    let timeframes = null;
    try {
        const ratesBlock = blockScores['rates-dollar'];
        const riskBlock  = blockScores['risk'];
        const assetsBlock = blockScores['assets'];
        const fundBlock  = blockScores['funding-policy'];

        // 기술적 점수: 초단기 지표(MACD, Stochastic) 가중 추가
        let techUp = 0, techDown = 0;
        if (technicals) {
            const { rsi14, momentum, macd, stochastic } = technicals;
            if (rsi14 !== null) {
                if (rsi14 > 60) techUp += (rsi14 - 50) / 50;
                else if (rsi14 < 40) techDown += (50 - rsi14) / 50;
            }
            if (momentum?.d5 !== null) {
                if (momentum.d5 > 0) techUp += Math.abs(momentum.d5) * 0.5;
                else techDown += Math.abs(momentum.d5) * 0.5;
            }
            // MACD 히스토그램 반영 (초단기 추세강도)
            if (macd?.hist !== undefined && macd.hist !== null) {
                if (macd.hist > 0) techUp += Math.abs(macd.hist) * 2.0; 
                else techDown += Math.abs(macd.hist) * 2.0;
            }
            // Stochastic %K 반영 (과매도 반전 매수, 과매수 반전 매도)
            if (stochastic?.k !== undefined && stochastic.k !== null) {
                if (stochastic.k < 20) techUp += ((20 - stochastic.k) / 20) * 1.5; // 침체권 바닥 지지 반등
                else if (stochastic.k > 80) techDown += ((stochastic.k - 80) / 20) * 1.5; // 과열권 천장 저항 하락
            }
        }
        const macroUp   = (Math.log1p(ratesBlock.up + riskBlock.up) + Math.log1p(assetsBlock.up)) * 3;
        const macroDown = (Math.log1p(ratesBlock.down + riskBlock.down) + Math.log1p(assetsBlock.down)) * 3;
        const ecosUp    = Math.log1p(fundBlock.up) * 5;
        const ecosDown  = Math.log1p(fundBlock.down) * 5;

        const calcProb = (tU, tD, mU, mD, eU, eD, w) => {
            const u = tU * w.tech + mU * w.macro + eU * w.ecos + 0.3;
            const d = tD * w.tech + mD * w.macro + eD * w.ecos + 0.3;
            return { upProb: Math.round((u / (u + d)) * 100), downProb: Math.round((d / (u + d)) * 100) };
        };

        timeframes = {
            d1:  { ...calcProb(techUp, techDown, macroUp, macroDown, ecosUp, ecosDown, { tech: 0.85, macro: 0.15, ecos: 0.0 }), basis: '초단기 기술적지표(MACD/Stoch)+실시간거시강조' },
            d5:  { ...calcProb(techUp, techDown, macroUp, macroDown, ecosUp, ecosDown, { tech: 0.4, macro: 0.6, ecos: 0.0 }), basis: '모멘텀+수급·달러사이클중심' },
            d20: { ...calcProb(techUp, techDown, macroUp, macroDown, ecosUp, ecosDown, { tech: 0.1, macro: 0.45, ecos: 0.45 }), basis: 'ECOS+경상·외환중심' }
        };
        console.log(`📊 [Timeframe] 1일: 상승${timeframes.d1.upProb}% | 5일: 상승${timeframes.d5.upProb}% | 20일: 상승${timeframes.d20.upProb}%`);
    } catch (tfErr) {
        console.warn('⚠️ 타임프레임 예측 계산 실패 (비치명적):', tfErr.message);
    }
    // --- [단계 추가] AI 심층 분석 (모든 데이터 수집 후 실행) ---
    if (!shouldSkipAi) {
        console.log('🤖 Gemini AI 심층 분석 시작...');
        let kospiHistoryForAi = [];
        try {
            const kospiHistPath = path.join(__dirname, '..', 'public', 'data', 'kospi-history-6m.json');
            if (fs.existsSync(kospiHistPath)) {
                const kh = JSON.parse(fs.readFileSync(kospiHistPath, 'utf8'));
                kospiHistoryForAi = kh.data || [];
            }
        } catch (e) {}

        // --- 1순위 파생 지표 연산 (Market Core Drivers) ---
        const additionalMetrics = { spread_2y: 'N/A', dxy_d5: 'N/A', sox_d5: 'N/A', nq_d5: 'N/A' };
        try {
            const getIndVal = (id) => { const ind = indicators.find(i => i.id.toLowerCase() === id.toLowerCase()); return ind && ind.value !== null ? parseFloat(ind.value) : null; };
            const getIndHist = (id) => { const ind = indicators.find(i => i.id.toLowerCase() === id.toLowerCase()); return ind && ind.history ? ind.history.map(h => parseFloat(h.value)) : []; };

            const gs2 = getIndVal('GS2');
            const kr2y = getIndVal('kr-2y');
            if (gs2 !== null && kr2y !== null) {
                additionalMetrics.spread_2y = (gs2 - kr2y).toFixed(2);
            }

            const getD5 = (id) => {
                const closes = getIndHist(id);
                if (closes.length >= 6) return (((closes[0] - closes[5]) / closes[5]) * 100).toFixed(2);
                if (closes.length > 1) return (((closes[0] - closes[closes.length-1]) / closes[closes.length-1]) * 100).toFixed(2);
                return 'N/A';
            };
            additionalMetrics.dxy_d5 = getD5('DXY');
            additionalMetrics.sox_d5 = getD5('SOX');
            additionalMetrics.nq_d5  = getD5('nasdaq-futures');
        } catch (err) {
            console.warn('⚠️ Market Core Drivers 계산 실패:', err.message);
        }

        aiAnalysis = await fetchAiAnalysis(indicators, usdKrwHistory, technicals, backtest, kospiTechnicals, upProb, downProb, kospiUpProb, kospiDownProb, kospiHistoryForAi, correlations, majorRates, additionalMetrics);
        lastAiUpdate = Date.now();

        // 마크다운 기호 및 깨진 글자 세밀하게 제거
        aiAnalysis = aiAnalysis
            .replace(/###|##|#/g, '')
            .replace(/(?<!\*)\*(?!\*)/g, '')
            .replace(/\uFFFD/g, '')
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/—|–/g, '-')
            .trim();

        // 방향성 판정 리프레시
        const fxPattern = /-\s*환율[:\s].*\(결론:\s*(상승|하락|보합|강세|약세)/i;
        const fxMatch = aiAnalysis.match(fxPattern);
        if (fxMatch) {
            const res = fxMatch[1];
            if (res === '상승' || res === '강세') sentiment = '환율 상승 우세';
            else if (res === '하락' || res === '약세') sentiment = '환율 하락 우세';
        }
    }

    const dashboardData = {
        indicators,
        majorRates,
        stockPrices,
        forecast: {
            sentiment,
            kospiSentiment,
            upProb, downProb,
            kospiUpProb, kospiDownProb,
            timeframes,
            aiAnalysis,
            detailedAnalysis: aiAnalysis, // 하위 호환성 위해 유지
            lastAiUpdate: lastAiUpdate || Date.now(),
            score: { upScore, downScore, kospiUpScore: kUp, kospiDownScore: kDown }
        },
        technicals: technicals ? { ...technicals, compoundSignals } : null,
        kospiTechnicals: kospiTechnicals || null,
        kospiSentiment,
        backtest,
        lastUpdate: new Date().toLocaleString('ko-KR')
    };

    const outputPath = path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2), 'utf8');
    console.log('✨ AI 분석 및 주식 시세 포함 데이터 업데이트 완료!');

    // --- 3단계: 예측 이력 저장 (prediction-history.json) ---
    try {
        const predHistPath = path.join(__dirname, '..', 'public', 'data', 'prediction-history.json');
        let predHist = { records: [] };
        if (fs.existsSync(predHistPath)) {
            predHist = JSON.parse(fs.readFileSync(predHistPath, 'utf8'));
        }
        const todayStrHist = todayStr;
        const currentRate = closes => closes && closes.length > 0 ? closes[0] : null;

        // 전일 레코드에 실제 종가 채우기 (환율 + 코스피)
        const prevRecord = predHist.records.find(r => r.date !== todayStr && r.actual_next_close === null);
        if (prevRecord) {
            const fxHistFile2 = fs.existsSync(path.join(__dirname, '..', 'public', 'data', 'fx-history-6m.json'))
                ? path.join(__dirname, '..', 'public', 'data', 'fx-history-6m.json')
                : path.join(process.cwd(), 'public', 'data', 'fx-history-6m.json');
            if (fs.existsSync(fxHistFile2)) {
                const fxH = JSON.parse(fs.readFileSync(fxHistFile2, 'utf8'));
                const todayClose = fxH.data[0]?.close || null;
                if (todayClose) {
                    prevRecord.actual_next_close = todayClose;
                    const predicted_up = prevRecord.predicted?.d1_up > 50;
                    const actual_up = todayClose > prevRecord.rateAtPrediction;
                    prevRecord.hit_d1 = predicted_up === actual_up;
                    console.log(`📈 [PredHist] 전일 적중률 업데이트: ${prevRecord.date} → hit_d1=${prevRecord.hit_d1}`);
                }
            }

            // 코스피 적중률 업데이트
            const kospiHistFile2 = fs.existsSync(path.join(__dirname, '..', 'public', 'data', 'kospi-history-6m.json'))
                ? path.join(__dirname, '..', 'public', 'data', 'kospi-history-6m.json')
                : path.join(process.cwd(), 'public', 'data', 'kospi-history-6m.json');
            if (prevRecord.kospi_predicted_up !== null && prevRecord.kospi_predicted_up !== undefined && fs.existsSync(kospiHistFile2)) {
                const kospiH = JSON.parse(fs.readFileSync(kospiHistFile2, 'utf8'));
                const todayKospiClose = kospiH.data[0]?.close || null;
                if (todayKospiClose && prevRecord.kospiAtPrediction) {
                    prevRecord.kospi_actual_next_close = todayKospiClose;
                    const kospi_pred_up = prevRecord.kospi_predicted_up > 50;
                    const kospi_actual_up = todayKospiClose > prevRecord.kospiAtPrediction;
                    prevRecord.kospi_hit_d1 = kospi_pred_up === kospi_actual_up;
                    console.log(`📊 [PredHist] 코스피 적중률 업데이트: ${prevRecord.date} → kospi_hit_d1=${prevRecord.kospi_hit_d1}`);
                }
            }
        }

        // 코스피 현재 지수 저장
        const kospiHistFile3 = fs.existsSync(path.join(__dirname, '..', 'public', 'data', 'kospi-history-6m.json'))
            ? path.join(__dirname, '..', 'public', 'data', 'kospi-history-6m.json')
            : path.join(process.cwd(), 'public', 'data', 'kospi-history-6m.json');
        const todayKospi = fs.existsSync(kospiHistFile3)
            ? JSON.parse(fs.readFileSync(kospiHistFile3, 'utf8')).data[0]?.close
            : null;

        const dayPred = new Date().getDay();
        const isWeekendPred = (dayPred === 0 || dayPred === 6);

        // 오늘 레코드 추가 (이미 없으면 & 주말이 아니면)
        if (!isWeekendPred && !predHist.records.find(r => r.date === todayStr)) {
            predHist.records.push({
                date: todayStr,
                predicted: {
                    d1_up: timeframes?.d1?.upProb || upProb,
                    d5_up: timeframes?.d5?.upProb || upProb,
                    d20_up: timeframes?.d20?.upProb || upProb,
                    overall_up: upProb
                },
                actual_next_close: null,
                hit_d1: null,
                rateAtPrediction: todayRate,
                kospi_predicted_up: kospiUpProb,
                kospi_actual_next_close: null,
                kospi_hit_d1: null,
                kospiAtPrediction: todayKospi,
                aiAnalysis: aiAnalysis || null
            });
        }
        // 최대 90일치만 보관
        predHist.records = predHist.records.slice(-90);
        fs.writeFileSync(predHistPath, JSON.stringify(predHist, null, 2), 'utf8');
        console.log(`✅ [PredHist] 예측 이력 저장 완료 (총 ${predHist.records.length}건)`);
    } catch (phErr) {
        console.warn('⚠️ 예측 이력 저장 실패 (비치명적):', phErr.message);
    }

    // 5. 텔레그램 알림 발송 (새로운 분석이 수행된 경우)
    if (!shouldSkipAi && aiAnalysis && !aiAnalysis.includes('분석 요청 실패')) {
        await sendTelegramNotification(dashboardData.forecast, dashboardData.lastUpdate);
    }
}
main();
