import { DashboardData, MarketIndicator } from '../types';

/**
 * 시장 대시보드 데이터 서비스
 * 원/달러 환율에 영향을 미치는 국내외 주요 지표들을 제공합니다.
 */
export const fetchMarketDashboardData = async (): Promise<DashboardData> => {
    // 실제 환경에서는 다양한 API(BOK ECOS, FRED, Investing.com 등)에서 데이터를 취합해야 합니다.
    // 현재는 사용자 요청에 따른 구조와 기본 데이터를 제공합니다.

    const indicators: MarketIndicator[] = [
        // 국내 요인 (Domestic)
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
        },
        {
            id: 'm2-supply',
            name: '통화량(M2)',
            category: 'domestic',
            value: '증가',
            unit: '',
            trend: 'up',
            impact: 'up',
            description: '과도한 통화 팽창은 인플레이션 우려로 원화 가치 하락 유발',
            source: '한국은행'
        },
        // 해외 요인 (International)
        {
            id: 'fed-rate',
            name: '미국 기준금리(Fed)',
            category: 'international',
            value: '5.25~5.50',
            unit: '%',
            trend: 'neutral',
            impact: 'up',
            description: 'Fed 금리 인상 시 달러 가치 상승으로 원/달러 환율 상승',
            source: 'Federal Reserve'
        },
        {
            id: 'us-nonfarm',
            name: '미 비농업고용지수',
            category: 'international',
            value: '호조',
            unit: '',
            trend: 'up',
            impact: 'up',
            description: '미국 고용 지표 점진적 호조 시 달러 선호 현상 강화',
            source: 'BLS'
        },
        {
            id: 'jpy-usd',
            name: '엔/달러 환율',
            category: 'international',
            value: '150.5',
            unit: '¥',
            trend: 'up',
            impact: 'up',
            description: '엔화 약세 시 아시아 통화 동반 약세로 환율 상승 경향',
            source: 'Market'
        },
        {
            id: 'foreign-stock',
            name: '외국인 증권투자',
            category: 'international',
            value: '순매수',
            unit: '',
            trend: 'up',
            impact: 'down',
            description: '외국인의 국내 주식 순매수 시 원화 수요가 늘어 환율 하락',
            source: 'KRX'
        },
        {
            id: 'oil-price',
            name: '국제 유가(WTI)',
            category: 'international',
            value: '79.2',
            unit: '$',
            trend: 'up',
            impact: 'up',
            description: '유가 상승 시 달러 결제 수요 증가 및 물가 압박으로 환율 상승',
            source: 'WTI'
        }
    ];

    return {
        indicators,
        lastUpdate: new Date().toLocaleString('ko-KR')
    };
};
