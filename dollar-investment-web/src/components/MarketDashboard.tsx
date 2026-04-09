import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { fetchMarketDashboardData } from '../services/marketDashboardService';
import { fetchAllCurrentExchangeRates, fetchLastUpdateTime } from '../services/exchangeRateService';
import type { DashboardData, MarketIndicator, MajorRate } from '../types';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { TrendingUp, Target, ShieldCheck, AlertCircle, Compass, Globe, Copy, Twitter, Send, Check } from 'lucide-react';
import { UnifiedFXChart } from './UnifiedFXChart';

export function MarketDashboard({ initialData = null, isLoadingExternal = false }: { initialData?: DashboardData | null, isLoadingExternal?: boolean }) {
    const { theme } = useTheme();
    const [data, setData] = useState<DashboardData | null>(initialData);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [isChartExpanded, setIsChartExpanded] = useState(true);
    const [isPredictionExpanded, setIsPredictionExpanded] = useState(true);
    const [isCopied, setIsCopied] = useState(false);
    const handleCopy = () => {
        if (!data?.forecast?.aiAnalysis) return;
        const text = `🤖 달러 인베스트 AI 시장 분석\n\n${data.forecast.aiAnalysis}\n\n🌐 대시보드 확인: ${window.location.href}`;
        
        // 현대적인 Clipboard API 시도
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            }).catch(err => {
                console.error('Clipboard API 실패, 대체 방식 시도:', err);
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    };

    const fallbackCopy = (text: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('복사 실패:', err);
        }
        document.body.removeChild(textArea);
    };

    const handleShareTwitter = () => {
        if (!data?.forecast?.aiAnalysis) return;
        
        const analysis = data.forecast.aiAnalysis;
        const text = encodeURIComponent(`🤖 달러 인베스트 AI 분석\n\n${analysis}\n\n#환율 #코스피`);
        const url = encodeURIComponent(window.location.href);
        
        // 전체 본문 복사 시도 (붙여넣기용)
        handleCopy();
        
        window.open(`https://x.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    };

    const handleShareTelegram = () => {
        if (!data?.forecast?.aiAnalysis) return;
        // URL 길이 제한으로 인한 400 에러를 방지하기 위해 1000자로 조정 (안전 범위)
        const textToShare = data.forecast.aiAnalysis.length > 1000 
            ? data.forecast.aiAnalysis.slice(0, 1000) + "..."
            : data.forecast.aiAnalysis;
            
        const text = encodeURIComponent(`🤖 달러 인베스트 AI 시장 분석\n\n${textToShare}\n\n자세한 내용은 대시보드에서 확인하세요!`);
        const url = encodeURIComponent(window.location.href);
        window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    };

    const renderLineWithBold = (text: string) => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={index} className="font-black text-yellow-600 dark:text-yellow-400">{part.slice(2, -2)}</strong>;
            }
            return part;
        });
    };

    useEffect(() => {
        if (initialData) {
            setData(initialData);
            setIsLoading(isLoadingExternal);
        }
    }, [initialData, isLoadingExternal]);

    useEffect(() => {
        const loadData = async () => {
            if (data) return;
            setIsLoading(true);
            try {
                const result = await fetchMarketDashboardData();
                try {
                    const [currentRates, updateTime] = await Promise.all([
                        fetchAllCurrentExchangeRates(),
                        fetchLastUpdateTime()
                    ]);
                    if (result.majorRates && result.majorRates.length > 0) {
                        const updatedMajorRates = result.majorRates.map(rate => {
                            const curUnit = rate.id.split('-')[0].toUpperCase();
                            const latest = currentRates.find(r => r.cur_unit === curUnit);
                            if (latest) return { ...rate, value: latest.deal_bas_r };
                            return rate;
                        });
                        result.majorRates = updatedMajorRates;
                    }
                    if (updateTime) result.lastUpdate = updateTime;
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

            {/* 통합 환율 분석 차트 */}
            <div className={`rounded-2xl shadow-xl border overflow-hidden transition-all duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <button
                    onClick={() => setIsChartExpanded(!isChartExpanded)}
                    className={`w-full px-6 py-4 flex items-center justify-between font-bold text-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${theme === 'dark' ? 'text-white border-b border-gray-700' : 'text-gray-800 border-b border-gray-100'
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-slate-400" />
                        <span>환율 그래프</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`transform transition-transform duration-300 ${isChartExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </button>
                <div className={`transition-all duration-500 ease-in-out ${isChartExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    <div className="p-1">
                        <UnifiedFXChart isEmbedded={true} />
                    </div>
                </div>
            </div>

            {/* 시장 향방 예측 섹션 */}
            <div className={`rounded-2xl shadow-xl border transition-all duration-300 ${isPredictionExpanded ? 'overflow-visible' : 'overflow-hidden'} ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <button
                    onClick={() => setIsPredictionExpanded(!isPredictionExpanded)}
                    className={`w-full px-6 py-4 flex items-center justify-between font-bold text-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${theme === 'dark' ? 'text-white border-b border-gray-700' : 'text-gray-800 border-b border-gray-100'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <Target className="w-6 h-6 text-slate-400" />
                        <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>환율/코스피 예측모델</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`transform transition-transform duration-300 ${isPredictionExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                </button>

                <div className={`transition-all duration-500 ease-in-out ${isPredictionExpanded ? 'max-h-[20000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                            <div className="flex-1 w-full space-y-4">
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                                    {/* 환율 예측 */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <span className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>환율 방향 예측</span>
                                            <span className={`text-2xl font-black ${data?.forecast?.sentiment === '환율 상승 우세' ? 'text-red-500' : data?.forecast?.sentiment === '환율 하락 우세' ? 'text-blue-500' : 'text-gray-500'}`}>
                                                {data?.forecast?.sentiment || '분석 중...'}
                                            </span>
                                        </div>
                                        <div className="relative pt-1">
                                            <div className="flex mb-2 items-center justify-between text-xs font-semibold">
                                                <div className="text-blue-500">하락 {data?.forecast?.downProb ?? 50}%</div>
                                                <div className="text-red-500">상승 {data?.forecast?.upProb ?? 50}%</div>
                                            </div>
                                            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-gray-200 dark:bg-gray-700">
                                                <div style={{ width: `${data?.forecast?.downProb ?? 50}%` }} className="flex-shrink-0 h-full bg-blue-400 flex items-center justify-center text-[10px] text-white font-bold">{(data?.forecast?.downProb ?? 0) > 20 && `${data?.forecast?.downProb}%`}</div>
                                                <div style={{ width: `${data?.forecast?.upProb ?? 50}%` }} className="flex-shrink-0 h-full bg-red-400 flex items-center justify-center text-[10px] text-white font-bold">{(data?.forecast?.upProb ?? 0) > 20 && `${data?.forecast?.upProb}%`}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 코스피 예측 */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <span className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>KOSPI 방향 예측</span>
                                            <span className={`text-2xl font-black ${data?.forecast?.kospiUpProb && data.forecast.kospiUpProb > 55 ? 'text-red-500' : data?.forecast?.kospiUpProb && data.forecast.kospiUpProb < 45 ? 'text-blue-500' : 'text-gray-500'}`}>
                                                {data?.forecast?.kospiUpProb ? (data.forecast.kospiUpProb > 55 ? '상승 우세' : data.forecast.kospiUpProb < 45 ? '하락 우세' : '보합세') : '분석 중...'}
                                            </span>
                                        </div>
                                        <div className="relative pt-1">
                                            <div className="flex mb-2 items-center justify-between text-xs font-semibold">
                                                <div className="text-blue-500">하락 {data?.forecast?.kospiDownProb ?? 50}%</div>
                                                <div className="text-red-500">상승 {data?.forecast?.kospiUpProb ?? 50}%</div>
                                            </div>
                                            <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-gray-200 dark:bg-gray-700">
                                                <div style={{ width: `${data?.forecast?.kospiDownProb ?? 50}%` }} className="flex-shrink-0 h-full bg-blue-400 flex items-center justify-center text-[10px] text-white font-bold">{(data?.forecast?.kospiDownProb ?? 0) > 20 && `${data?.forecast?.kospiDownProb}%`}</div>
                                                <div style={{ width: `${data?.forecast?.kospiUpProb ?? 50}%` }} className="flex-shrink-0 h-full bg-red-400 flex items-center justify-center text-[10px] text-white font-bold">{(data?.forecast?.kospiUpProb ?? 0) > 20 && `${data?.forecast?.kospiUpProb}%`}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Gemini AI 심층 시장 분석 영역 */}
                        <div className={`mt-8 p-8 rounded-2xl border-l-4 shadow-sm transition-all duration-300 ${theme === 'dark'
                            ? 'bg-yellow-900/10 border-l-yellow-600 border-gray-700'
                            : 'bg-yellow-50/30 border-l-yellow-500 border-yellow-100/50'
                            }`}>
                            <div className="flex items-center justify-between gap-3 mb-6">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${theme === 'dark' ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-600'}`}>
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                    </div>
                                    <h3 className={`text-xl font-black flex items-center gap-3 ${theme === 'dark' ? 'text-yellow-400' : 'text-yellow-900'}`}>
                                        Gemini AI 심층 시장 분석
                                        {data?.forecast?.lastAiUpdate && (
                                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-yellow-400/10 text-yellow-500/80' : 'bg-yellow-100/50 text-yellow-700/70'}`}>
                                                분석 기준: {new Date(data.forecast.lastAiUpdate).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}
                                    </h3>
                                </div>

                                {/* 액션 버튼 바 */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCopy}
                                        title="분석 결과 복사"
                                        className={`p-2.5 rounded-xl transition-all duration-300 flex items-center gap-2 text-sm font-bold ${isCopied
                                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                                            : theme === 'dark' ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm border border-gray-100'
                                            }`}
                                    >
                                        {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        <span className="hidden sm:inline">{isCopied ? '복사됨!' : '본문 복사'}</span>
                                    </button>

                                    <div className={`w-px h-6 mx-1 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>

                                    <button
                                        onClick={handleShareTwitter}
                                        title="트위터 공유"
                                        className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 ${theme === 'dark' ? 'bg-gray-800 text-blue-400 hover:bg-blue-900/20' : 'bg-white text-blue-500 hover:bg-blue-50 shadow-sm border border-gray-100'}`}
                                    >
                                        <Twitter className="w-4 h-4 fill-current" />
                                    </button>

                                    <button
                                        onClick={handleShareTelegram}
                                        title="텔레그램 공유"
                                        className={`p-2.5 rounded-xl transition-all duration-300 hover:scale-110 ${theme === 'dark' ? 'bg-gray-800 text-sky-400 hover:bg-sky-900/20' : 'bg-white text-sky-500 hover:bg-sky-50 shadow-sm border border-gray-100'}`}
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="text-left space-y-4">
                                {data?.forecast?.aiAnalysis ? (
                                    data.forecast.aiAnalysis.split('\n').map((line, i) => {
                                        const trimmedLine = line.trim();
                                        if (!trimmedLine) return <div key={i} className="h-2"></div>;

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

                                        if (trimmedLine.startsWith('실전 투자 대응:')) {
                                            return (
                                                <div key={i} className={`mt-10 mb-6 p-4 rounded-xl flex items-center gap-3 ${theme === 'dark' ? 'bg-blue-900/40 text-blue-300' : 'bg-blue-100 text-blue-900'}`}>
                                                    <Target className="w-6 h-6 text-slate-400" />
                                                    <span className="font-black text-lg">실전 투자 대응 가이드</span>
                                                </div>
                                            );
                                        }

                                        if (trimmedLine.startsWith('- ')) {
                                            return (
                                                <div key={i} className={`ml-1 mb-4 p-5 rounded-2xl flex items-start gap-4 transition-all hover:shadow-lg ${theme === 'dark' ? 'bg-gray-800/80 text-gray-200 border border-gray-700/50' : 'bg-white text-gray-800 shadow-sm border border-gray-100'}`}>
                                                    <div className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                                                    <p className="text-[15px] leading-[1.6] font-medium">
                                                        {renderLineWithBold(trimmedLine.slice(2))}
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <p key={i} className={`text-[15px] leading-[1.8] font-medium tracking-tight whitespace-pre-wrap mb-4 px-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {renderLineWithBold(trimmedLine)}
                                            </p>
                                        );
                                    })
                                ) : (
                                    <p className="text-gray-400 italic">분석 데이터를 불러오는 중입니다...</p>
                                )}
                            </div>

                            {/* 과거 분석 기록 보기 영역 (비활성화)
                            <div className="mt-8 pt-6 border-t border-yellow-200/30 dark:border-gray-700/50">
                                <button
                                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                                    className={`flex items-center gap-2 text-sm font-bold transition-all px-4 py-2 rounded-xl ${theme === 'dark' ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-yellow-700 hover:bg-yellow-100'}`}
                                >
                                    <ClipboardList className="w-5 h-5 text-slate-400" />
                                    <span>{isHistoryOpen ? '과거 분석 기록 닫기' : 'Gemini 심층 분석 과거 이력 보기'}</span>
                                    <span className={`ml-1 transform transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`}>▼</span>
                                </button>

                                {isHistoryOpen && (
                                    <div className="mt-6 space-y-4 animate-in slide-in-from-top-4 duration-300 text-left">
                                        {isLoadingHistory ? (
                                            <div className="flex items-center gap-2 text-sm text-gray-500 italic p-4">
                                                <div className="animate-spin h-4 w-4 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
                                                이전 분석 기록을 불러오는 중...
                                            </div>
                                        ) : historyData.length > 0 ? (
                                            historyData.map((record, idx) => (
                                                <div key={idx} className={`p-6 rounded-2xl border transition-all ${theme === 'dark' ? 'bg-gray-900/40 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <h5 className={`font-bold ${theme === 'dark' ? 'text-yellow-500' : 'text-yellow-700'}`}>
                                                            📅 {record.date} AI 시장 분석 리포트
                                                        </h5>
                                                        {record.predicted?.overall_up !== undefined && (
                                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${record.predicted.overall_up > 50 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                {record.predicted.overall_up > 50 ? '상승 우세' : '하락 우세'} ({record.predicted.overall_up}%)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-sm leading-relaxed space-y-3 opacity-90">
                                                        {record.aiAnalysis ? record.aiAnalysis.split('\n').map((l: string, i: number) => {
                                                            const tl = l.trim();
                                                            if (!tl) return <div key={i} className="h-1"></div>;
                                                            if (tl.startsWith('[') || tl.startsWith('실전')) {
                                                                return <div key={i} className="font-bold text-gray-900 dark:text-white mt-4 mb-2">{tl}</div>;
                                                            }
                                                            return <p key={i} className={tl.startsWith('- ') ? 'ml-2 border-l-2 border-gray-200 dark:border-gray-700 pl-3 py-1 mb-2' : 'mb-2'}>
                                                                {renderLineWithBold(tl)}
                                                            </p>;
                                                        }) : <p className="text-gray-400 italic">분석 텍스트가 저장되지 않은 날짜입니다.</p>}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-10 text-gray-400 italic">저장된 분석 기록이 없습니다.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                            */}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 블록별 섹션 */}
                {['rates-dollar', 'risk', 'assets', 'funding-policy', 'global-indices'].map((blockId) => (
                    <section key={blockId} className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                        <div className="flex items-center gap-3 mb-4">
                            {blockId === 'rates-dollar' ? <Globe className="w-5 h-5 text-slate-400" /> : 
                             blockId === 'risk' ? <AlertCircle className="w-5 h-5 text-slate-400" /> : 
                             blockId === 'assets' ? <Compass className="w-5 h-5 text-slate-400" /> : 
                             blockId === 'global-indices' ? <TrendingUp className="w-5 h-5 text-slate-400" /> :
                             <ShieldCheck className="w-5 h-5 text-slate-400" />}
                            <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                {blockId === 'rates-dollar' ? '금리·달러 블록' : 
                                 blockId === 'risk' ? '리스크 블록' : 
                                 blockId === 'assets' ? '한국 자산 블록' : 
                                 blockId === 'global-indices' ? '글로벌 지수 블록' :
                                 '펀딩·정책 블록'}
                            </h2>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {data?.indicators.filter(i => i.block === blockId).map((indicator) => (
                                <IndicatorCard key={indicator.id} indicator={indicator} theme={theme} />
                            ))}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    );
}

function IndicatorCard({ indicator, theme }: { indicator: MarketIndicator, theme: string }) {
    const isImpactUp = indicator.realizedImpact === 'up';
    const isImpactDown = indicator.realizedImpact === 'down';
    const chartColor = isImpactUp ? '#ef4444' : isImpactDown ? '#3b82f6' : '#9ca3af';

    return (
        <div className={`p-5 rounded-2xl transition-all duration-300 border hover:scale-[1.01] shadow-md hover:shadow-xl ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mb-2 inline-block ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
                        {indicator.source}
                    </span>
                    <h4 className={`text-lg font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{indicator.name}</h4>
                    <p className={`text-xs leading-relaxed mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {indicator.description}
                    </p>
                </div>
                <div className="text-right min-w-[120px]">
                    <div className={`text-[22px] font-black leading-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {indicator.value}<span className="text-xs ml-0.5 font-bold opacity-60">{indicator.unit}</span>
                    </div>
                    {indicator.diffPercent !== undefined && indicator.diffPercent !== 0 && (
                        <div className={`text-xs font-bold mt-1 flex items-center justify-end gap-1 ${indicator.trend === 'up' ? 'text-red-500' : indicator.trend === 'down' ? 'text-blue-500' : 'text-gray-400'}`}>
                            {indicator.trend === 'up' ? '▲' : indicator.trend === 'down' ? '▼' : ''} 
                            {Math.abs(indicator.diffPercent).toFixed(2)}%
                        </div>
                    )}
                </div>
            </div>

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
                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                                }}
                            />
                            <Area type="monotone" dataKey="value" stroke={chartColor} strokeWidth={2} fill={`url(#gradient-${indicator.id})`} dot={false} />
                            <YAxis hide domain={['auto', 'auto']} />
                            <XAxis hide dataKey="date" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

function MajorRateCard({ rate, theme }: { rate: MajorRate, theme: string }) {
    const isUp = rate.trend === 'up';
    const isDown = rate.trend === 'down';

    return (
        <div className={`p-4 rounded-2xl transition-all duration-300 border hover:shadow-xl ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex justify-between items-start mb-2">
                <span className="text-2xl">{rate.flag}</span>
                <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${isUp ? 'bg-red-100 text-red-600' : isDown ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'}`}>
                    {rate.changePercent}%
                </div>
            </div>
            <h4 className="text-xs font-bold text-gray-500">{rate.name}</h4>
            <div className="text-lg font-black dark:text-white">{rate.value} <span className="text-[10px] font-normal text-gray-400">{rate.unit}</span></div>
        </div>
    );
}
