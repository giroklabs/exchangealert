/**
 * 시장 대시보드 데이터 수집 및 예측 모델 생성 스크립트
 * FRED API 및 한국은행 ECOS API를 통해 경제 지표를 수집하고 환율 향방을 분석합니다.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRED_API_KEY = process.env.FRED_API_KEY || '0a8892024728a9a0fa015e609cd5d232';
const ECOS_API_KEY = process.env.ECOS_API_KEY;

// 1. 수집할 FRED 시리즈 (해외)
const FRED_SERIES = [
    { id: 'FEDFUNDS', name: '미국 기준금리(Fed)', unit: '%', category: 'international', impact: 'up', source: 'Federal Reserve', description: 'Fed 금리 인상 시 달러 가치 상승으로 원/달러 환율 상승' },
    { id: 'PAYEMS', name: '미 비농업고용지수', unit: 'K', category: 'international', impact: 'up', source: 'BLS', description: '미국 고용 지표 점진적 호조 시 달러 선호 현상 강화' },
    { id: 'DEXJPUS', name: '엔/달러 환율', unit: '¥', category: 'international', impact: 'up', source: 'Market', description: '엔화 약세 시 아시아 통화 동반 약세로 환율 상승 경향' },
    { id: 'DCOILWTICO', name: '국제 유가(WTI)', unit: '$', category: 'international', impact: 'up', source: 'WTI', description: '유가 상승 시 달러 결제 수요 증가 및 물가 압박으로 환율 상승' },
    { id: 'CPIAUCSL', name: '미 소비자물가(CPI)', unit: '%', category: 'international', impact: 'up', source: 'BLS', description: '미국 물가 상승 시 금리 인상 기대감으로 달러 강세 유발' },
    { id: 'GDP', name: '미국 GDP', unit: 'B$', category: 'international', impact: 'up', source: 'BEA', description: '미국 경제 성장 호조 시 달러 가치 상승으로 환율 상승' }
];

// 2. 수집할 ECOS 시리즈 (국내)
const ECOS_SERIES = [
    { id: 'bok-rate', statCode: '722Y001', item1: '0101000', name: '한국 기준금리', unit: '%', category: 'domestic', impact: 'down', source: '한국은행', description: '금리 인상 시 원화 수요 증가로 환율 하락, 인하 시 상승', cycle: 'M' },
    { id: 'kr-cpi', statCode: '901Y009', item1: '0', name: '국내 소비자물가(CPI)', unit: '%', category: 'domestic', impact: 'up', source: '통계청', description: '한국 물가가 미국보다 상대적으로 높을 경우 원화 가치 하락', cycle: 'M' },
    { id: 'kr-gdp', statCode: '200Y005', item1: '10101', name: '경제성장률', unit: '%', category: 'domestic', impact: 'down', source: '한국은행', description: '경제 성장 호조 시 외국인 투자 유입으로 원화 강세 유도', cycle: 'Q' },
    { id: 'm2-supply', statCode: '101Y001', item1: 'BBHS01', name: '통화량(M2)', unit: '조원', category: 'domestic', impact: 'up', source: '한국은행', description: '과도한 통화 팽창 시 인플레 우려로 원화 가치 하락(환율 상승)', cycle: 'M' },
    { id: 'trade-balance', statCode: '111Y036', item1: '10101', name: '경상수지', unit: 'M$', category: 'domestic', impact: 'down', source: '한국은행', description: '경상수지 흑자(수출>수입) 시 달러 공급 증가로 환율 하락', cycle: 'M' }
];

async function fetchFromFred(seriesId) {
    return new Promise((resolve, reject) => {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=2&sort_order=desc`; // 2개 가져와서 트렌드 분석

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.observations && json.observations.length > 0) {
                        resolve(json.observations);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function fetchFromEcos(item) {
    if (!ECOS_API_KEY) return null;

    return new Promise((resolve, reject) => {
        const today = new Date();
        const year = today.getFullYear();
        let startDay, endDay;

        // 주기별 날짜 형식 맞춤
        if (item.cycle === 'M') {
            startDay = `${year - 1}01`;
            endDay = `${year}12`;
        } else if (item.cycle === 'Q') {
            startDay = `${year - 1}1`;
            endDay = `${year}4`;
        } else {
            startDay = `${year - 1}0101`;
            endDay = `${year}1231`;
        }

        const url = `https://ecos.bok.or.kr/api/StatisticSearch/${ECOS_API_KEY}/json/kr/1/10/${item.statCode}/${item.cycle}/${startDay}/${endDay}/${item.item1}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row && json.StatisticSearch.row.length > 0) {
                        resolve(json.StatisticSearch.row.reverse());
                    } else if (json.RESULT && json.RESULT.MESSAGE) {
                        console.warn(`[ECOS API Info] ${item.name}: ${json.RESULT.MESSAGE}`);
                        resolve(null);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
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
    console.log('🚀 시장 데이터 수집 및 예측 모델 분석 시작...');

    const indicators = [];
    let upScore = 0;
    let downScore = 0;

    // 1. FRED 데이터 (해외)
    for (const series of FRED_SERIES) {
        try {
            const obs = await fetchFromFred(series.id);
            if (obs && obs.length > 0) {
                const currentVal = obs[0].value;
                const prevVal = obs.length > 1 ? obs[1].value : currentVal;
                const trend = calculateTrend(prevVal, currentVal);

                // 예측 점수 계산
                // impact 'up'인 지표가 상승세면 환율 상승(+)
                // impact 'up'인 지표가 하락세면 환율 하락(-)
                if (series.impact === 'up') {
                    if (trend === 'up') upScore += 1;
                    else if (trend === 'down') downScore += 1;
                } else {
                    if (trend === 'up') downScore += 1;
                    else if (trend === 'down') upScore += 1;
                }

                indicators.push({
                    id: series.id.toLowerCase(),
                    name: series.name,
                    category: series.category,
                    value: isNaN(parseFloat(currentVal)) ? currentVal : parseFloat(currentVal).toLocaleString(),
                    unit: series.unit,
                    trend: trend,
                    impact: series.impact,
                    description: series.description,
                    source: series.source
                });
                console.log(`✅ ${series.name} 완료: ${currentVal} (${trend})`);
            }
        } catch (e) {
            console.error(`❌ ${series.name} 실패: ${e.message}`);
        }
    }

    // 2. ECOS 데이터 수집 (국내)
    for (const item of ECOS_SERIES) {
        try {
            const rows = await fetchFromEcos(item);
            let currentVal = '-';
            let trend = 'neutral';

            if (rows && rows.length > 0) {
                currentVal = rows[0].DATA_VALUE;
                const prevVal = rows.length > 1 ? rows[1].DATA_VALUE : currentVal;
                trend = calculateTrend(prevVal, currentVal);

                if (item.impact === 'up') {
                    if (trend === 'up') upScore += 1.2;
                    else if (trend === 'down') downScore += 1.2;
                } else {
                    if (trend === 'up') downScore += 1.2;
                    else if (trend === 'down') upScore += 1.2;
                }
            }

            indicators.push({
                id: item.id,
                name: item.name,
                category: item.category,
                value: isNaN(parseFloat(currentVal)) ? currentVal : parseFloat(currentVal).toLocaleString(),
                unit: item.unit,
                trend: trend,
                impact: item.impact,
                description: item.description,
                source: item.source
            });
            if (rows) console.log(`✅ ${item.name} 완료: ${currentVal} (${trend})`);
            else console.log(`⚠️ ${item.name} 응답 없음/실패`);

        } catch (e) {
            console.error(`❌ ${item.name} 에러: ${e.message}`);
            // 에러 발생 시에도 빈 카드 추가
            indicators.push({
                id: item.id,
                name: item.name,
                category: item.category,
                value: '-',
                unit: item.unit,
                trend: 'neutral',
                impact: item.impact,
                description: item.description,
                source: item.source
            });
        }
    }

    // 3. 예측 요약 생성
    const totalScore = upScore + downScore;
    const upProb = Math.round((upScore / totalScore) * 100);
    const downProb = 100 - upProb;

    let sentiment = '보통';
    let detailedAnalysis = '시장 지표들이 엇갈리며 횡보 가능성이 높습니다.';

    if (upProb > 60) {
        sentiment = '환율 상승 우세';
        detailedAnalysis = '미국 금리 및 경제지표 호조와 국내 통화량 증가 요인이 겹치며 달러 강세 압력이 높습니다.';
    } else if (downProb > 60) {
        sentiment = '환율 하락 우세';
        detailedAnalysis = '국내 금리 인상 기조와 무역수지 흑자 전환 등 원화 강세 요인이 시장을 주도하고 있습니다.';
    }

    const dashboardData = {
        indicators: indicators,
        forecast: {
            sentiment,
            upProb,
            downProb,
            detailedAnalysis,
            score: { upScore, downScore }
        },
        lastUpdate: new Date().toLocaleString('ko-KR')
    };

    const outputPath = path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2));

    console.log(`✨ 분석 완료 및 저장: ${sentiment} (${upProb}% vs ${downProb}%)`);
}

main();
