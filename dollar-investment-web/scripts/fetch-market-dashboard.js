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
                    if (!json.chart || !json.chart.result || !json.chart.result[0]) {
                        console.warn(`⚠️ Yahoo Finance No Result (${symbol})`);
                        return resolve([]);
                    }
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

// 1. Factor Blocks 정의 (연구 자료 기반)
const FACTOR_BLOCKS = {
    RATES_DOLLAR: { id: 'rates-dollar', name: '금리·달러 블록', description: '캐리/글로벌 달러 사이클 요인' },
    RISK: { id: 'risk', name: '리스크 블록', description: '리스크온/오프, 안전통화 수요' },
    ASSETS: { id: 'assets', name: '한국 자산 블록', description: '자본유출입, 한국 위험자산 선호도' },
    FUNDING_POLICY: { id: 'funding-policy', name: '펀딩·정책 블록', description: '유동성·신용/정책에 따른 변동성' }
};

// 2. 해외지표 (FRED)
const FRED_SERIES = [
    { id: 'FEDFUNDS', name: '미국 기준금리(Fed)', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'Federal Reserve', description: 'Fed 금리 인상 시 달러 가치 상승으로 환율 상승' },
    { id: 'DXY', name: '달러 인덱스(DXY)', unit: 'pt', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'ICE', description: '달러의 상대적 가치 (환율의 핵심 나침반)', realtimeSymbol: 'DX-Y.NYB', fredId: 'DTWEXBGS' },
    { id: 'TNX', name: '미 10년물 국채금리', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'up', source: 'CBOE', description: '미 국채 금리 상승 시 달러 강세 유발', realtimeSymbol: '^TNX', fredId: 'GS10' },
    { id: 'VIXCLS', name: 'VIX 공포지수', unit: 'pt', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: 'CBOE', description: '시장 불안정성 및 공포 심리 지표', realtimeSymbol: '^VIX' },
    { id: 'SOFR', name: 'SOFR', unit: '%', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: 'NY Fed', description: '담보 유동성 지표', hidden: true },
    { id: 'EFFR', name: 'EFFR', unit: '%', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: 'Fed', description: '무담보 유동성 지표', hidden: true },
    { id: 'DTB3', name: 'T-Bill 3M', unit: '%', block: FACTOR_BLOCKS.RISK.id, impact: 'down', source: 'Fed', description: '무위험 단기 금리', hidden: true },
    { id: 'KOSPI', name: '코스피 지수', unit: 'pt', block: FACTOR_BLOCKS.ASSETS.id, impact: 'down', source: 'KRX', description: '국내 시장 악화 시 원화 약세(환율 상승) 유도', realtimeSymbol: '^KS11', fredId: null },
    { id: 'DCOILWTICO', name: '국제 유가(WTI)', unit: '$', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: 'WTI', description: '원자재 가격 상승 시 인플레이션 및 달러 수요 자극', realtimeSymbol: 'CL=F' },
];

