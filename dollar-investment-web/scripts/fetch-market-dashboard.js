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

// 1. 해외지표 (FRED)
const FRED_SERIES = [
    { id: 'FEDFUNDS', name: '미국 기준금리(Fed)', unit: '%', category: 'international', impact: 'up', source: 'Federal Reserve', description: 'Fed 금리 인상 시 달러 가치 상승으로 환율 상승' },
    { id: 'PAYEMS', name: '미 비농업고용지수', unit: 'K', category: 'international', impact: 'up', source: 'BLS', description: '미국 고용 지표 호조 시 달러 선호 현상 강화' },
    { id: 'DEXJPUS', name: '엔/달러 환율', unit: '¥', category: 'international', impact: 'up', source: 'Market', description: '엔화 약세 시 환율 상승 경향' },
    { id: 'DCOILWTICO', name: '국제 유가(WTI)', unit: '$', category: 'international', impact: 'up', source: 'WTI', description: '유가 상승 시 달러 수요 증가로 환율 상승' },
    { id: 'CPIAUCSL', name: '미 소비자물가(CPI)', unit: '%', category: 'international', impact: 'up', source: 'BLS', description: '미국 물가 상승 시 금리 인상 기대감으로 달러 강세 유발' },
    { id: 'GDP', name: '미국 GDP', unit: 'B$', category: 'international', impact: 'up', source: 'BEA', description: '미국 경제 성장 호조 시 달러 가치 상승' }
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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function fetchAiAnalysis(indicators) {
    if (!GEMINI_API_KEY) {
        return "Gemini API 키가 설정되지 않아 기본 분석 시스템을 사용합니다.";
    }

    const summary = indicators.map(i => `- ${i.name}: ${i.value}${i.unit} (추세: ${i.trend}, 환율영향: ${i.impact})`).join('\n');
    const prompt = `당신은 한수지(금융 분석가)입니다. 다음 경제 지표들을 바탕으로 향후 원/달러 환율 방향성을 한국어로 분석해주세요.
응답은 2~3문장의 짧고 명확한 한락으로 작성하고, 마지막에 "결론: [상승/하락/보합] 우세"라고 적어주세요.

경제 지표 현황:
${summary}

환율에 미치는 심리적, 거시적 요인을 분석해줘.`;

    const data = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
    });

    console.log('🤖 AI 분석 요청 중...');
    return new Promise((resolve) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode !== 200) {
                        console.error(`❌ Gemini API 오류 (${res.statusCode}):`, JSON.stringify(json, null, 2));
                        resolve('AI 분석 서비스 응답 오류');
                        return;
                    }
                    if (json.candidates && json.candidates[0] && json.candidates[0].content) {
                        resolve(json.candidates[0].content.parts[0].text.trim());
                    } else {
                        console.error('❌ Gemini API 응답 구조 이상:', JSON.stringify(json, null, 2));
                        resolve('AI 분석 결과 형식이 올바르지 않습니다.');
                    }
                } catch (e) {
                    console.error('❌ JSON 파싱 오류 또는 예외 발생:', e.message);
                    console.error('응답 본문 일부:', body.substring(0, 100));
                    resolve('AI 분석을 일시적으로 불러올 수 없습니다.');
                }
            });
        });
        req.on('error', (err) => {
            console.error('❌ 네트워크 오류:', err.message);
            resolve('네트워크 오류로 AI 분석 실패');
        });
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('🚀 2026년 실시간 데이터 수집 시작...');
    const indicators = [];
    let upScore = 0, downScore = 0;

    for (const s of FRED_SERIES) {
        const obs = await fetchFromFred(s.id);
        const val = obs.length > 0 ? obs[0].value : '0';
        const trend = obs.length > 1 ? (parseFloat(val) > parseFloat(obs[1].value) ? 'up' : 'down') : 'neutral';

        if (s.impact === 'up') trend === 'up' ? upScore++ : downScore++;
        else trend === 'up' ? downScore++ : upScore++;

        let displayVal = parseFloat(val).toLocaleString();
        if (s.id === 'CPIAUCSL' && obs.length > 12) {
            const yoy = ((parseFloat(val) / parseFloat(obs[12].value)) - 1) * 100;
            displayVal = yoy.toFixed(1);
        }

        const history = obs.slice(0, 10).reverse().map(o => ({
            date: o.date,
            value: parseFloat(o.value)
        }));

        indicators.push({ ...s, id: s.id.toLowerCase(), value: displayVal, trend, history });
        console.log(`✅ [FRED] ${s.name}: ${displayVal}`);
    }

    const fallbacks = {
        'bok-rate': '2.50',
        'kr-cpi': '3.1',
        'kr-gdp': '2.4',
        'm2-supply': '4500',
        'trade-balance': '13260'
    };

    for (const item of ECOS_SERIES) {
        const rows = await fetchFromEcos(item);
        let rawVal = rows && rows.length > 0 ? rows[0].DATA_VALUE : fallbacks[item.id];
        let val = parseFloat(String(rawVal).replace(/,/g, ''));

        let trend = rows && rows.length > 1 ? (val > parseFloat(rows[1].DATA_VALUE) ? 'up' : 'down') : 'neutral';

        if (item.impact === 'up') trend === 'up' ? upScore += 1.2 : downScore += 1.2;
        else trend === 'up' ? downScore += 1.2 : upScore += 1.2;

        let displayVal = val.toLocaleString();

        if (item.id === 'kr-cpi' && rows && rows.length > 12) {
            const yoy = ((val / parseFloat(rows[12].DATA_VALUE)) - 1) * 100;
            displayVal = yoy.toFixed(1);
        }

        const history = rows ? rows.slice(0, 10).map(r => ({
            date: r.TIME,
            value: parseFloat(r.DATA_VALUE)
        })) : [];

        indicators.push({ ...item, value: displayVal, trend, history });
        console.log(`✅ [ECOS] ${item.name}: ${displayVal}`);
    }

    const total = upScore + downScore;
    const upProb = Math.round((upScore / total) * 100);
    const downProb = 100 - upProb;

    console.log('🤖 AI 시장 분석 생성 중...');
    const aiAnalysis = await fetchAiAnalysis(indicators);

    const dashboardData = {
        indicators,
        forecast: {
            sentiment: aiAnalysis.includes('상승 우세') ? '환율 상승 우세' : aiAnalysis.includes('하락 우세') ? '환율 하락 우세' : '보통',
            upProb, downProb,
            detailedAnalysis: aiAnalysis,
            score: { upScore, downScore }
        },
        lastUpdate: new Date().toLocaleString('ko-KR')
    };

    const outputPath = path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2));
    console.log('✨ AI 분석 포함 데이터 업데이트 완료!');
}
main();
