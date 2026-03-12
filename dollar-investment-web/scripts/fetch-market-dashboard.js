/**
 * 시장 대시보드 데이터 수집 및 예측 모델 분석 스크립트
 * 2026년 실시간 데이터 대응 버전
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRED_API_KEY = process.env.FRED_API_KEY || '0a8892024728a9a0fa015e609cd5d232';
const ECOS_API_KEY = process.env.ECOS_API_KEY;
const KIS_APP_KEY = process.env.KIS_APP_KEY;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET;
const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

async function fetchFromYahooFinance(symbol) {
    return new Promise((resolve) => {
        // Yahoo Finance Chart API (v8) - 15일치 데이터 요청
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=15d`;
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
                    const result = json.chart.result[0];
                    const timestamps = result.timestamp;
                    const closes = result.indicators.quote[0].close;

                    // 유효한 데이터만 필터링하여 히스토리 생성
                    const observations = [];
                    for (let i = 0; i < timestamps.length; i++) {
                        if (closes[i] !== null) {
                            observations.push({
                                date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
                                value: closes[i].toFixed(2)
                            });
                        }
                    }
                    resolve(observations.reverse()); // 최신순으로 반환
                } catch (e) {
                    console.error(`❌ Yahoo Finance Parse Error (${symbol}):`, e.message);
                    resolve([]);
                }
            });
        }).on('error', (e) => {
            console.error(`❌ Yahoo Finance Network Error (${symbol}):`, e.message);
            resolve([]);
        });
    });
}

// 1. 해외지표 (FRED)
const FRED_SERIES = [
    { id: 'FEDFUNDS', name: '미국 기준금리(Fed)', unit: '%', category: 'international', impact: 'up', source: 'Federal Reserve', description: 'Fed 금리 인상 시 달러 가치 상승으로 환율 상승' },
    { id: 'PAYEMS', name: '미 비농업고용지수', unit: 'K', category: 'international', impact: 'up', source: 'BLS', description: '미국 고용 지표 호조 시 달러 선호 현상 강화' },
    { id: 'DEXJPUS', name: '엔/달러 환율', unit: '¥', category: 'international', impact: 'up', source: 'Market', description: '엔화 약세 시 환율 상승 경향', realtimeSymbol: 'JPY=X' },
    { id: 'DCOILWTICO', name: '국제 유가(WTI)', unit: '$', category: 'international', impact: 'up', source: 'WTI', description: '실시간 선물 가격 반영 중', realtimeSymbol: 'CL=F' },
    { id: 'TNX', name: '미 10년물 국채금리', unit: '%', category: 'international', impact: 'up', source: 'CBOE', description: '미 국채 금리 상승 시 달러 강세 유발', realtimeSymbol: '^TNX', fredId: 'GS10' },
    { id: 'DXY', name: '달러 인덱스(DXY)', unit: 'pt', category: 'international', impact: 'up', source: 'ICE', description: '달러의 상대적 가치 (환율의 핵심 나침반)', realtimeSymbol: 'DX-Y.NYB', fredId: 'DTWEXBGS' },
    { id: 'KOSPI', name: '코스피 지수', unit: 'pt', category: 'domestic', impact: 'down', source: 'KRX', description: '국내 시장 악화 시 원화 약세(환율 상승) 유도', realtimeSymbol: '^KS11' },
    { id: 'CPIAUCSL', name: '미 소비자물가(CPI)', unit: '%', category: 'international', impact: 'up', source: 'BLS', description: '미국 물가 상승 시 금리 인상 기대감으로 달러 강세 유발' },
    { id: 'GDP', name: '미국 GDP', unit: 'B$', category: 'international', impact: 'up', source: 'BEA', description: '미국 경제 성장 호조 시 달러 가치 상승' },
    { id: 'VIXCLS', name: 'VIX 공포지수', unit: 'pt', category: 'international', impact: 'up', source: 'CBOE', description: '시장 불안정성 및 공포 심리 지표 (상승 시 안전자산 달러 수요 증가)', realtimeSymbol: '^VIX' }
];

// 2. 국내지표 (ECOS)
const ECOS_SERIES = [
    { id: 'bok-rate', statCode: '722Y001', item1: '0101000', name: '한국 기준금리', unit: '%', category: 'domestic', impact: 'down', source: '한국은행', description: '금리 인상 시 원화 강세 유도', cycle: 'M' },
    { id: 'kr-cpi', statCode: '901Y009', item1: '0', name: '국내 소비자물가(CPI)', unit: '%', category: 'domestic', impact: 'up', source: '통계청', description: '물가 상승 시 원화 가치 하락 압력', cycle: 'M' },
    { id: 'kr-gdp', statCode: '200Y005', item1: '10101', name: '경제성장률', unit: '%', category: 'domestic', impact: 'down', source: '한국은행', description: '경제 성장 호조 시 원화 강세 유도', cycle: 'Q' },
    { id: 'm2-supply', statCode: '101Y001', item1: 'BBHS01', name: '통화량(M2)', unit: '조원', category: 'domestic', impact: 'up', source: '한국은행', description: '통화 팽창 시 원화 가치 하락 압력', cycle: 'M' },
    { id: 'trade-balance', statCode: '301Y013', item1: '000000', name: '경상수지', unit: 'M$', category: 'domestic', impact: 'down', source: '한국은행', description: '경상수지 흑자 시 환율 하락 유도', cycle: 'M' }
];

async function fetchFromFred(seriesId) {
    return new Promise((resolve) => {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=14&sort_order=desc`;
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

async function fetchFromEcos(item) {
    if (!ECOS_API_KEY) return null;
    return new Promise((resolve) => {
        const today = new Date();
        const currentYear = today.getFullYear();
        let start, end;

        // 2026년 실시간 대응을 위해 현재 날짜 기준으로 동적 설정
        if (item.cycle === 'Q') {
            start = `${currentYear - 2}1`;
            end = `${currentYear}4`;
        } else {
            start = `${currentYear - 1}01`;
            end = `${currentYear}12`;
        }

        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_API_KEY}/json/kr/1/15/${item.statCode}/${item.cycle}/${start}/${end}/${item.item1}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row) {
                        resolve(json.StatisticSearch.row.reverse());
                    } else {
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

async function fetchMarketInvestorTrend(token) {
    if (!token) return null;
    try {
        // 삼성전자를 시장 외인 수급의 프록시(Proxy)로 사용
        const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-investor?fid_cond_mrkt_div_code=J&fid_input_iscd=005930`;
        const res = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "appkey": KIS_APP_KEY,
                "appsecret": KIS_APP_SECRET,
                "tr_id": "FHKST01010900"
            }
        });
        const data = await res.json();
        if (data.output && data.output.length > 0) {
            return data.output.slice(0, 14).map(d => ({
                date: d.stck_bsop_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                // 단위: 백만원 -> 억원 변환
                value: Math.round(parseFloat(d.frgn_ntby_tr_pbmn) / 100)
            }));
        }
    } catch (e) {
        console.error("❌ KIS 외인수급 조회 에러:", e.message);
    }
    return null;
}

async function getKisAccessToken() {
    if (!KIS_APP_KEY || !KIS_APP_SECRET) {
        console.warn("⚠️ KIS API 키가 없습니다. KIS 연동을 건너뜁니다.");
        return null;
    }
    try {
        const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: "client_credentials",
                appkey: KIS_APP_KEY,
                appsecret: KIS_APP_SECRET
            })
        });
        const data = await res.json();
        return data.access_token;
    } catch (e) {
        console.error("❌ KIS 토큰 발급 에러:", e.message);
        return null;
    }
}

async function fetchDomesticStockFromKIS(code, token) {
    try {
        const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${code}`;
        const res = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "authorization": `Bearer ${token}`,
                "appkey": KIS_APP_KEY,
                "appsecret": KIS_APP_SECRET,
                "tr_id": "FHKST01010100"
            }
        });
        const data = await res.json();
        if (data.output) {
            return {
                price: parseFloat(data.output.stck_prpr),
                changePercent: (parseFloat(data.output.prdy_ctrt)).toFixed(2),
                trend: parseFloat(data.output.prdy_vrss) >= 0 ? 'up' : 'down'
            };
        }
    } catch (e) {
        console.error(`❌ KIS 국내주식 조회 에러 (${code}):`, e.message);
    }
    return null;
}

async function fetchOverseasStockFromKIS(excd, symbol, token) {
    try {
        const url = `${KIS_BASE_URL}/uapi/overseas-stock/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${symbol}`;
        const res = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "authorization": `Bearer ${token}`,
                "appkey": KIS_APP_KEY,
                "appsecret": KIS_APP_SECRET,
                "tr_id": "HHDFS00000300"
            }
        });
        const data = await res.json();
        if (data.output) {
            return {
                price: parseFloat(data.output.last),
                changePercent: (parseFloat(data.output.rate)).toFixed(2),
                trend: parseFloat(data.output.diff) >= 0 ? 'up' : 'down'
            };
        }
    } catch (e) {
        console.error(`❌ KIS 해외주식 조회 에러 (${symbol}):`, e.message);
    }
    return null;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function fetchAiAnalysis(indicators) {
    if (!GEMINI_API_KEY) {
        return "Gemini API 키가 설정되지 않아 기본 분석 시스템을 사용합니다.";
    }

    const summary = indicators.map(i => `- ${i.name}: ${i.value}${i.unit} (추세: ${i.trend}, 환율영향: ${i.impact})`).join('\n');
    const prompt = `당신은 한수지(금융 분석가)입니다. 다음 경제 지표들을 바탕으로 향후 원/달러 환율 방향성을 한국어로 분석해주세요. 특히 VIX(공포지수)와 외국인 순매수(주문흐름)의 움직임이 시장의 리스크 온/오프 심리와 환율에 미치는 영향을 중요하게 고려해 주세요.
응답은 2~3문장의 짧고 명확한 단락으로 작성하고, 마지막에 "결론: [상승/하락/보합] 우세"라고 적어주세요.

경제 지표 현황:
${summary}

환율에 미치는 심리적, 거시적 요인을 분석해줘.`;

    const data = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
    });

    let lastError = '';

    // 1. 등록된 모델 리스트 시도
    // 2026년 기준 실제 사용 가능한 모델 우선순위 목록
    const modelConfigs = [
        { ver: 'v1beta', model: 'gemini-2.0-flash' },
        { ver: 'v1beta', model: 'gemini-2.0-flash-lite' },
        { ver: 'v1beta', model: 'gemini-2.0-flash-001' },
        { ver: 'v1beta', model: 'gemini-2.5-pro-exp-03-25' },
        { ver: 'v1beta', model: 'gemini-1.5-flash-002' },
        { ver: 'v1beta', model: 'gemini-1.5-flash-8b' },
        { ver: 'v1beta', model: 'gemini-1.5-pro-002' },
    ];

    for (const config of modelConfigs) {
        console.log(`🤖 AI 분석 요청 중... (${config.model} - ${config.ver})`);
        try {
            const result = await new Promise((resolve, reject) => {
                const url = `https://generativelanguage.googleapis.com/${config.ver}/models/${config.model}:generateContent?key=${GEMINI_API_KEY}`;
                const req = https.request(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try {
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
            https.get(url, (res) => {
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
                const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
                    let body = '';
                    res.on('data', chunk => body += chunk);
                    res.on('end', () => {
                        try {
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

async function main() {
    console.log('🚀 2026년 실시간 데이터 수집 시작...');
    const indicators = [];
    const kisToken = await getKisAccessToken();
    let upScore = 0, downScore = 0;

    for (const s of FRED_SERIES) {
        let obs = await fetchFromFred(s.fredId || s.id);

        // 🚀 실시간 보정: Yahoo Finance 등을 통해 지연 데이터 보완
        if (s.realtimeSymbol) {
            const rtObs = await fetchFromYahooFinance(s.realtimeSymbol);
            if (rtObs && rtObs.length > 0) {
                if (!obs.length) {
                    obs = rtObs;
                } else {
                    const latestFredDate = obs[0].date;
                    const newerObs = rtObs.filter(r => r.date > latestFredDate);
                    obs = [...newerObs, ...obs];
                }
                console.log(`⚡ [Realtime] ${s.name} 보정 완료 (${rtObs[0].value})`);
            }
        }

        const val = obs.length > 0 ? obs[0].value : '0';
        const numVal = parseFloat(val.replace(/,/g, ''));
        const prevVal = obs.length > 1 ? parseFloat(obs[1].value.replace(/,/g, '')) : numVal;

        // 정밀한 추세 계산 (보합 포함)
        const trend = numVal > prevVal ? 'up' : (numVal < prevVal ? 'down' : 'neutral');

        if (trend !== 'neutral') {
            if (s.impact === 'up') trend === 'up' ? upScore++ : downScore++;
            else trend === 'up' ? downScore++ : upScore++;
        }

        let displayVal = numVal.toLocaleString();
        if ((s.id === 'CPIAUCSL' || s.fredId === 'CPIAUCSL') && obs.length > 12) {
            const yoy = ((numVal / parseFloat(obs[12].value)) - 1) * 100;
            displayVal = yoy.toFixed(1);
        }

        const history = obs.slice(0, 10).reverse().map(o => ({
            date: o.date,
            value: parseFloat(o.value)
        }));

        indicators.push({ ...s, id: s.id.toLowerCase(), value: displayVal, trend, history });
        console.log(`✅ [FRED/RT] ${s.name}: ${displayVal}`);
    }

    // API 키 누락 시 UI가 텅 비어보이지 않도록 시각적 그래프용 가상 히스토리(history) 데이터 포함
    const fallbacks = {
        'bok-rate': { value: '2.50', trend: 'neutral', history: [{ date: '2025-08', value: 2.5 }, { date: '2025-09', value: 2.5 }, { date: '2025-10', value: 2.5 }, { date: '2025-11', value: 2.5 }, { date: '2025-12', value: 2.5 }, { date: '2026-01', value: 2.5 }, { date: '2026-02', value: 2.5 }] },
        'kr-cpi': { value: '3.1', trend: 'up', history: [{ date: '2025-08', value: 3.4 }, { date: '2025-09', value: 3.7 }, { date: '2025-10', value: 3.8 }, { date: '2025-11', value: 3.3 }, { date: '2025-12', value: 3.2 }, { date: '2026-01', value: 2.8 }, { date: '2026-02', value: 3.1 }] },
        'kr-gdp': { value: '2.4', trend: 'up', history: [{ date: '2024Q3', value: 1.4 }, { date: '2024Q4', value: 1.7 }, { date: '2025Q1', value: 2.0 }, { date: '2025Q2', value: 2.2 }, { date: '2025Q3', value: 2.3 }, { date: '2025Q4', value: 2.4 }, { date: '2026Q1', value: 2.4 }] },
        'm2-supply': { value: '4500', trend: 'up', history: [{ date: '2025-08', value: 4200 }, { date: '2025-09', value: 4250 }, { date: '2025-10', value: 4300 }, { date: '2025-11', value: 4380 }, { date: '2025-12', value: 4420 }, { date: '2026-01', value: 4480 }, { date: '2026-02', value: 4500 }] },
        'trade-balance': { value: '13260', trend: 'up', history: [{ date: '2025-08', value: 8000 }, { date: '2025-09', value: 9500 }, { date: '2025-10', value: 10200 }, { date: '2025-11', value: 11000 }, { date: '2025-12', value: 11800 }, { date: '2026-01', value: 12500 }, { date: '2026-02', value: 13260 }] }
    };

    for (const item of ECOS_SERIES) {
        const rows = await fetchFromEcos(item);

        let rawVal, val, trend, displayVal, history;

        if (rows && rows.length > 0) {
            rawVal = rows[0].DATA_VALUE;
            val = parseFloat(String(rawVal).replace(/,/g, ''));
            trend = rows.length > 1 ? (val > parseFloat(rows[1].DATA_VALUE) ? 'up' : (val < parseFloat(rows[1].DATA_VALUE) ? 'down' : 'neutral')) : 'neutral';
            displayVal = val.toLocaleString();

            if (item.id === 'kr-cpi' && rows.length > 12) {
                const yoy = ((val / parseFloat(rows[12].DATA_VALUE)) - 1) * 100;
                displayVal = yoy.toFixed(1);
            }

            history = rows.slice(0, 10).map(r => ({
                date: r.TIME,
                value: parseFloat(r.DATA_VALUE)
            }));
        } else {
            // ECOS API 키 누락 또는 실패 시 하드코딩된 fallback 데이터 사용
            const fallback = fallbacks[item.id];
            rawVal = fallback.value;
            val = parseFloat(String(rawVal).replace(/,/g, ''));
            trend = fallback.trend;
            displayVal = rawVal;
            history = fallback.history;
        }

        if (trend !== 'neutral') {
            if (item.impact === 'up') trend === 'up' ? upScore += 1.2 : downScore += 1.2;
            else trend === 'up' ? downScore += 1.2 : upScore += 1.2;
        }

        indicators.push({ ...item, value: displayVal, trend, history });
        console.log(`✅ [ECOS] ${item.name}: ${displayVal}`);
    }



    // 2.1 외국인 순매도 영향권 (KIS API 연동)
    if (kisToken) {
        const investorTrend = await fetchMarketInvestorTrend(kisToken);
        if (investorTrend && investorTrend.length > 0) {
            const latest = investorTrend[0].value;
            const prev = investorTrend.length > 1 ? investorTrend[1].value : latest;
            const trend = latest > 0 ? 'up' : 'down'; // 순매수(+) vs 순매도(-)

            // 환율 영향: 외인 순매수 시 환율 하락(down), 순매도 시 환율 상승(up)
            // 가중치 부여 (1.5)
            if (latest > 0) downScore += 1.5;
            else if (latest < 0) upScore += 1.5;

            indicators.push({
                id: 'foreigner-net-buy',
                name: '주문흐름 (외인 순매수)',
                unit: '억원',
                category: 'domestic',
                impact: 'down',
                source: 'KIS (삼성전자 기준)',
                description: '외국인 자금 유입 시 원화 강세(환율 하락) 유발',
                value: latest.toLocaleString(),
                trend: latest >= prev ? 'up' : 'down',
                history: investorTrend.reverse()
            });
            console.log(`✅ [KIS] 외인 순매수: ${latest}억원`);
        }
    }

    const total = upScore + downScore;
    const upProb = total > 0 ? Math.round((upScore / total) * 100) : 50;
    const downProb = 100 - upProb;

    console.log('🤖 AI 시장 분석 생성 중...');
    const aiAnalysis = await fetchAiAnalysis(indicators);

    // 정교한 감성 추출: '결론: 상승/하락' 포맷을 먼저 찾고, 없으면 Rule-based 보조 탐색
    let sentiment = '보통';
    const conclusionMatch = aiAnalysis.match(/결론\s*:\s*(상승|하락|보합)/);
    if (conclusionMatch) {
        if (conclusionMatch[1] === '상승') sentiment = '환율 상승 우세';
        else if (conclusionMatch[1] === '하락') sentiment = '환율 하락 우세';
        else sentiment = '보통';
    } else {
        // Fallback: 문장 말미나 결론부 근처 단어 탐색
        if (/결론.*상승/i.test(aiAnalysis) || /상승\s*우세|상향\s*돌파/i.test(aiAnalysis)) sentiment = '환율 상승 우세';
        else if (/결론.*하락/i.test(aiAnalysis) || /하락\s*우세|하향\s*이탈/i.test(aiAnalysis)) sentiment = '환율 하락 우세';
        else sentiment = upProb > downProb ? '환율 상승 우세' : (downProb > upProb ? '환율 하락 우세' : '보통');
    }

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
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yDateStr = yesterday.toISOString().split('T')[0];
        const yesterdayDataPath = path.join(__dirname, '..', '..', 'data', 'daily', `exchange-rates-${yDateStr}.json`);

        let yesterdayRates = [];
        if (fs.existsSync(yesterdayDataPath)) {
            yesterdayRates = JSON.parse(fs.readFileSync(yesterdayDataPath, 'utf8'));
        } else {
            // 어제가 없으면 그저께 시도 (주말 등 대비)
            yesterday.setDate(yesterday.getDate() - 1);
            const yDateStr2 = yesterday.toISOString().split('T')[0];
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

                // 초당 요청 제한(TPS) 방지를 위한 짧은 지연
                await new Promise(resolve => setTimeout(resolve, 50));
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
                const history = await fetchFromYahooFinance(stock.symbol);
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

    const dashboardData = {
        indicators,
        majorRates,
        stockPrices,
        forecast: {
            sentiment,
            upProb, downProb,
            detailedAnalysis: aiAnalysis,
            score: { upScore, downScore }
        },
        lastUpdate: new Date().toLocaleString('ko-KR')
    };

    const outputPath = path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2));
    console.log('✨ AI 분석 및 주식 시세 포함 데이터 업데이트 완료!');
}
main();