// 3. 국내지표 (ECOS)
const ECOS_SERIES = [
    { id: 'bok-rate', statCode: '722Y001', item1: '0101000', name: '한국 기준금리', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'down', source: '한국은행', description: '미국과의 금리차 결정 요인', cycle: 'M' },
    { id: 'investor-deposits', statCode: '064Y001', item1: '0001000', name: '투자자예탁금', unit: '억원', block: FACTOR_BLOCKS.ASSETS.id, impact: 'down', source: '한국은행', description: '증시 대기 자금, 증가 시 증시 상승 기대', cycle: 'D' },
    { id: 'kr-cpi', statCode: '901Y009', item1: '0', name: '한국 소비자물가', unit: '%', block: FACTOR_BLOCKS.FUNDING_POLICY.id, impact: 'down', source: '한국은행', description: '인플레이션 지표, 금리 정책에 영향', cycle: 'M' },
    { id: 'kr-10y', statCode: '721Y001', item1: '010200000', name: '국고채 10년', unit: '%', block: FACTOR_BLOCKS.RATES_DOLLAR.id, impact: 'down', source: '한국은행', description: '한미 금리차 산출용', cycle: 'D' },
    { id: 'trade-balance', statCode: '301Y013', item1: '000000', name: '경상수지', unit: 'M$', block: FACTOR_BLOCKS.FUNDING_POLICY.id, impact: 'down', source: '한국은행', description: '수지 흑자 시 원화 강세(환율 하락) 유도', cycle: 'M' },
    { id: 'cds-korea', statCode: '902Y003', item1: '0000140', name: 'CDS 프리미엄', unit: 'bp', block: FACTOR_BLOCKS.FUNDING_POLICY.id, impact: 'up', source: '한국은행', description: '국가 부도 위험 지표 (상승 시 환율 상승 압력)', cycle: 'D' },
    { id: 'sovereign-spread', statCode: '902Y003', item1: '0000147', name: '외평채 가산금리', unit: 'bp', block: FACTOR_BLOCKS.FUNDING_POLICY.id, impact: 'up', source: '한국은행', description: '국가 신용 가산금리 (상승 시 자본 유출 위험)', cycle: 'D' },
    { id: 'short-debt-ratio', statCode: '731Y003', item1: '0000002', name: '단기외채 비중', unit: '%', block: FACTOR_BLOCKS.FUNDING_POLICY.id, impact: 'up', source: '한국은행', description: '외환보유액 대비 단기외채 비중 (상승 시 건전성 악화)', cycle: 'Q' }
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

// --- 모델 고도화 유틸리티 ---
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
    
    const tryFetch = async (baseUrl, trId, iscd = "0001", div = "P", path = "inquire-investor") => {
        try {
            const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/${path}?fid_cond_mrkt_div_code=${div}&fid_input_iscd=${iscd}`;
            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`,
                    "appkey": KIS_APP_KEY,
                    "appsecret": KIS_APP_SECRET,
                    "tr_id": trId,
                    "custtype": "P",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
                }
            });
            const text = await res.text();
            if (!text) return { error: "Empty response" };
            try {
                return JSON.parse(text);
            } catch (e) {
                console.warn(`⚠️ JSON Parse Error. Raw: ${text.substring(0, 50)}...`);
                return { error: "Invalid JSON" };
            }
        } catch (e) {
            return { error: e.message };
        }
    };

    try {
        // 1. 코스피 전체 외국인 수급 (실시간 가집계)
        // FID_COND_MRKT_DIV_CODE: J (주식), FID_INPUT_ISCD: 0000 (전체)
        // Path: foreign-institution-tot
        const marketData = await tryFetch(KIS_BASE_URL, "FHKST01010900", "0000", "J", "foreign-institution-tot");
        let latestMarketValue = 0;
        
        if (marketData && marketData.output) {
            const foreignerRow = marketData.output.find(r => r.invst_tp_cd === "02");
            if (foreignerRow) {
                latestMarketValue = Math.round(parseFloat(foreignerRow.ntby_tr_pbmn) / 100); // 백만원 -> 억원
            }
        }

        // 2. 히스토리 유지를 위해 대표 종목(KODEX 200 - 069500) 데이터 활용
        const historyData = await tryFetch(KIS_BASE_URL, "FHKST01010900", "069500", "J", "inquire-investor");
        
        if (historyData.error || (historyData.rt_cd && historyData.rt_cd !== '0' && historyData.rt_cd !== '00')) {
            // 히스토리 실패 시 당일 데이터만이라도 반환
            return [{ date: new Date().toISOString().split('T')[0], value: latestMarketValue }];
        }

        const output = historyData.output || historyData.output1;
        if (output && Array.isArray(output)) {
            const result = output
                .map(d => {
                    const date = d.stck_bsop_date || d.STCK_BSOP_DATE || "";
                    const ntby = d.frgn_ntby_tr_pbmn || d.FRGN_NTBY_TR_PBMN || "0";
                    return {
                        date: date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                        value: Math.round(parseFloat(ntby) / 100) // 백만원 -> 억원
                    };
                })
                .filter(d => d.date && !isNaN(d.value))
                .slice(0, 14);

            // 첫 번째 요소(최신 데이터)를 코스피 전체 실시간 값으로 교체 (더 정확한 정보 제공)
            if (result.length > 0 && latestMarketValue !== 0) {
                result[0].value = latestMarketValue;
            } else if (result.length === 0) {
                result.push({ date: new Date().toISOString().split('T')[0], value: latestMarketValue });
            }
            
            return result;
        }
    } catch (e) {
        console.error("❌ KIS 외인수급 조회 최종 에러:", e.message);
    }
    return null;
}



