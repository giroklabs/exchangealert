import { useState, useEffect } from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';
import { fetchFXIntradayData, type FXIntradayData } from '../services/fxHistoryService';

export function IntradayFXChart() {
    const { theme } = useTheme();
    const [data, setData] = useState<FXIntradayData[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const intraday = await fetchFXIntradayData();
            setData(intraday);
            setIsLoading(false);
        };
        loadData();

        // 실시간 업데이트 (10분마다)
        const interval = setInterval(loadData, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const isDark = theme === 'dark';
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    const textColor = isDark ? '#9ca3af' : '#6b7280';
    const lineColor = '#3b82f6'; // Bright blue for live data

    const getMinMax = () => {
        if (data.length === 0) return [0, 0];
        const rates = data.map(d => d.rate);
        const min = Math.min(...rates);
        const max = Math.max(...rates);
        const padding = (max - min) * 0.1 || 2;
        return [Math.floor(min - padding), Math.ceil(max + padding)];
    };

    const [yMin, yMax] = getMinMax();

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse h-80 flex items-center justify-center">
                <span className="text-gray-400">실시간 데이터 로드 중...</span>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                        실시간 원/달러 환율 추이 (24시간)
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        최근 24시간 동안의 15분 단위 변동 내역입니다.
                    </p>
                </div>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                        <defs>
                            <linearGradient id="colorRateLive" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                        <XAxis
                            dataKey="time"
                            stroke={textColor}
                            fontSize={11}
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                            minTickGap={30}
                        />
                        <YAxis
                            domain={[yMin, yMax]}
                            hide={true}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: isDark ? '#1f2937' : '#ffffff',
                                border: `1px solid ${gridColor}`,
                                borderRadius: '8px',
                                color: isDark ? '#ffffff' : '#000000'
                            }}
                            itemStyle={{ color: lineColor }}
                            labelStyle={{ color: textColor, marginBottom: '4px' }}
                            formatter={(value: number) => [`${value.toLocaleString()} 원`, '환율']}
                        />
                        <Area
                            type="monotone"
                            dataKey="rate"
                            stroke={lineColor}
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorRateLive)"
                            isAnimationActive={true}
                            animationDuration={1500}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-gray-400 dark:text-gray-500 italic">
                <span>📍 마지막 업데이트: {data.length > 0 ? data[data.length - 1].fullTime : '-'}</span>
            </div>
        </div>
    );
}
