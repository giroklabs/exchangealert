import { useState, useEffect, useMemo } from 'react';
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
    type FXHistoryData,
    type FXIntradayData
} from '../services/fxHistoryService';

type Period = '1D' | '1W' | '1M' | '1Y' | 'ALL';

interface ChartDataItem {
    label: string;
    rate: number;
    ma5?: number | null;
    ma20?: number | null;
    ma60?: number | null;
    fullDate: string;
}

export function UnifiedFXChart({ isEmbedded = false }: { isEmbedded?: boolean }) {
    const { theme } = useTheme();
    const [historyData, setHistoryData] = useState<FXHistoryData[]>([]);
    const [intradayData, setIntradayData] = useState<FXIntradayData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState<Period>('1D');
    const [visibleLines, setVisibleLines] = useState({
        ma5: true,
        ma20: true,
        ma60: false
    });

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
    }, []);

    const chartData = useMemo<ChartDataItem[]>(() => {
        if (period === '1D') {
            return intradayData.map(d => ({
                label: d.time,
                rate: d.rate,
                fullDate: d.fullTime
            }));
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

    return (
        <div className={`p-6 ${!isEmbedded ? `rounded-2xl shadow-xl border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}` : ''}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                </div>

                <div className="flex bg-gray-100 dark:bg-gray-900/50 p-1 rounded-xl">
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
                </div>
            </div>

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

            <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    {period === '1D' ? (
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorRateUni" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={accentColor} stopOpacity={0.2} />
                                    <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis
                                dataKey="label"
                                stroke={textColor}
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                domain={[yMin, yMax]}
                                orientation="right"
                                stroke={textColor}
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => v.toLocaleString()}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: isDark ? '#1f2937' : '#ffffff',
                                    border: 'none',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    color: isDark ? '#ffffff' : '#000000'
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
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                            <XAxis
                                dataKey="label"
                                stroke={textColor}
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                domain={[yMin, yMax]}
                                orientation="right"
                                stroke={textColor}
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => v.toLocaleString()}
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

            <div className={`mt-6 p-4 rounded-xl text-[11px] leading-relaxed italic ${isDark ? 'bg-gray-900/50 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                {period === '1D' ? (
                    <p>📍 마지막 업데이트: {chartData.length > 0 ? chartData[chartData.length - 1].fullDate : '-'}</p>
                ) : (
                    <p>💡 <b>Tip:</b> 이동평균선은 가격 추세를 보여줍니다. 단기평균선(MA5)이 장기평균선(MA60)을 상향 돌파하면 강세 신호로 해석되기도 합니다.</p>
                )}
            </div>
        </div>
    );
}