async function getKisAccessToken() {
    if (!KIS_APP_KEY || !KIS_APP_SECRET) {
        console.warn("⚠️ KIS API 키가 없습니다. KIS 연동을 건너뜜니다.");
        return null;
    }

    const tokenPath = path.join(__dirname, '..', '.kis-token.json');
    
    // 1. 캐시된 토큰 확인
    try {
        if (fs.existsSync(tokenPath)) {
            const cached = JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
            const now = Date.now();
            const issuedAt = cached.issued_at || 0;
            const hoursPassed = (now - issuedAt) / (1000 * 60 * 60);

            // 12시간 이내면 재사용 (안전하게 절반으로 단축)
            if (hoursPassed < 12) {
                console.log(`✅ KIS 토큰 재사용 중 (발급 후 ${Math.round(hoursPassed)}시간 경과)`);
                return cached.access_token;
            }
        }
    } catch (e) {
        console.warn("⚠️ 토큰 캐시 읽기 실패, 새로 발급합니다.");
    }

    // 2. 새 토큰 발급
    console.log("🚀 KIS 신규 토큰 발급 요청 중... (443 -> 9443 시도)");
    
    const tryFetchToken = async (url) => {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json; charset=UTF-8',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
                },
                body: JSON.stringify({
                    grant_type: "client_credentials",
                    appkey: KIS_APP_KEY,
                    appsecret: KIS_APP_SECRET
                })
            });
            return await res.json();
        } catch (e) {
            return { error: e.message };
        }
    };

    let data = await tryFetchToken(`${KIS_BASE_URL}/oauth2/tokenP`);

    if (data.access_token) {
        console.log("✅ KIS 신규 토큰 발급 성공");
        fs.writeFileSync(tokenPath, JSON.stringify({
            access_token: data.access_token,
            issued_at: Date.now()
        }, null, 2));
        return data.access_token;
    } else {
        console.log("❌ KIS 토큰 발급 최종 실패:", JSON.stringify(data));
    }
    return null;
}

