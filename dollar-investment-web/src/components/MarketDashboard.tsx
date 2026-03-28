import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { fetchMarketDashboardData } from '../services/marketDashboardService';
import { fetchAllCurrentExchangeRates, fetchLastUpdateTime } from '../services/exchangeRateService';
import type { DashboardData, MarketIndicator, MajorRate } from '../types';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { UnifiedFXChart } from './UnifiedFXChart';

export function MarketDashboard({ initialData = null, isLoadingExternal = false }: { initialData?: DashboardData | null, isLoadingExternal?: boolean }) {
    const { theme } = useTheme();
    const [data, setData] = useState<DashboardData | null>(initialData);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [isChartExpanded, setIsChartExpanded] = useState(true);

    useEffect(() => {
        if (initialData) {
            setData(initialData);
            setIsLoading(isLoadingExternal);
        }
    }, [initialData, isLoadingExternal]);

    useEffect(() => {
        const loadData = async () => {
            // App에서 데이터를 넘겨주지 않았을 때만 자체 로드
            if (data) return;

            setIsLoading(true);
            try {
                // 1. 대시보드 기본 데이터 로드 (금리, AI 분석 등)
                const result = await fetchMarketDashboardData();

                // 2. 최신 환율 데이터 로드 및 시간 동기화
                try {
                    const [currentRates, updateTime] = await Promise.all([
                        fetchAllCurrentExchangeRates(),
                        fetchLastUpdateTime()
                    ]);

                    if (result.majorRates && result.majorRates.length > 0) {
                        const updatedMajorRates = result.majorRates.map(rate => {
                            const curUnit = rate.id.split('-')[0].toUpperCase();
                            const latest = currentRates.find(r => r.cur_unit === curUnit);
                            if (latest) {
                                return {
                                    ...rate,
                                    value: latest.deal_bas_r
                                };
                            }
                            return rate;
                        });
                        result.majorRates = updatedMajorRates;
                    }
                    if (updateTime) {
                        result.lastUpdate = updateTime;
                    }
                } catch (e) {
                    console.warn('최신 환율/시간 동기화 실패:', e);
                }

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


    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 주요국 실시간 환율 카드 */}
            {data?.majorRates && data.majorRates.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {data.majorRates.map((rate) => (
                        <MajorRateCard key={rate.id} rate={rate} theme={theme} />
                    ))}
                </div>
            )}

            {/* 통합 환율 분석 차트 (접기 기능 포함) */}
            <div className={`rounded-2xl shadow-xl border overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <button
                    onClick={() => setIsChartExpanded(!isChartExpanded)}
                    className={`w-full px-6 py-4 flex items-center justify-between font-bold text-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${theme === 'dark' ? 'text-white border-b border-gray-700' : 'text-gray-800 border-b border-gray-100'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <span>📈</span>
                        <span>원/달러 환율 실시간 통합 분석</span>
                    </div>
                    <div className="flex items-center gap-3">
                        {isChartExpanded ? (
                            <span className="text-xs font-medium text-gray-400">숨기기</span>
                        ) : (
                            <span className="text-xs font-medium text-blue-500 animate-pulse">상세 데이터 보기</span>
                        )}
                        <span className={`transform transition-transform duration-300 ${isChartExpanded ? 'rotate-180' : ''}`}>
                            ▼
                        </span>
                    </div>
                </button>
                <div className={`transition-all duration-500 ease-in-out ${isChartExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    <div className="p-1">
                        <UnifiedFXChart isEmbedded={true} />
                    </div>
                </div>
            </div>

            {/* 시장 향방 예측 섹션 */}
            <div className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="flex-1 w-full space-y-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🎯</span>
                            <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>실시간 원/달러 환율 예측 모델</h3>
                        </div>

                        <div className="space-y-6">
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                            {/* 환율 예측 섹션 */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <span className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>💱 환율 방향 예측</span>
                                    <span className={`text-2xl font-black ${data?.forecast?.sentiment === '환율 상승 우세' ? 'text-red-500' : data?.forecast?.sentiment === '환율 하락 우세' ? 'text-blue-500' : 'text-gray-500'}`}>
                                        {data?.forecast?.sentiment || '분석 중...'}
                                    </span>
                                </div>

                                <div className="relative pt-1">
                                    <div className="flex mb-2 items-center justify-between font-bold text-xs uppercase">
                                        <span className="text-blue-500 font-bold text-xs">▼ 하락 요인 ({data?.forecast?.downProb}%)</span>
                                        <span className="text-red-500 font-bold text-xs">▲ 상승 요인 ({data?.forecast?.upProb}%)</span>
                                    </div>
                                    <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-gray-200 dark:bg-gray-700">
                                        <div style={{ width: `${data?.forecast?.downProb || 50}%` }} className="flex-shrink-0 h-full bg-blue-400 transition-all duration-1000"></div>
                                        <div style={{ width: `${data?.forecast?.upProb || 50}%` }} className="flex-shrink-0 h-full bg-red-400 transition-all duration-1000"></div>
                                    </div>
                                </div>
                            </div>

                            {/* 코스피 예측 섹션 (신규) */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <span className={`text-lg font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>📈 KOSPI 방향 예측</span>
                                    <span className={`text-2xl font-black ${data?.forecast?.kospiUpProb && data.forecast.kospiUpProb > 55 ? 'text-red-500' : data?.forecast?.kospiUpProb && data.forecast.kospiUpProb < 45 ? 'text-blue-500' : 'text-gray-500'}`}>
                                        {data?.forecast?.kospiUpProb ? (data.forecast.kospiUpProb > 55 ? '상승 우세' : data.forecast.kospiUpProb < 45 ? '하락 우세' : '보합세') : '분석 중...'}
                                    </span>
                                </div>

                                <div className="relative pt-1">
                                    <div className="flex mb-2 items-center justify-between font-bold text-xs uppercase">
                                        <span className="text-blue-500 font-bold text-xs">▼ 하락 요인 ({data?.forecast?.kospiDownProb || 50}%)</span>
                                        <span className="text-red-500 font-bold text-xs">▲ 상승 요인 ({data?.forecast?.kospiUpProb || 50}%)</span>
                                    </div>
                                    <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-gray-200 dark:bg-gray-700">
                                        <div style={{ width: `${data?.forecast?.kospiDownProb || 50}%` }} className="flex-shrink-0 h-full bg-blue-400 transition-all duration-1000"></div>
                                        <div style={{ width: `${data?.forecast?.kospiUpProb || 50}%` }} className="flex-shrink-0 h-full bg-red-400 transition-all duration-1000"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>

                </div>

                {/* Gemini AI 심층 시장 분석 영역 */}
                <div className={`mt-8 p-8 rounded-2xl border-l-4 shadow-sm transition-all duration-300 ${theme === 'dark'
                    ? 'bg-yellow-900/10 border-l-yellow-600 border-y-gray-700 border-r-gray-700'
                    : 'bg-yellow-50/30 border-l-yellow-500 border-y-yellow-100/50 border-r-yellow-100/50 shadow-inner'
                    }`}>
                    <div className="flex items-center gap-3 mb-6">
                        <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-600'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <h3 className={`text-xl font-black flex items-center gap-3 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-900'}`}>
                            Gemini AI 심층 시장 분석
                            {data?.forecast?.lastAiUpdate && (
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-yellow-400/10 text-yellow-500/80' : 'bg-yellow-100/50 text-yellow-700/70'}`}>
                                    분석 기준: {new Date(data.forecast.lastAiUpdate).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </h3>
                    </div>

                    <div className={`text-left space-y-4`}>
                        {data?.forecast?.aiAnalysis ? (
                            (() => {
                                const renderLineWithBold = (text: string) => {
                                    const parts = text.split(/(\*\*.*?\*\*)/g);
                                    return parts.map((part, index) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                            return <strong key={index} className="font-black text-yellow-600 dark:text-yellow-400">{part.slice(2, -2)}</strong>;
                                        }
                                        return part;
                                    });
                                };

                                return data.forecast.aiAnalysis.split('\n').map((line, i) => {
                                    const trimmedLine = line.trim();
                                    if (!trimmedLine) return <div key={i} className="h-2"></div>;

                                    // 섹션 헤더 처리 [파트A: ...]
                                    if (trimmedLine.startsWith('[파트') || (trimmedLine.startsWith('[') && trimmedLine.endsWith(']'))) {
                                        return (
                                            <div key={i} className="mt-8 mb-4">
                                                <h4 className={`text-lg font-black flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                                    <span className="w-1.5 h-6 bg-yellow-500 rounded-full shadow-[0_0_10px_rgba(234,179,8,0.5)]"></span>
                                                    {trimmedLine.replace(/[\[\]]/g, '')}
                                                </h4>
                                            </div>
                                        );
                                    }

                                    // 실전 투자 대응 섹션 헤더
                                    if (trimmedLine.startsWith('실전 투자 대응:')) {
                                        return (
                                            <div key={i} className={`mt-10 mb-6 p-4 rounded-xl flex items-center gap-3 ${theme === 'dark' ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-900'
                                                }`}>
                                                <span className="text-2xl">🎯</span>
                                                <span className="font-black text-lg tracking-tight">실전 투자 대응 가이드</span>
                                            </div>
                                        );
                                    }

                                    // 목록 항목 처리 (- 환율:, - 코스피:)
                                    if (trimmedLine.startsWith('- ')) {
                                        return (
                                            <div key={i} className={`ml-1 mb-4 p-5 rounded-2xl flex items-start gap-4 transition-all hover:shadow-lg ${
                                                theme === 'dark' ? 'bg-gray-800/80 text-gray-200 border border-gray-700/50' : 'bg-white text-gray-800 shadow-sm border border-gray-100'
                                            }`}>
                                                <div className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                                                <p className="text-[15px] leading-[1.6] font-medium">
                                                    {renderLineWithBold(trimmedLine.slice(2))}
                                                </p>
                                            </div>
                                        );
                                    }

                                    // 하위 호환성 (결론:, 환율 대응:, 코스피 대응: 등으로 시작하는 경우 강조)
                                    if (trimmedLine.startsWith('결론:') || trimmedLine.startsWith('환율 대응:') || trimmedLine.startsWith('코스피 대응:')) {
                                        return (
                                            <div key={i} className={`mt-4 p-5 rounded-2xl font-bold flex items-center gap-4 border ${
                                                theme === 'dark' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30' : 'bg-yellow-100 text-yellow-900 border-yellow-200/50'
                                            }`}>
                                                <span className="text-xl">💡</span>
                                                <span className="leading-relaxed">{renderLineWithBold(trimmedLine)}</span>
                                            </div>
                                        );
                                    }

                                    return (
                                        <p key={i} className={`text-[15px] leading-[1.8] font-medium tracking-tight whitespace-pre-wrap mb-4 px-1 ${
                                            theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                        }`}>
                                            {renderLineWithBold(trimmedLine)}
                                        </p>
                                    );
                                });
                            })()
                        ) : (
                            <p className="text-gray-400 italic">분석 데이터를 불러오는 중입니다...</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. 금리·달러 블록 */}
                <section className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">🏛️</span>
                        <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>금리·달러 블록</h2>
                    </div>
                    <p className="text-xs text-gray-400 mb-4 px-1">캐리 수익률 및 글로벌 달러 사이클 (환율 결정 1순위)</p>
                    <div className="grid grid-cols-1 gap-4">
                        {data?.indicators.filter(i => i.block === 'rates-dollar').map((indicator) => (
                            <IndicatorCard key={indicator.id} indicator={indicator} theme={theme} />
                        ))}
                    </div>
                </section>

                {/* 2. 리스크 블록 */}
                <section className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">⚠️</span>
                        <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>리스크 블록</h2>
                    </div>
                    <p className="text-xs text-gray-400 mb-4 px-1">시장 공포지수 및 안전자산 선호 심리 (변동성 전이)</p>
                    <div className="grid grid-cols-1 gap-4">
                        {data?.indicators.filter(i => i.block === 'risk').map((indicator) => (
                            <IndicatorCard key={indicator.id} indicator={indicator} theme={theme} />
                        ))}
                    </div>
                </section>

                {/* 3. 한국 자산 블록 */}
                <section className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">🇰🇷</span>
                        <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>한국 자산 블록</h2>
                    </div>
                    <p className="text-xs text-gray-400 mb-4 px-1">국내 증시 성과 및 외국인 자본 유출입 현황</p>
                    <div className="grid grid-cols-1 gap-4">
                        {data?.indicators.filter(i => i.block === 'assets').map((indicator) => (
                            <IndicatorCard key={indicator.id} indicator={indicator} theme={theme} />
                        ))}
                    </div>
                </section>

                {/* 4. 펀딩·정책 블록 */}
                <section className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl">🛡️</span>
                        <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>펀딩·정책 블록</h2>
                    </div>
                    <p className="text-xs text-gray-400 mb-4 px-1">실물 경제지표 및 외환 당국 개입 환경</p>
                    <div className="grid grid-cols-1 gap-4">
                        {data?.indicators.filter(i => i.block === 'funding-policy').map((indicator) => (
                            <IndicatorCard key={indicator.id} indicator={indicator} theme={theme} />
                        ))}
                    </div>
                </section>
            </div>

            {/* 하단 요약 가이드 */}
            <div className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <h3 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    📊 지표 해석 가이드
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
                    <div className="space-y-3">
                        <h4 className="font-bold text-gray-900 dark:text-gray-100 font-bold">환율 상승 요인 (원화 약세)</h4>
                        <ul className={`space-y-2 list-disc list-inside ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            <li>미국 기준금리 인상 (달러 강세)</li>
                            <li>미국 주요 경제지표(고용, CPI) 호조</li>
                            <li>VIX 공포지수 상승 (시장 불안정성 및 달러 선호)</li>
                            <li>엔/달러 환율 상승 (엔화 약세 동조)</li>
                             <li>외국인 국내 증권투자 순매도 전환 (자본 유출)</li>
                             <li>투자자예탁금 감소 (시장 유동성 축소)</li>

                            <li>국제 유가 상승 및 글로벌 리스크 확산</li>
                        </ul>
                    </div>
                    <div className="space-y-3">
                        <h4 className="font-bold text-gray-600 dark:text-gray-300">환율 하락 요인 (원화 강세)</h4>
                        <ul className={`space-y-2 list-disc list-inside ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                            <li>한국 기준금리 인상 (원화 가치 증가)</li>
                            <li>무역수지 흑자 기록 (달러 유입)</li>
                             <li>외국인 국내 증권투자 순매수 확대 (자본 유입)</li>
                             <li>투자자예탁금 증가 (시장 유동성 공급)</li>

                            <li>국내 경제성장률(GDP) 전망 호조</li>
                            <li>미국 금리 인하 기대감 형성</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

function IndicatorCard({ indicator, theme }: { indicator: MarketIndicator, theme: string }) {
    const isImpactUp = indicator.realizedImpact === 'up';
    const isImpactDown = indicator.realizedImpact === 'down';
    const chartColor = isImpactUp ? '#ef4444' : isImpactDown ? '#3b82f6' : '#9ca3af';

    return (
        <div className={`p-5 rounded-2xl transition-all duration-300 border hover:scale-[1.01] shadow-md hover:shadow-xl ${theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-100'
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
                    <div className={`flex items-center justify-end gap-1 text-xs font-bold mt-1 ${isImpactUp ? 'text-red-500' : isImpactDown ? 'text-blue-500' : 'text-gray-400'}`}>
                        <span>시장 영향:</span>
                        <span className="text-sm">
                            {(indicator.realizedImpact === 'up' || isImpactUp) ? '▲ 상승' : (indicator.realizedImpact === 'down' || isImpactDown) ? '▼ 하락' : '─ 중립'}
                            {indicator.realizedImpact === 'neutral' ? ' (보합)' : ''}
                        </span>
                    </div>
                </div>
            </div>

            {/* 미니 차트 (Sparkline) */}
            {indicator.history && indicator.history.length > 0 && (
                <div className="mt-4 h-16 w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
                                    border: theme === 'dark' ? '1px solid #374151' : '1px solid #f3f4f6',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    padding: '8px',
                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                                }}
                                itemStyle={{ color: chartColor, fontWeight: 'bold', fontSize: '12px' }}
                                labelStyle={{ 
                                    color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                                    marginBottom: '4px',
                                    fontSize: '10px'
                                }}
                                cursor={{ stroke: theme === 'dark' ? '#4b5563' : '#e5e7eb', strokeWidth: 1 }}
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
                    <div className={`h-full rounded-full ${isImpactUp ? 'bg-red-500 w-2/3' : isImpactDown ? 'bg-gray-800 dark:bg-gray-200 dark:text-black w-1/3' : 'bg-gray-400 w-1/2'
                        }`}></div>
                </div>
            )}
        </div>
    );
}

function MajorRateCard({ rate, theme }: { rate: MajorRate, theme: string }) {
    const isUp = rate.trend === 'up';
    const isDown = rate.trend === 'down';

    return (
        <div className={`p-4 rounded-2xl transition-all duration-300 border hover:scale-[1.02] shadow-md hover:shadow-xl ${theme === 'dark'
            ? 'bg-gray-800 border-gray-700'
            : 'bg-white border-gray-100'
            }`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">{rate.flag}</span>
                <div className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${isUp
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : isDown
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                    <span>{isUp ? '▲' : isDown ? '▼' : '─'}</span>
                    <span>{rate.changePercent}%</span>
                </div>
            </div>
            <div>
                <h4 className={`text-xs font-bold mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                    {rate.name}
                </h4>
                <div className="flex items-baseline gap-1">
                    <span className={`text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {rate.value}
                    </span>
                    <span className={`text-[10px] font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                        {rate.unit}
                    </span>
                </div>
            </div>
        </div>
    );
}
