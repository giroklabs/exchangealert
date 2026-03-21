import { useState, useEffect, useMemo, useRef } from 'react';
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import {
    fetchFXHistoryData,
    fetchFXIntradayData,
    fetchFX6mHistoryData,
    type FXHistoryData,
    type FXIntradayData,
    type FX6mHistoryResponse
} from '../services/fxHistoryService';

type Period = '1D' | '1W' | '1M' | '1Y' | 'ALL';

interface ChartDataItem {
    label: string;
    rate: number;
    ma5?: number | null;
    ma20?: number | null;
    ma60?: number | null;
    fullDate: string;
    timestamp?: number;
}

export function UnifiedFXChart({ isEmbedded = false }: { isEmbedded?: boolean }) {
    const { theme } = useTheme();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [historyData, setHistoryData] = useState<FXHistoryData[]>([]);
    const [intradayData, setIntradayData] = useState<FXIntradayData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('1D');
    const [visibleLines, setVisibleLines] = useState({
        ma5: true,
        ma20: true,
        ma60: false
    });
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [chartScale, setChartScale] = useState(1.0);

    useEffect(() => {
        const loadAllData = async () => {
            setIsLoading(true);
            try {
                const [history, intraday] = await Promise.all([
                    fetchFXHistoryData(),
                    fetchFXIntradayData()
                ]);
                setHistoryData(history);
                setIntradayData(intraday);
            } catch (error) {
                console.error('Error loading chart data:', error);
            } finally {
                setIsLoading(false);
            }
        };
        loadAllData();
        const interval = setInterval(loadAllData, 1 * 60 * 1000); // 1분 주기로 정밀 동기화
        return () => clearInterval(interval);
    }, [period]);

    // 1D 모드일 때 최신 데이터(오른쪽)로 자동 스크롤
    useEffect(() => {
        if (!isLoading && period === '1D' && scrollContainerRef.current) {
            const container = scrollContainerRef.current;
            
            const performScroll = () => {
                if (container) {
                    container.scrollLeft = container.scrollWidth;
                }
            };

            // 차트 렌더링 완료 후 너비 계산이 끝날 수 있도록 처리
            performScroll();
            const timeoutId = setTimeout(performScroll, 300); // 300ms 지연 후 재시도
            return () => clearTimeout(timeoutId);
        }
    }, [isLoading, period, intradayData]);

    const customTicks = useMemo(() => {
        if (period !== '1D' || !intradayData.length) return undefined;
        
        const containerWidth = Math.max(800, intradayData.length * 10 * chartScale);
        const tickGap = 50; 
        const maxTicks = Math.floor(containerWidth / tickGap);
        const step = Math.max(1, Math.floor(intradayData.length / maxTicks));
        
        const ticks = [];
        let lastDate = -1;
        let lastTickIndex = -100;

        for (let i = 0; i < intradayData.length; i++) {
            const d = intradayData[i];
            const day = new Date(d.timestamp).getDate();
            
            if (day !== lastDate) {
                ticks.push(d.timestamp);
                lastDate = day;
                lastTickIndex = i;
            } else if (i - lastTickIndex >= step) {
                ticks.push(d.timestamp);
                lastTickIndex = i;
            }
        }
        return ticks;
    }, [intradayData, period, chartScale]);

    const chartData = useMemo<ChartDataItem[]>(() => {
        if (period === '1D') {
            return intradayData.map((d) => {
                return {
                    label: d.time,
                    rate: d.rate,
                    fullDate: d.fullTime,
                    timestamp: d.timestamp
                };
            });
        }

        if (!historyData.length) return [];

        let filtered = [...historyData];
        const lastDate = new Date(historyData[historyData.length - 1].date);

        if (period === '1W') {
            const oneWeekAgo = new Date(lastDate);
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            filtered = historyData.filter(item => new Date(item.date) >= oneWeekAgo);
        } else if (period === '1M') {
            const oneMonthAgo = new Date(lastDate);
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            filtered = historyData.filter(item => new Date(item.date) >= oneMonthAgo);
        } else if (period === '1Y') {
            const oneYearAgo = new Date(lastDate);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            filtered = historyData.filter(item => new Date(item.date) >= oneYearAgo);
        }

        return filtered.map(item => ({
            label: new Date(item.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
            rate: item.rate,
            ma5: item.ma5,
            ma20: item.ma20,
            ma60: item.ma60,
            fullDate: item.date
        }));
    }, [period, historyData, intradayData]);

    const isDark = theme === 'dark';
    const gridColor = isDark ? '#374151' : '#f0f0f0';
    const textColor = isDark ? '#9ca3af' : '#6b7280';
    const accentColor = '#3b82f6';

    const getMinMax = () => {
        if (!chartData.length) return [0, 0];
        const values: number[] = [];
        chartData.forEach((d: ChartDataItem) => {
            values.push(d.rate);
            if (period !== '1D') {
                if (visibleLines.ma5 && d.ma5) values.push(d.ma5);
                if (visibleLines.ma20 && d.ma20) values.push(d.ma20);
                if (visibleLines.ma60 && d.ma60) values.push(d.ma60);
            }
        });
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min;
        return [Math.floor(min - range * 0.1), Math.ceil(max + range * 0.1)];
    };

    const [yMin, yMax] = getMinMax();

    if (isLoading) {
        return (
            <div className={`p-6 animate-pulse h-[500px] ${!isEmbedded ? `rounded-2xl shadow-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}` : ''}`}>
                <div className="h-6 rounded w-1/4 mb-6 bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-full rounded bg-gray-100 dark:bg-gray-800"></div>
            </div>
        );
    }

    // 데이터 포인트 개수에 따라 동적 너비 계산
    const dynamicWidth = period === '1D' 
        ? `max(100%, ${Math.max(800, chartData.length * 10 * chartScale)}px)` // 7일 데이터이므로 밀도를 약간 낮춤 (15px -> 10px)
        : (chartScale > 1.0 ? `${100 * chartScale}%` : '100%');

    return (
        <div className={`p-6 ${!isEmbedded ? `rounded-2xl shadow-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}` : ''}`}>
            <style>{`
                .chart-scrollbar::-webkit-scrollbar {
                    height: 6px;
                }
                .chart-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .chart-scrollbar::-webkit-scrollbar-thumb {
                    background: ${isDark ? '#4b5563' : '#d1d5db'};
                    border-radius: 10px;
                }
                .chart-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${isDark ? '#6b7280' : '#9ca3af'};
                }
            `}</style>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-2 px-1">
                    <span className={`text-[11px] font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        📊 기준 시각: {chartData.length > 0 ? chartData[chartData.length - 1].fullDate.split('+')[0].replace('T', ' ') : '-'}
                    </span>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl items-center gap-1">
                    {(['1D', '1W', '1M', '1Y', 'ALL'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p
                                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                        >
                            {p === '1D' ? '1일' : p === '1W' ? '1주' : p === '1M' ? '1개월' : p === '1Y' ? '1년' : '전체'}
                        </button>
                    ))}
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                    <div className="flex items-center gap-1 bg-gray-200/50 dark:bg-gray-800/50 rounded-lg px-1">
                        <button
                            onClick={() => setChartScale(prev => Math.max(0.5, prev - 0.2))}
                            className={`p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 transition-colors ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                            title="축소"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        <span className={`text-[10px] font-bold min-w-[24px] text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {Math.round(chartScale * 100)}%
                        </span>
                        <button
                            onClick={() => setChartScale(prev => Math.min(3.0, prev + 0.2))}
                            className={`p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-700 transition-colors ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                            title="확대"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    </div>
                    <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1"></div>
                    <button
                        onClick={() => setShowHistoryModal(true)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-gray-500 hover:text-blue-600 hover:bg-white dark:hover:bg-gray-700`}
                    >
                        환율정보 📋
                    </button>
                </div>
            </div>

            {/* 6개월 환율 히스토리 모달 */}
            {showHistoryModal && (
                <FXHistoryModal onClose={() => setShowHistoryModal(false)} />
            )}

            {period !== '1D' && (
                <div className="mb-6 flex flex-wrap gap-4 text-[11px] font-medium">
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={visibleLines.ma5}
                            onChange={() => setVisibleLines(v => ({ ...v, ma5: !v.ma5 }))}
                            className="rounded border-gray-300 text-red-500 focus:ring-red-500 w-3.5 h-3.5"
                        />
                        <span className="text-red-500 opacity-80 group-hover:opacity-100 transition-opacity">MA5 (단기)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={visibleLines.ma20}
                            onChange={() => setVisibleLines(v => ({ ...v, ma20: !v.ma20 }))}
                            className="rounded border-gray-300 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                        />
                        <span className="text-orange-500 opacity-80 group-hover:opacity-100 transition-opacity">MA20 (중기)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={visibleLines.ma60}
                            onChange={() => setVisibleLines(v => ({ ...v, ma60: !v.ma60 }))}
                            className="rounded border-gray-300 text-green-500 focus:ring-green-500 w-3.5 h-3.5"
                        />
                        <span className="text-green-500 opacity-80 group-hover:opacity-100 transition-opacity">MA60 (장기)</span>
                    </label>
                </div>
            )}

            <div 
                ref={scrollContainerRef}
                className="h-[350px] w-full overflow-x-auto overflow-y-hidden chart-scrollbar"
            >
                <div style={{ width: dynamicWidth, height: '100%', minHeight: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        {period === '1D' ? (
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRateUni" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={accentColor} stopOpacity={0.2} />
                                        <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis
                                    dataKey="timestamp"
                                    ticks={customTicks}
                                    tickFormatter={(val) => {
                                        const dObj = new Date(val);
                                        const day = dObj.getDate();
                                        const isFirstOfDay = intradayData.find(d => new Date(d.timestamp).getDate() === day)?.timestamp === val;
                                        if (isFirstOfDay) return `${dObj.getMonth() + 1}/${day}`;
                                        const item = intradayData.find(d => d.timestamp === val);
                                        return item ? item.time : `${dObj.getHours()}:${dObj.getMinutes()}`;
                                    }}
                                    stroke={textColor}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    domain={[yMin, yMax]}
                                    orientation="right"
                                    stroke={textColor}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => v.toLocaleString()}
                                    width={45} // Y축 너비 고정
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                                        border: 'none',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                        color: isDark ? '#ffffff' : '#000000'
                                    }}
                                    labelFormatter={(val) => {
                                        const dItem = chartData.find(d => d.timestamp === val);
                                        return dItem ? dItem.fullDate : val;
                                    }}
                                    formatter={(value: number) => [`${value.toLocaleString()} 원`, '환율']}
                                    labelStyle={{ color: textColor, marginBottom: '4px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="rate"
                                    stroke={accentColor}
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorRateUni)"
                                    isAnimationActive={true}
                                />
                            </AreaChart>
                        ) : (
                            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                                <XAxis
                                    dataKey="label"
                                    stroke={textColor}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={40}
                                />
                                <YAxis
                                    domain={[yMin, yMax]}
                                    orientation="right"
                                    stroke={textColor}
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => v.toLocaleString()}
                                    width={45}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: isDark ? '#1f2937' : '#ffffff',
                                        border: 'none',
                                        borderRadius: '12px',
                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                        color: isDark ? '#ffffff' : '#000000'
                                    }}
                                    formatter={(value: number) => [`${value.toLocaleString()} 원`, '']}
                                    labelStyle={{ color: textColor, marginBottom: '4px' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="rate"
                                    stroke={accentColor}
                                    strokeWidth={3}
                                    dot={false}
                                    isAnimationActive={true}
                                />
                                {visibleLines.ma5 && (
                                    <Line type="monotone" dataKey="ma5" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                                )}
                                {visibleLines.ma20 && (
                                    <Line type="monotone" dataKey="ma20" stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                                )}
                                {visibleLines.ma60 && (
                                    <Line type="monotone" dataKey="ma60" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
                                )}
                            </LineChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>

            <div className={`mt-6 p-4 rounded-xl text-[11px] leading-relaxed italic ${isDark ? 'bg-gray-900/50 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                {period === '1D' ? (
                    <p>📍 <b>Tip:</b> 최근 7일간의 실시간 환율 변화를 보여줍니다. 그래프를 좌우로 드래그하여 과거 데이터를 확인할 수 있습니다.</p>
                ) : (
                    <p>💡 <b>Tip:</b> 이동평균선은 가격 추세를 보여줍니다. 단기평균선(MA5)이 장기평균선(MA60)을 상향 돌파하면 강세 신호로 해석되기도 합니다.</p>
                )}
            </div>
        </div>
    );
}

function FXHistoryModal({ onClose }: { onClose: () => void }) {
    const { theme } = useTheme();
    const [history, setHistory] = useState<FX6mHistoryResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            const data = await fetchFX6mHistoryData();
            setHistory(data);
            setIsLoading(false);
        };
        load();
    }, []);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            <div
                className={`w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={`p-6 border-b flex justify-between items-center ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
                    <div className="flex flex-col">
                        <h2 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>📅 최근 6개월 환율 일간 최고/최저</h2>
                        <p className="text-xs text-gray-500 mt-1">데이터 업데이트: {history?.lastUpdate ? new Date(history.lastUpdate).toLocaleString() : '-'}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors font-bold">✕</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0 px-1">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : !history || !history.data.length ? (
                        <div className="text-center py-20 text-gray-500">환율 이력 데이터를 불러올 수 없습니다.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                                <tr className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
                                    <th className={`p-4 text-xs font-bold uppercase ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>날짜</th>
                                    <th className={`p-4 text-xs font-bold uppercase text-red-500 text-right`}>최고가 (High)</th>
                                    <th className={`p-4 text-xs font-bold uppercase text-blue-500 text-right`}>최저가 (Low)</th>
                                    <th className={`p-4 text-xs font-bold uppercase ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} text-right`}>종가 (Close)</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700/50' : 'divide-gray-50'}`}>
                                {history.data.map((item, idx) => (
                                    <tr key={`${item.date}-${idx}`} className={`${theme === 'dark' ? 'hover:bg-gray-700/30' : 'hover:bg-gray-50/50'} transition-colors`}>
                                        <td className={`p-4 text-sm font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {item.date}
                                        </td>
                                        <td className="p-4 text-sm font-bold text-red-400 text-right">
                                            {item.high?.toLocaleString() ?? '-'}원
                                        </td>
                                        <td className="p-4 text-sm font-bold text-blue-400 text-right">
                                            {item.low?.toLocaleString() ?? '-'}원
                                        </td>
                                        <td className={`p-4 text-sm font-bold text-right ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {item.close?.toLocaleString() ?? '-'}원
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                
                <div className={`p-6 border-t text-center text-[11px] text-gray-400 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
                    야후 파이낸스(Yahoo Finance) 데이터를 바탕으로 매일 오전 9시에 업데이트됩니다.
                </div>
            </div>
        </div>
    );
}
