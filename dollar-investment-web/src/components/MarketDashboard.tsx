import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { fetchMarketDashboardData } from '../services/marketDashboardService';
import type { DashboardData, MarketIndicator } from '../types';

export function MarketDashboard() {
    const { theme } = useTheme();
    const [data, setData] = useState<DashboardData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const result = await fetchMarketDashboardData();
                setData(result);
            } catch (error) {
                console.error('대시보드 데이터 로드 실패:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    const domesticIndicators = data?.indicators.filter(i => i.category === 'domestic') || [];
    const internationalIndicators = data?.indicators.filter(i => i.category === 'international') || [];

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8 animate-in fade-in duration-500">
            {/* 헤더 섹션 */}
            <div className="text-center mb-10">
                <h1 className={`text-4xl font-extrabold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    환율 시장 대시보드
                </h1>
                <p className={`text-lg ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                    원/달러 환율에 영향을 미치는 국내외 주요 경제 지표 현황
                </p>
                <div className="mt-4 inline-block px-4 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs text-gray-500">
                    최근 업데이트: {data?.lastUpdate}
                </div>
            </div>

            {/* 개요 안내 */}
            <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-blue-50/50 border-blue-100'
                }`}>
                <div className="flex items-start gap-4">
                    <span className="text-3xl">💡</span>
                    <div>
                        <h3 className={`font-bold mb-1 ${theme === 'dark' ? 'text-blue-300' : 'text-blue-800'}`}>환율 결정의 원리</h3>
                        <p className={`text-sm leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                            원/달러 환율은 수요와 공급에 의해 결정됩니다. 달러 수요가 늘어나거나 공급이 줄어들면 환율이 상승(원화 가치 하락)하고,
                            반대로 달러 공급이 늘거나 수요가 줄어들면 환율이 하락(원화 가치 상승)합니다.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 국내 요인 섹션 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🇰🇷</span>
                        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>국내 요인</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {domesticIndicators.map((indicator) => (
                            <IndicatorCard key={indicator.id} indicator={indicator} theme={theme} />
                        ))}
                    </div>
                </section>

                {/* 해외 요인 섹션 */}
                <section className="space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">🌎</span>
                        <h2 className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>해외 요인</h2>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {internationalIndicators.map((indicator) => (
                            <IndicatorCard key={indicator.id} indicator={indicator} theme={theme} />
                        ))}
                    </div>
                </section>
            </div>

            {/* 하단 요약 가이드 */}
            <div className={`p-8 rounded-3xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100 shadowed-lg'}`}>
                <h3 className={`text-xl font-bold mb-6 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    📊 지표 해석 가이드
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                    <div className="space-y-3">
                        <h4 className="font-bold text-red-500">환율 상승 요인 (원화 약세)</h4>
                        <ul className={`space-y-2 list-disc list-inside ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            <li>미국 기준금리 인상 (달러 강세)</li>
                            <li>미국 주요 경제지표(고용, CPI) 호조</li>
                            <li>엔/달러 환율 상승 (엔화 약세 동조)</li>
                            <li>국제 유가 상승 (달러 수요 증가)</li>
                            <li>글로벌 리스크 확산 (안전자산 선호)</li>
                        </ul>
                    </div>
                    <div className="space-y-3">
                        <h4 className="font-bold text-blue-500">환율 하락 요인 (원화 강세)</h4>
                        <ul className={`space-y-2 list-disc list-inside ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            <li>한국 기준금리 인상 (원화 가치 증가)</li>
                            <li>무역수지 흑자 기록 (달러 유입)</li>
                            <li>국내 경제성장률(GDP) 전망 호조</li>
                            <li>외국인 국내 증권투자 순매수 확대</li>
                            <li>미국 금리 인하 기대감 형성</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function IndicatorCard({ indicator, theme }: { indicator: MarketIndicator, theme: string }) {
    const isImpactUp = indicator.impact === 'up';
    const isImpactDown = indicator.impact === 'down';

    return (
        <div className={`p-5 rounded-2xl transition-all duration-300 border-2 hover:scale-[1.01] ${theme === 'dark'
                ? 'bg-gray-800/40 border-gray-700 hover:border-gray-500'
                : 'bg-white border-gray-50 hover:border-blue-100 shadow-sm hover:shadow-md'
            }`}>
            <div className="flex justify-between items-start mb-3">
                <div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mb-2 inline-block ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {indicator.source}
                    </span>
                    <h4 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{indicator.name}</h4>
                </div>
                <div className="text-right">
                    <div className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {indicator.value}{indicator.unit}
                    </div>
                    <div className={`flex items-center justify-end gap-1 text-xs font-bold mt-1 ${isImpactUp ? 'text-red-500' : isImpactDown ? 'text-blue-500' : 'text-gray-400'
                        }`}>
                        <span>환율 영향:</span>
                        <span className="text-sm">{isImpactUp ? '▲ 상승' : isImpactDown ? '▼ 하락' : '─'}</span>
                    </div>
                </div>
            </div>
            <p className={`text-xs leading-relaxed ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                {indicator.description}
            </p>
            {/* 미니 트렌드 바 (추후 데이터 연결용) */}
            <div className="mt-4 h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${isImpactUp ? 'bg-red-500 w-2/3' : isImpactDown ? 'bg-blue-500 w-1/3' : 'bg-gray-400 w-1/2'
                    }`}></div>
            </div>
        </div>
    );
}
