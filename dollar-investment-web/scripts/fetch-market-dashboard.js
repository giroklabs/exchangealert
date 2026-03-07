/**
 * 시장 대시보드 데이터 수집 스크립트
 * FRED API 및 기타 출처를 통해 경제 지표를 수집합니다.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRED_API_KEY = process.env.FRED_API_KEY || '0a8892024728a9a0fa015e609cd5d232';

// 수집할 FRED 시리즈 ID 및 매핑
const FRED_SERIES = [
    { id: 'FEDFUNDS', name: '미국 기준금리(Fed)', unit: '%', category: 'international', impact: 'up', source: 'Federal Reserve', description: 'Fed 금리 인상 시 달러 가치 상승으로 원/달러 환율 상승' },
    { id: 'PAYEMS', name: '미 비농업고용지수', unit: 'K', category: 'international', impact: 'up', source: 'BLS', description: '미국 고용 지표 점진적 호조 시 달러 선호 현상 강화' },
    { id: 'DEXJPUS', name: '엔/달러 환율', unit: '¥', category: 'international', impact: 'up', source: 'Market', description: '엔화 약세 시 아시아 통화 동반 약세로 환율 상승 경향' },
    { id: 'DCOILWTICO', name: '국제 유가(WTI)', unit: '$', category: 'international', impact: 'up', source: 'WTI', description: '유가 상승 시 달러 결제 수요 증가 및 물가 압박으로 환율 상승' },
    { id: 'CPIAUCSL', name: '미 소비자물가(CPI)', unit: '%', category: 'international', impact: 'up', source: 'BLS', description: '미국 물가 상승 시 금리 인상 기대감으로 달러 강세 유발' }
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

async function main() {
    console.log('🚀 시장 대시보드 데이터 수집 시작...');

    const indicators = [];

    // 1. FRED 데이터 수집
    for (const series of FRED_SERIES) {
        try {
            const value = await fetchFromFred(series.id);
            if (value !== null) {
                let formattedValue = value;
                // 특정 지표 포맷팅 (예: 고용지수는 전월 대비 변화량 등으로 계산 필요할 수 있으나 현재는 단순 값)
                if (series.id === 'PAYEMS') {
                    // 고용지수는 보통 천명 단위
                }

                indicators.push({
                    id: series.id.toLowerCase(),
                    name: series.name,
                    category: series.category,
                    value: parseFloat(value).toFixed(2),
                    unit: series.unit,
                    trend: 'neutral', // 추후 히스토리 비교로 구현 가능
                    impact: series.impact,
                    description: series.description,
                    source: series.source
                });
                console.log(`✅ ${series.name} 수집 완료: ${value}`);
            }
        } catch (e) {
            console.error(`❌ ${series.name} 수집 실패:`, e.message);
        }
    }

    // 2. 국내 데이터 (ECOS API 키가 없으므로 현재는 기본값 유지 또는 추후 확장)
    // 실제 운영 시에는 한국은행 오픈 API 키를 환경변수로 받아 처리해야 합니다.
    const domesticDefaults = [
        {
            id: 'bok-rate',
            name: '한국 기준금리',
            category: 'domestic',
            value: '3.50',
            unit: '%',
            trend: 'neutral',
            impact: 'down',
            description: '금리 인상 시 원화 수요 증가로 환율 하락, 인하 시 상승',
            source: '한국은행'
        },
        {
            id: 'kr-cpi',
            name: '국내 소비자물가(CPI)',
            category: 'domestic',
            value: '2.7',
            unit: '%',
            trend: 'up',
            impact: 'up',
            description: '한국 물가가 미국보다 상대적으로 높을 경우 원화 가치 하락',
            source: '통계청'
        },
        {
            id: 'kr-gdp',
            name: 'GDP 성장률',
            category: 'domestic',
            value: '2.4',
            unit: '%',
            trend: 'up',
            impact: 'down',
            description: '경제 성장 호조 시 외국인 투자 유입으로 원화 강세 유도',
            source: '한국은행'
        },
        {
            id: 'trade-balance',
            name: '무역수지',
            category: 'domestic',
            value: '흑자',
            unit: '',
            trend: 'up',
            impact: 'down',
            description: '경상수지 흑자(수출>수입) 시 달러 공급 증가로 환율 하락',
            source: '관세청'
        }
    ];

    const finalIndicators = [...domesticDefaults, ...indicators];

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
