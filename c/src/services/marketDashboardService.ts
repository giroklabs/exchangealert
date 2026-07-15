import type { DashboardData, MarketIndicator } from '../types';

/**
 * 시장 대시보드 데이터 서비스
 * 원/달러 환율에 영향을 미치는 국내외 주요 지표들을 제공합니다.
 */
export const fetchMarketDashboardData = async (): Promise<DashboardData> => {
    try {
        const baseUrl = import.meta.env.BASE_URL || '/';
        const url = `${baseUrl}data/market-dashboard.json?t=${Date.now()}`;

        const response = await fetch(url);
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.warn('실시간 대시보드 데이터 로드 실패, 기본 데이터를 사용합니다:', error);
    }

    // 기본 데이터 (FallBack)
    const indicators: MarketIndicator[] = [
        {
            id: 'bok-rate',
            name: '한국 기준금리',
            category: 'domestic',
            value: '3.50',
            unit: '%',
            trend: 'neutral',
            impact: 'down',
            description: '금리 인상 시 원화 수요 증가로 환율 하락, 인하는 상승',
            source: '한국은행'
        },
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
            id: 'us-nonfarm',
            name: '미 비농업고용지수',
            category: 'international',
            value: '-',
            unit: '',
            trend: 'up',
            impact: 'up',
            description: '미국 고용 지표 점진적 호조 시 달러 선호 현상 강화',
            source: 'BLS'
        }
    ];

    return {
        indicators,
        lastUpdate: new Date().toLocaleString('ko-KR')
    };
};
