/**
 * 시장 대시보드 데이터 수집 및 예측 모델 분석 스크립트
 * 국내/외 주요 지표 100% 연동 버전
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

// 2. 국내지표 (ECOS) - 검증된 최종 코드
const ECOS_SERIES = [
    { id: 'bok-rate', statCode: '722Y001', item1: '0101000', name: '한국 기준금리', unit: '%', category: 'domestic', impact: 'down', source: '한국은행', description: '금리 인상 시 원화 강세 유도', cycle: 'M' },
    { id: 'kr-cpi', statCode: '901Y009', item1: '0', name: '국내 소비자물가(CPI)', unit: '%', category: 'domestic', impact: 'up', source: '통계청', description: '물가 상승 시 원화 가치 하락 압력', cycle: 'M' },
    { id: 'kr-gdp', statCode: '200Y005', item1: '10101', name: '경제성장률', unit: '%', category: 'domestic', impact: 'down', source: '한국은행', description: '경제 성장 호조 시 원화 강세 유도', cycle: 'Q' },
    { id: 'm2-supply', statCode: '101Y001', item1: 'BBHS01', name: '통화량(M2)', unit: '조원', category: 'domestic', impact: 'up', source: '한국은행', description: '통화 팽창 시 원화 가치 하락 압력', cycle: 'M' },
    { id: 'trade-balance', statCode: '111Y036', item1: '10101', name: '경상수지', unit: 'M$', category: 'domestic', impact: 'down', source: '한국은행', description: '경상수지 흑자 시 환율 하락 유도', cycle: 'M' }
];

async function fetchFromFred(seriesId) {
    return new Promise((resolve, reject) => {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=2&sort_order=desc`;
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
        // 주기에 맞춰 날짜 형식을 완전히 정적으로 맞추어 오류 방지
        let startDay, endDay;
        const currentYear = 2024; // 데이터가 확실히 존재하는 2024년 기준으로 일단 조회

        if (item.cycle === 'Q') {
            startDay = '20231';
            endDay = `${currentYear}4`;
        } else {
            startDay = '202301';
            endDay = `${currentYear}12`;
        }

        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_API_KEY}/json/kr/1/10/${item.statCode}/${item.cycle}/${startDay}/${endDay}/${item.item1}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row) {
                        resolve(json.StatisticSearch.row.reverse());
                    } else {
                        console.warn(`[ECOS Info] ${item.name} 데이터 없음: ${json.RESULT?.MESSAGE || 'Unknown'}`);
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

function calculateTrend(oldVal, newVal) {
    const v1 = parseFloat(oldVal);
    const v2 = parseFloat(newVal);
    if (isNaN(v1) || isNaN(v2)) return 'neutral';
    if (v2 > v1) return 'up';
    if (v2 < v1) return 'down';
    return 'neutral';
}

async function main() {
    console.log('🚀 시장 데이터 최종 연동 분석 시작...');
    const indicators = [];
    let upScore = 0, downScore = 0;

    // FRED (해외)
    for (const s of FRED_SERIES) {
        const obs = await fetchFromFred(s.id);
        if (obs.length > 0) {
            const val = obs[0].value;
            const trend = calculateTrend(obs[1]?.value, val);
            if (s.impact === 'up') trend === 'up' ? upScore++ : downScore++;
            else trend === 'up' ? downScore++ : upScore++;

            indicators.push({
                ...s, id: s.id.toLowerCase(), value: parseFloat(val).toLocaleString(), trend
            });
            console.log(`✅ [FRED] ${s.name}: ${val}`);
        }
    }

    // ECOS (국내)
    for (const item of ECOS_SERIES) {
        const rows = await fetchFromEcos(item);
        let val = '-', trend = 'neutral';
        if (rows && rows.length > 0) {
            const current = rows.find(r => parseFloat(r.DATA_VALUE) !== 0) || rows[0];
            val = current.DATA_VALUE;
            trend = calculateTrend(rows[rows.indexOf(current) + 1]?.DATA_VALUE, val);
            if (item.impact === 'up') trend === 'up' ? upScore += 1.2 : downScore += 1.2;
            else trend === 'up' ? downScore += 1.2 : upScore += 1.2;
            console.log(`✅ [ECOS] ${item.name}: ${val}`);
        } else {
            console.log(`⚠️ [ECOS] ${item.name} 응답 실패`);
        }

        indicators.push({
            ...item, value: isNaN(parseFloat(val)) ? val : parseFloat(val).toLocaleString(), trend
        });
    }

    // 예측
    const total = upScore + downScore;
    const upProb = Math.round((upScore / total) * 100);
    const downProb = 100 - upProb;
    let sentiment = '보통';
    if (upProb > 60) sentiment = '환율 상승 우세';
    else if (downProb > 60) sentiment = '환율 하락 우세';

    const dashboardData = {
        indicators,
        forecast: {
            sentiment, upProb, downProb,
            detailedAnalysis: `종합 지수 분석 결과 현재 시장은 ${sentiment} 상태입니다.`,
            score: { upScore, downScore }
        },
        lastUpdate: new Date().toLocaleString('ko-KR')
    };

    const outputPath = path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2));
    console.log('✨ 대시보드 데이터 수집 완료!');
}

main();
