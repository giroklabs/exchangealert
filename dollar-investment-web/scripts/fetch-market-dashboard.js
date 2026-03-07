/**
 * 시장 대시보드 데이터 수집 스크립트
 * FRED API 및 한국은행 ECOS API를 통해 경제 지표를 수집합니다.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRED_API_KEY = process.env.FRED_API_KEY || '0a8892024728a9a0fa015e609cd5d232';
const ECOS_API_KEY = process.env.ECOS_API_KEY;

// 수집할 FRED 시리즈 ID 및 매핑
const FRED_SERIES = [
    { id: 'FEDFUNDS', name: '미국 기준금리(Fed)', unit: '%', category: 'international', impact: 'up', source: 'Federal Reserve', description: 'Fed 금리 인상 시 달러 가치 상승으로 원/달러 환율 상승' },
    { id: 'PAYEMS', name: '미 비농업고용지수', unit: 'K', category: 'international', impact: 'up', source: 'BLS', description: '미국 고용 지표 점진적 호조 시 달러 선호 현상 강화' },
    { id: 'DEXJPUS', name: '엔/달러 환율', unit: '¥', category: 'international', impact: 'up', source: 'Market', description: '엔화 약세 시 아시아 통화 동반 약세로 환율 상승 경향' },
    { id: 'DCOILWTICO', name: '국제 유가(WTI)', unit: '$', category: 'international', impact: 'up', source: 'WTI', description: '유가 상승 시 달러 결제 수요 증가 및 물가 압박으로 환율 상승' },
    { id: 'CPIAUCSL', name: '미 소비자물가(CPI)', unit: '%', category: 'international', impact: 'up', source: 'BLS', description: '미국 물가 상승 시 금리 인상 기대감으로 달러 강세 유발' },
    { id: 'GDP', name: '미국 GDP', unit: 'B$', category: 'international', impact: 'up', source: 'BEA', description: '미국 경제 성장 호조 시 달러 가치 상승으로 환율 상승' }
];

// 수집할 ECOS 통계표 및 항목 매핑
const ECOS_SERIES = [
    { id: 'bok-rate', statCode: '722Y001', item1: '0101000', name: '한국 기준금리', unit: '%', category: 'domestic', impact: 'down', source: '한국은행', description: '금리 인상 시 원화 수요 증가로 환율 하락, 인하 시 상승' },
    { id: 'kr-cpi', statCode: '901Y009', item1: '0', name: '국내 소비자물가(CPI)', unit: '%', category: 'domestic', impact: 'up', source: '통계청', description: '한국 물가가 미국보다 상대적으로 높을 경우 원화 가치 하락' },
    { id: 'kr-gdp', statCode: '200Y005', item1: '10101', name: 'GDP 성장률', unit: '%', category: 'domestic', impact: 'down', source: '한국은행', description: '경제 성장 호조 시 외국인 투자 유입으로 원화 강세 유도' },
    { id: 'm2-supply', statCode: '101Y003', item1: 'BBHS01', name: '통화량(M2)', unit: '', category: 'domestic', impact: 'up', source: '한국은행', description: '과도한 통화 팽창 시 인플레 우려로 원화 가치 하락(환율 상승)' },
    { id: 'trade-balance', statCode: '111Y036', item1: '10101', name: '경상수지', unit: 'M$', category: 'domestic', impact: 'down', source: '한국은행', description: '경상수지 흑자(수출>수입) 시 달러 공급 증가로 환율 하락' }
];

async function fetchFromFred(seriesId) {
    return new Promise((resolve, reject) => {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=1&sort_order=desc`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.observations && json.observations.length > 0) {
                        resolve(json.observations[0].value);
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
        const lastYear = new Date();
        lastYear.setFullYear(today.getFullYear() - 1);

        const endDay = today.toISOString().split('T')[0].replace(/-/g, '').substring(0, 6);
        const startDay = lastYear.toISOString().split('T')[0].replace(/-/g, '').substring(0, 6);

        // ECOS API URL (주기는 지표에 따라 다를 수 있으나 M 또는 Q가 일반적)
        const cycle = item.id === 'kr-gdp' ? 'Q' : 'M';
        const url = `http://ecos.bok.or.kr/api/StatisticSearch/${ECOS_API_KEY}/json/kr/1/1/${item.statCode}/${cycle}/${startDay}/${endDay}/${item.item1}`;

        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row && json.StatisticSearch.row.length > 0) {
                        resolve(json.StatisticSearch.row[0].DATA_VALUE);
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

async function main() {
    console.log('🚀 시장 대시보드 데이터 수집 시작...');

    const indicators = [];

    // 1. FRED 데이터 수집 (해외)
    for (const series of FRED_SERIES) {
        try {
            const value = await fetchFromFred(series.id);
            if (value !== null) {
                indicators.push({
                    id: series.id.toLowerCase(),
                    name: series.name,
                    category: series.category,
                    value: isNaN(parseFloat(value)) ? value : parseFloat(value).toLocaleString(),
                    unit: series.unit,
                    trend: 'neutral',
                    impact: series.impact,
                    description: series.description,
                    source: series.source
                });
                console.log(`✅ ${series.name} 수집 완료: ${value}`);
            }
        } catch (e) {
            console.error(`❌ ${series.name} 수집 실패: ${e.message}`);
        }
    }

    // 2. ECOS 데이터 수집 (국내)
    for (const item of ECOS_SERIES) {
        try {
            const value = await fetchFromEcos(item);
            if (value !== null) {
                indicators.push({
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    value: isNaN(parseFloat(value)) ? value : parseFloat(value).toLocaleString(),
                    unit: item.unit,
                    trend: 'neutral',
                    impact: item.impact,
                    description: item.description,
                    source: item.source
                });
                console.log(`✅ ${item.name} 수집 완료: ${value}`);
            } else {
                console.warn(`⚠️ ${item.name} 실시간 수집 실패.`);
                // 실패 시 기본값이라도 표시 (UI 유지용)
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
        } catch (e) {
            console.error(`❌ ${item.name} 수집 실패: ${e.message}`);
        }
    }

    // 3. 기타 정성적 요인 추가
    const extraInternational = [
        {
            id: 'foreign-investment',
            name: '외국인 증권투자',
            category: 'international',
            value: '순매수',
            unit: '',
            trend: 'up',
            impact: 'down',
            description: '외국인 주식 순매수 시 원화 수요 증가로 환율 하락',
            source: 'KRX'
        },
        {
            id: 'global-risk',
            name: '글로벌 리스크',
            category: 'international',
            value: '보통',
            unit: '',
            trend: 'neutral',
            impact: 'up',
            description: '지정학적 위기(전쟁 등) 시 안전자산 달러 선호로 환율 상승',
            source: 'Market'
        }
    ];

    const finalIndicators = [...indicators, ...extraInternational];

    const dashboardData = {
        indicators: finalIndicators,
        lastUpdate: new Date().toLocaleString('ko-KR')
    };

    const outputPath = path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dashboardData, null, 2));

    console.log(`✨ 데이터 저장 완료: ${outputPath}`);
}

main();