async function fetchDomesticStockFromKIS(code, token) {
    const tryFetch = async (baseUrl) => {
        try {
            const url = `${baseUrl}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${code}`;
            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "authorization": `Bearer ${token}`,
                    "appkey": KIS_APP_KEY,
                    "appsecret": KIS_APP_SECRET,
                    "tr_id": "FHKST01010100",
                    "custtype": "P",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
                }
            });
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                return { error: "Invalid JSON", raw: text.substring(0, 100) };
            }
        } catch (e) {
            return { error: e.message };
        }
    };

    try {
        let data = await tryFetch(KIS_BASE_URL);
        if (data.error || !data.output) {
            data = await tryFetch(KIS_BASE_URL_REAL);
        }
        
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
    const tryFetch = async (baseUrl) => {
        try {
            const url = `${baseUrl}/uapi/overseas-stock/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${symbol}`;
            const res = await fetch(url, {
                headers: {
                    "Content-Type": "application/json",
                    "authorization": `Bearer ${token}`,
                    "appkey": KIS_APP_KEY,
                    "appsecret": KIS_APP_SECRET,
                    "tr_id": "HHDFS00000300",
                    "custtype": "P",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
                }
            });
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                return { error: "Invalid JSON", raw: text.substring(0, 100) };
            }
        } catch (e) {
            return { error: e.message };
        }
    };

    try {
        let data = await tryFetch(KIS_BASE_URL);
        if (data.error || !data.output) {
            data = await tryFetch(KIS_BASE_URL_REAL);
        }

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

async function fetchAiAnalysis(indicators, usdKrwHistory = []) {
    if (!GEMINI_API_KEY) {
        return "Gemini API 키가 설정되지 않아 기본 분석 시스템을 사용합니다.";
    }

    const blockSummary = summarizeByBlock(indicators);
    const prompt = `당신은 한수지(금융 분석가)입니다. 다음 4대 핵심 요인(Block)을 바탕으로 향후 원/달러 환율 방향성을 한국어로 심층 분석해주세요.

연구 자료에 따르면 환율 결정의 최우선 순위는 '한·미 금리차'와 '달러 인덱스'입니다. 또한 VIX(전이 위험)와 외국인 수급(자본 흐름)을 결합하여 리스크 온/오프 국면을 판단해 주세요.

분석 대상 지표:
${blockSummary}

원/달러 환율 최근 추세 (최신순):
${usdKrwHistory.slice(0, 10).map(h => `${h.date}: ${h.value}원`).join('\n')}

분석 가이드:
1. [금리·달러] 블록을 통해 캐리 매력도와 글로벌 달러 사이클의 방향성을 진단하세요.
2. [환율 추세] 제공된 원/달러 환율의 최근 기술적 흐름(지지/저항, 추세 지속성)을 분석에 포함하세요.
3. [리스크] 및 [한국 자산] 블록을 통해 리스크 온/오프 국면을 진단하세요.
4. [펀딩·정책] 및 [투자 전략]을 종합하여 실전 달러 투자 전략을 간략히 제시하세요. (목표가 가이드 포함)

응답은 전문적이고 분석적인 톤으로 **최대한 간결하게 2~3개 단락**으로 작성하세요 (공백 포함 500자 내외). 마크다운 기호(##, **)나 이모지는 절대 사용하지 마세요. 마지막 단락은 반드시 "실전 투자 대응:"으로 시작하고, 끝에 "결론: [상승/하락/보합] 우세"라고 적어주세요.`;

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
    const title = forecast.sentiment === '환율 상승 우세' ? '📈 환율 상승 우세 예측' : (forecast.sentiment === '환율 하락 우세' ? '📉 환율 하락 우세 예측' : '⚖️ 시장 보합/관망 분석');
    
    // AI 분석 내용 중 투자 대응 부분만 강조하여 메시지 구성
    const analysisLines = forecast.aiAnalysis.split('\n');
    let summary = '';
    let strategy = '';
    
    for (const line of analysisLines) {
        if (line.includes('실전 투자 대응:')) strategy = line.replace('실전 투자 대응:', '').trim();
        else if (!summary && line.length > 20) summary = line.trim();
    }

    const message = `
🤖 *달러 인베스트 AI 시장 분석*
━━━━━━━━━━━━━━━━━━
${title}
📊 *상승:* ${forecast.upProb}% | *하락:* ${forecast.downProb}%

📝 *핵심 요약:*
${summary.substring(0, 150)}${summary.length > 150 ? '...' : ''}

🎯 *투자 대응 가이드:*
${strategy.substring(0, 200)}${strategy.length > 200 ? '...' : ''}

🌐 [시장 대시보드 바로가기](https://giroklabs.github.io/exchangealert/)
━━━━━━━━━━━━━━━━━━
⏰ 분석 시점: ${new Date().toLocaleString('ko-KR')}
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
    const indicators = [];
    const kisToken = await getKisAccessToken();
    // 블록별 점수 합산용 (정규화용)
    const blockScores = {
        'rates-dollar': { up: 0, down: 0 },
        'risk': { up: 0, down: 0 },
        'assets': { up: 0, down: 0 },
        'funding-policy': { up: 0, down: 0 }
    };

    for (const s of FRED_SERIES) {
        let obs = await fetchFromFred(s.fredId || s.id);

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
        const trend = numVal > prevVal ? 'up' : (numVal < prevVal ? 'down' : 'neutral');

        const history = obs.slice(0, 10).reverse().map(o => ({ date: o.date, value: parseFloat(o.value) }));
        
        // --- 고도화 로직 적용 ---
        const zScore = calculateZScore(numVal, history);
        const freshness = getFreshnessMultiplier(s.realtimeSymbol ? 'realtime' : 'D');
        
        // 변동 강도 반영 (Z-Score가 클수록 점수 가중)
        const volatilityWeight = Math.min(Math.abs(zScore), 2.0); // 최대 2배까지만
        const finalWeight = (1.0 + volatilityWeight) * freshness;

        if (s.impact === 'up') {
            blockScores[s.block].up += 0.5 * finalWeight;
            if (trend === 'up') blockScores[s.block].up += 1.0 * finalWeight;
            else if (trend === 'down') blockScores[s.block].down += 1.0 * finalWeight;
        } else {
            blockScores[s.block].down += 0.5 * finalWeight;
            if (trend === 'up') blockScores[s.block].down += 1.0 * finalWeight;
            else if (trend === 'down') blockScores[s.block].up += 1.0 * finalWeight;
        }

        const realizedImpact = trend === 'neutral' ? 'neutral' : 
            ((s.impact === 'up' && trend === 'up') || (s.impact === 'down' && trend === 'down') ? 'up' : 'down');

        let displayVal = numVal.toLocaleString();
        if ((s.id === 'CPIAUCSL' || s.fredId === 'CPIAUCSL') && obs.length > 12) {
            const yoy = ((numVal / parseFloat(obs[12].value)) - 1) * 100;
            displayVal = yoy.toFixed(1);
        }

        if (!s.hidden) {
            indicators.push({ ...s, id: s.id.toLowerCase(), value: displayVal, trend, realizedImpact, history });
            console.log(`✅ [FRED/RT] ${s.name}: ${displayVal} (Z:${zScore.toFixed(2)})`);
        } else {
            // 히든 지표도 데이터는 보유 (계산용)
            indicators.push({ ...s, id: s.id.toLowerCase(), value: numVal, trend, realizedImpact, history, isInternal: true });
        }
    }

    // API 키 누락 시 UI가 텅 비어보이지 않도록 시각적 그래프용 가상 히스토리(history) 데이터 포함
    const fallbacks = {
        'bok-rate': { value: '2.50', trend: 'neutral', history: [{ date: '2025-08', value: 2.5 }, { date: '2025-09', value: 2.5 }, { date: '2025-10', value: 2.5 }, { date: '2025-11', value: 2.5 }, { date: '2025-12', value: 2.5 }, { date: '2026-01', value: 2.5 }, { date: '2026-02', value: 2.5 }] },
        'kr-cpi': { value: '2.8', trend: 'down', history: [{ date: '2025-12', value: 3.2 }, { date: '2026-01', value: 3.1 }, { date: '2026-02', value: 2.9 }, { date: '2026-03', value: 2.8 }] },
        'kr-gdp': { value: '2.6', trend: 'up', history: [{ date: '2024Q4', value: 1.7 }, { date: '2025Q1', value: 2.0 }, { date: '2025Q2', value: 2.3 }, { date: '2026Q1', value: 2.6 }] },
        'm2-supply': { value: '4500', trend: 'up', history: [{ date: '2025-12', value: 4420 }, { date: '2026-01', value: 4480 }, { date: '2026-02', value: 4500 }] },
        'trade-balance': { value: '15200', trend: 'up', history: [{ date: '2025-12', value: 11800 }, { date: '2026-01', value: 13500 }, { date: '2026-02', value: 15200 }] },
        'kr-10y': { value: '3.45', trend: 'up', history: [{ date: '2026-03-01', value: 3.3 }, { date: '2026-03-05', value: 3.4 }, { date: '2026-03-10', value: 3.45 }] },
        'foreigner-net-buy': { value: '520', trend: 'up', history: [{ date: '03-10', value: -200 }, { date: '03-11', value: 100 }, { date: '03-12', value: 400 }, { date: '03-13', value: 520 }] },
        'cds-korea': { value: '35', trend: 'neutral', history: [{ date: '03-10', value: 32 }, { date: '03-11', value: 34 }, { date: '03-12', value: 35 }, { date: '03-13', value: 35 }] },
        'sovereign-spread': { value: '42', trend: 'up', history: [{ date: '03-10', value: 38 }, { date: '03-11', value: 40 }, { date: '03-12', value: 42 }, { date: '03-13', value: 42 }] },

        'investor-deposits': { value: '55200', trend: 'up', history: [{ date: '03-10', value: 52100 }, { date: '03-11', value: 53500 }, { date: '03-12', value: 54800 }, { date: '03-13', value: 55200 }] },
        'bok-rate': { value: '3.50', trend: 'neutral', history: [{ date: '202512', value: 3.5 }, { date: '202601', value: 3.5 }] },
        'short-debt-ratio': { value: '38.4', trend: 'neutral', history: [{ date: '2025Q3', value: 38.2 }, { date: '2025Q4', value: 38.4 }] },
        'ted-spread': { value: '0.09', trend: 'neutral', history: [{ date: '03-10', value: 0.08 }, { date: '03-11', value: 0.09 }, { date: '03-12', value: 0.09 }, { date: '03-13', value: 0.09 }] },
        'sofr-ois': { value: '0.18', trend: 'neutral', history: [{ date: '03-10', value: 0.17 }, { date: '03-11', value: 0.18 }, { date: '03-12', value: 0.18 }, { date: '03-13', value: 0.18 }] }
    };

    for (const item of ECOS_SERIES) {
        const rows = await fetchFromEcos(item);
        let val, trend, displayVal, history;

        if (rows && rows.length > 0) {
            val = parseFloat(String(rows[0].DATA_VALUE).replace(/,/g, ''));
            trend = rows.length > 1 ? (val > parseFloat(rows[1].DATA_VALUE) ? 'up' : (val < parseFloat(rows[1].DATA_VALUE) ? 'down' : 'neutral')) : 'neutral';
            displayVal = val.toLocaleString();
            history = rows.slice(0, 10).map(r => ({ date: r.TIME, value: parseFloat(r.DATA_VALUE) }));
        } else {
            const fallback = fallbacks[item.id];
            val = parseFloat(String(fallback.value).replace(/,/g, ''));
            trend = fallback.trend;
            displayVal = fallback.value;
            history = fallback.history;
        }

        // --- 고도화 로직 적용 ---
        const zScore = calculateZScore(val, history);
        const freshness = getFreshnessMultiplier(item.cycle);
        const volatilityWeight = Math.min(Math.abs(zScore), 1.5);
        let finalWeight = (1.0 + volatilityWeight) * freshness;

        // 임계값(Threshold) 기반 특수 가중치
        if (item.id === 'cds-korea' && val > 40) finalWeight *= 1.5; // CDS 40bp 돌파 시 리스크 가중
        if (item.id === 'short-debt-ratio' && val > 40) finalWeight *= 1.3; // 단기외채 40% 돌파 시 가중

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

        indicators.push({ ...item, value: displayVal, trend, realizedImpact, history });
        console.log(`✅ [ECOS] ${item.name}: ${displayVal} (Z:${zScore.toFixed(2)})`);
    }



    // 2.1 외국인 순매도 영향권 (KIS API 연동)
    let investorTrend = null;
    if (kisToken) {
        investorTrend = await fetchMarketInvestorTrend(kisToken);
    }
    if (investorTrend && investorTrend.length > 0) {
        const latest = investorTrend[0].value;
        const prev = investorTrend.length > 1 ? investorTrend[1].value : latest;

        // 외국인 순매수 -> 원화 강세(환율 하락) 요인 (-2.5 가중치 대폭 강화)
        if (latest > 0) blockScores['assets'].down += 2.5;
        else if (latest < 0) blockScores['assets'].up += 2.5;

        const realizedImpact = latest < 0 ? 'up' : (latest > 100 ? 'down' : 'neutral');

        indicators.push({
            id: 'foreigner-net-buy',
            name: 'KOSPI 외국인 수급동향',
            unit: '억원',
            block: FACTOR_BLOCKS.ASSETS.id,
            impact: 'down',
            source: 'KIS 실시간',
            description: '외국인 순매도 시 원화 약세(환율 상승) 요인으로 작용',
            value: latest.toLocaleString(),
            trend: latest >= prev ? 'up' : 'down',
            realizedImpact,
            history: investorTrend.reverse()
        });
        console.log(`✅ [KIS] 외인 순매수: ${latest}억원`);
    } else {
        // Fallback 시각화
        const fb = fallbacks['foreigner-net-buy'];
        indicators.push({
            id: 'foreigner-net-buy',
            name: 'KOSPI 외국인 수급동향 (연결대기)',
            unit: '억원',
            block: FACTOR_BLOCKS.ASSETS.id,
            impact: 'down',
            source: '데이터 예측',
            description: '외국인 수급은 환율의 가장 강력한 선행 지표입니다.',
            value: fb.value,
            trend: fb.trend,
            history: fb.history
        });
        console.log(`⚠️ [KIS] 외인 수급 fallback 데이터 적용`);
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
                const krH = kr10y.history.find(kh => kh.date === h.date) || kr10y.history[idx] || h;
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
            const val = (base.value - ref.value).toFixed(3);
            const prevVal = (base.history[1]?.value - ref.history[1]?.value) || val;
            const trend = val > prevVal ? 'up' : (val < prevVal ? 'down' : 'neutral');
            
            let spreadWeight = 1.0;
            if (parseFloat(val) > 0.5) spreadWeight *= 2.0; // 50bp 돌파 시 리스크 가중

            blockScores['risk'].up += (trend === 'up' ? 1.5 : 0.5) * spreadWeight;
            
            indicators.push({
                id, name, unit: '%', block: FACTOR_BLOCKS.RISK.id, impact: 'up', source: '계산치',
                description: desc, value: val, trend, realizedImpact: trend,
                history: base.history.map((h, idx) => {
                    const rh = ref.history.find(r => r.date === h.date) || ref.history[idx] || h;
                    return { date: h.date, value: parseFloat((h.value - rh.value).toFixed(3)) };
                })
            });
            console.log(`✅ [Calc] ${name}: ${val}% (추세: ${trend})`);
        };

        calculateSpread('ted-spread', 'TED 스프레드', sofr, dtb3, '은행간 신용 위험 (상승 시 달러 조달 경색)');
        calculateSpread('sofr-ois', 'SOFR-OIS 스프레드', sofr, effr, '금융시장 유동성 리스크 (상승 시 위험회피 강화)');
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
        console.log(`📊 [Block] ${blockId}: Up:${dampenedUp.toFixed(1)}, Down:${dampenedDown.toFixed(1)}`);
    });

    // 노이즈 점수 (극단적 쏠림 방지)
    let upScoreFinal = upScore + 0.5;
    let downScoreFinal = downScore + 0.5;

    const total = upScoreFinal + downScoreFinal;
    const upProb = Math.round((upScoreFinal / total) * 100);
    const downProb = 100 - upProb;

    console.log('🤖 AI 시장 분석 생성 중...');
    const usdKrwHistory = await fetchFromYahooFinance('USDKRW=X');
    
    let aiAnalysis = "";
    let lastAiUpdate = null;
    let sentiment = '보통';

    // AI 분석 주기 조절 (1시간 단위)
    // 30분마다 데이터는 수집하지만 AI 분석은 1시간(약 50분 이상 경과 시)에 한 번만 실행
    let shouldSkipAi = process.env.SKIP_AI_ANALYSIS === 'true';
    
    if (!shouldSkipAi) {
        try {
            // 여러 가능성 있는 경로 체크
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
                    console.log(`📖 기존 데이터를 찾았습니다: ${p}`);
                    break;
                }
            }

            if (prevData && prevData.forecast) {
                const lastAiTime = prevData.forecast.lastAiUpdate || 0;
                const diffMin = (Date.now() - lastAiTime) / (1000 * 60);
                
                // 마지막 AI 분석으로부터 55분 이내면 AI 호출 건너뜀
                // 단, 이전 분석 결과가 '키 설정 오류' 관련 메시지라면 캐시를 무시하고 새로 시도
                const isErrorMessage = prevData.forecast.aiAnalysis && 
                                     (prevData.forecast.aiAnalysis.includes("API 키가 설정되지 않아") || 
                                      prevData.forecast.aiAnalysis.includes("분석 요청 실패"));

                if (diffMin < 55 && !isErrorMessage) {
                    console.log(`⏱️ 마지막 AI 분석 이후 ${Math.round(diffMin)}분 경과. (1시간 간격 유지 위해 기존 분석 유지)`);
                    aiAnalysis = prevData.forecast.aiAnalysis || prevData.forecast.detailedAnalysis || "";
                    sentiment = prevData.forecast.sentiment || "보통";
                    lastAiUpdate = lastAiTime; 
                    shouldSkipAi = true;
                } else if (isErrorMessage) {
                    console.log(`🔄 이전 분석에 오류가 발견되어 캐시를 무시하고 AI 분석을 재시도합니다.`);
                    shouldSkipAi = false;
                }
            }
        } catch (e) {
            console.warn('⚠️ 이전 분석 데이터 로드 시도 중 오류:', e.message);
        }
    }

    if (shouldSkipAi && !aiAnalysis) {
        console.log('⏭️ SKIP_AI_ANALYSIS 설정에 의해 AI 분석을 건너뜁니다. (비용 절감)');
        aiAnalysis = "실시간 지표 업데이트 중입니다. 상세 분석은 정기 리포트(1시간 주기)에서 확인 가능합니다. 결론: 관망 우세";
        lastAiUpdate = 0;
    } else if (!shouldSkipAi) {
        aiAnalysis = await fetchAiAnalysis(indicators, usdKrwHistory);
        lastAiUpdate = Date.now(); // 새로운 분석 시간 기록
    }

    // 마크다운 기호 및 깨진 글자 세밀하게 제거
    aiAnalysis = aiAnalysis
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/###/g, '')
        .replace(/##/g, '')
        .replace(/#/g, '')
        .replace(/\uFFFD/g, '') // 유니코드 대체 문자 확실히 제거
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // 제어 문자 제거
        .replace(/[“”]/g, '"') // 특수 따옴표 ASCII로 변경
        .replace(/[‘’]/g, "'") // 특수 작은 따옴표 ASCII로 변경
        .replace(/—|–/g, '-') // 특수 대시 ASCII로 변경
        .trim();

    // 정교한 감성 추출: '결론: 상승/하락' 포맷을 먼저 찾고, 없으면 Rule-based 보조 탐색
    sentiment = '보통';
    const conclusionMatch = aiAnalysis.match(/결론\s*[:：]?\s*(상승|하락|보합|강세|약세)/);
    if (conclusionMatch) {
        const res = conclusionMatch[1];
        if (res === '상승' || res === '강세') sentiment = '환율 상승 우세';
        else if (res === '하락' || res === '약세') sentiment = '환율 하락 우세';
        else sentiment = '보통';
    } else {
        // Fallback: 문장 말미나 결론부 근처 단어 탐색
        const lastPart = aiAnalysis.slice(-150);
        if (/상승\s*우세|상향\s*돌파|강세\s*지속/i.test(lastPart)) sentiment = '환율 상승 우세';
        else if (/하락\s*우세|하향\s*이탈|약세\s*전환/i.test(lastPart)) sentiment = '환율 하락 우세';
        else sentiment = upProb > 55 ? '환율 상승 우세' : (downProb > 55 ? '환율 하락 우세' : '보통');
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
            aiAnalysis,
            detailedAnalysis: aiAnalysis, // 하위 호환성 위해 유지
            lastAiUpdate: lastAiUpdate || Date.now(),
            score: { upScore, downScore }
        },
        lastUpdate: new Date().toLocaleString('ko-KR')
    };

    const outputPath = path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2), 'utf8');
    console.log('✨ AI 분석 및 주식 시세 포함 데이터 업데이트 완료!');

    // 5. 텔레그램 알림 발송 (새로운 분석이 수행된 경우)
    if (!shouldSkipAi && aiAnalysis && !aiAnalysis.includes('분석 요청 실패')) {
        await sendTelegramNotification(dashboardData.forecast, dashboardData.lastUpdate);
    }
}
main();
