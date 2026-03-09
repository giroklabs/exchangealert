import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { fetchMarketDashboardData } from '../services/marketDashboardService';
import type { DashboardData, MarketIndicator } from '../types';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';

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

            {/* 시장 향방 예측 섹션 */}
            <div className={`p-8 rounded-3xl border shadow-xl ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700' : 'bg-gradient-to-br from-blue-50 to-white border-blue-100'}`}>
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 w-full space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🎯</span>
                            <h3 className={`text-2xl font-black ${theme === 'dark' ? 'text-blue-400' : 'text-blue-800'}`}>실시간 원/달러 환율 예측 모델</h3>
                        </div>

                        <div className="space-y-6">
                            <div className="flex justify-between items-end">
                                <span className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>시장 종합 심리</span>
                                <span className={`text-3xl font-black ${data?.forecast?.sentiment === '환율 상승 우세' ? 'text-red-500' : data?.forecast?.sentiment === '환율 하락 우세' ? 'text-blue-500' : 'text-gray-500'}`}>
                                    {data?.forecast?.sentiment || '분석 중...'}
                                </span>
                            </div>

                            <div className="relative pt-1">
                                <div className="flex mb-2 items-center justify-between font-bold text-xs uppercase">
                                    <span className="text-blue-500">▼ 하락 요인 ({data?.forecast?.downProb}%)</span>
                                    <span className="text-red-500">▲ 상승 요인 ({data?.forecast?.upProb}%)</span>
                                </div>
                                <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-gray-200 dark:bg-gray-700">
                                    <div style={{ width: `${data?.forecast?.downProb || 50}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-1000"></div>
                                    <div style={{ width: `${data?.forecast?.upProb || 50}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-red-500 transition-all duration-1000"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="hidden lg:flex w-48 h-48 items-center justify-center rounded-full border-8 border-gray-100 dark:border-gray-700 relative overflow-hidden">
                        <div className={`absolute bottom-0 w-full bg-blue-500 transition-all duration-1000`} style={{ height: `${data?.forecast?.downProb || 0}%`, opacity: 0.3 }}></div>
                        <div className={`absolute top-0 w-full bg-red-500 transition-all duration-1000`} style={{ height: `${data?.forecast?.upProb || 0}%`, opacity: 0.3 }}></div>
                        <div className="z-10 text-center">
                            <div className="text-sm font-bold text-gray-400">종합 점수</div>
                            <div className={`text-4xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                {Math.max(data?.forecast?.upProb || 0, data?.forecast?.downProb || 0)}%
                            </div>
                        </div>
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
                <div className={`p-6 mb-8 rounded-2xl ${theme === 'dark' ? 'bg-indigo-900/20' : 'bg-indigo-50 border border-indigo-100 shadow-inner'}`}>
                    <h3 className={`text-lg font-bold mb-3 flex items-center gap-2 ${theme === 'dark' ? 'text-indigo-200' : 'text-indigo-900'}`}>
                        <span>🤖</span> Gemini AI 심층 시장 분석
                    </h3>
                    <p className={`text-md leading-relaxed ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                        {data?.forecast?.detailedAnalysis}
                    </p>
                </div>
                <h3 className={`text-xl font-bold mb-6 mt-8 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
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
    const chartColor = isImpactUp ? '#ef4444' : isImpactDown ? '#3b82f6' : '#9ca3af';

    return (
        <div className={`p-5 rounded-2xl transition-all duration-300 border-2 hover:scale-[1.01] ${theme === 'dark'
            ? 'bg-gray-800/40 border-gray-700 hover:border-gray-500'
            : 'bg-white border-gray-50 hover:border-blue-100 shadow-sm hover:shadow-md'
            }`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mb-2 inline-block ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'
                        }`}>
                        {indicator.source}
                    </span>
                    <h4 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{indicator.name}</h4>
                    <p className={`text-xs leading-relaxed mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {indicator.description}
                    </p>
                </div>
                <div className="text-right min-w-[100px]">
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

            {/* 미니 차트 (Sparkline) */}
            {indicator.history && indicator.history.length > 0 && (
                <div className="mt-4 h-16 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={indicator.history}>
                            <defs>
                                <linearGradient id={`gradient-${indicator.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: theme === 'dark' ? '#1f2937' : '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '10px',
                                    padding: '4px 8px'
                                }}
                                itemStyle={{ color: chartColor, fontWeight: 'bold' }}
                                labelStyle={{ display: 'none' }}
                                cursor={{ stroke: theme === 'dark' ? '#374151' : '#e5e7eb', strokeWidth: 1 }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={chartColor}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill={`url(#gradient-${indicator.id})`}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                animationDuration={1500}
                            />
                            <YAxis hide domain={['auto', 'auto']} />
                            <XAxis hide dataKey="date" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {!indicator.history && (
                <div className="mt-4 h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${isImpactUp ? 'bg-red-500 w-2/3' : isImpactDown ? 'bg-blue-500 w-1/3' : 'bg-gray-400 w-1/2'
                        }`}></div>
                </div>
            )}
        </div>
    );
}
