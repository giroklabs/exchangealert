import { useState, useEffect } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

import { fetchFXHistoryData, type FXHistoryData } from '../services/fxHistoryService';

export function AdvancedFXChart() {
    const { theme } = useTheme();
    const [data, setData] = useState<FXHistoryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [period, setPeriod] = useState<'1M' | '1Y' | 'ALL'>('1Y');
    const [visibleLines, setVisibleLines] = useState({
        rate: true,
        ma5: true,
        ma20: true,
        ma60: false
    });

    useEffect(() => {
        const loadHistory = async () => {
            const history = await fetchFXHistoryData();
            setData(history);
            setIsLoading(false);
        };
        loadHistory();
    }, []);

    const getFilteredData = () => {
        if (!data.length) return [];

        let filtered = [...data];
        const lastDate = new Date(data[data.length - 1].date);

        if (period === '1M') {
            const oneMonthAgo = new Date(lastDate);
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            filtered = data.filter(item => new Date(item.date) >= oneMonthAgo);
        } else if (period === '1Y') {
            const oneYearAgo = new Date(lastDate);
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
            filtered = data.filter(item => new Date(item.date) >= oneYearAgo);
        }

        return filtered.map(item => ({
            ...item,
            formattedDate: new Date(item.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
        }));
    };

    const filteredData = getFilteredData();

    if (isLoading) {
        return (
            <div className={`rounded-2xl shadow-xl border p-6 animate-pulse ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="h-6 rounded w-1/4 mb-6 bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-[400px] rounded bg-gray-100 dark:bg-gray-800"></div>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl shadow-xl border p-6 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className={`text-xl font-bold ${theme === 'dark' ? 'text-gray-100' : 'text-gray-800'}`}>
                        원/달러 환율 심층 분석
                    </h3>
                    <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                        실시간 환율 데이터 기반 이동평균선 분석
                    </p>
                </div>

                <div className="flex gap-2">
                    {(['1M', '1Y', 'ALL'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === p
                                ? 'bg-blue-500 text-white'
                                : theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {p === '1M' ? '1개월' : p === '1Y' ? '1년' : '전체'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-4 text-xs font-medium">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={visibleLines.ma5}
                        onChange={() => setVisibleLines(v => ({ ...v, ma5: !v.ma5 }))}
                        className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-red-500">MA5 (단기)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={visibleLines.ma20}
                        onChange={() => setVisibleLines(v => ({ ...v, ma20: !v.ma20 }))}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-orange-500">MA20 (중기)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={visibleLines.ma60}
                        onChange={() => setVisibleLines(v => ({ ...v, ma60: !v.ma60 }))}
                        className="rounded border-gray-300 text-green-500 focus:ring-green-500"
                    />
                    <span className="text-green-500">MA60 (장기)</span>
                </label>
            </div>

            <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#374151' : '#f0f0f0'} />
                        <XAxis
                            dataKey="formattedDate"
                            stroke={theme === 'dark' ? '#6b7280' : '#9ca3af'}
                            fontSize={11}
                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={30}
                        />
                        <YAxis
                            stroke={theme === 'dark' ? '#6b7280' : '#9ca3af'}
                            fontSize={11}
                            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
                            axisLine={false}
                            tickLine={false}
                            domain={['dataMin - 10', 'dataMax + 10']}
                            orientation="right"
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: theme === 'dark' ? '#1f2937' : '#fff',
                                border: 'none',
                                borderRadius: '12px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                padding: '12px'
                            }}
                            labelStyle={{ color: theme === 'dark' ? '#fff' : '#000', fontWeight: 'bold', marginBottom: '4px' }}
                            formatter={(value: number) => [`${value.toLocaleString()}원`, '']}
                        />
                        <Line
                            type="monotone"
                            dataKey="rate"
                            name="현재가"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                            isAnimationActive={true}
                        />
                        {visibleLines.ma5 && (
                            <Line
                                type="monotone"
                                dataKey="ma5"
                                name="MA5"
                                stroke="#ef4444"
                                strokeWidth={1.5}
                                dot={false}
                                strokeDasharray="3 3"
                            />
                        )}
                        {visibleLines.ma20 && (
                            <Line
                                type="monotone"
                                dataKey="ma20"
                                name="MA20"
                                stroke="#f97316"
                                strokeWidth={1.5}
                                dot={false}
                                strokeDasharray="3 3"
                            />
                        )}
                        {visibleLines.ma60 && (
                            <Line
                                type="monotone"
                                dataKey="ma60"
                                name="MA60"
                                stroke="#22c55e"
                                strokeWidth={1.5}
                                dot={false}
                                strokeDasharray="3 3"
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className={`mt-4 p-4 rounded-xl text-xs leading-relaxed ${theme === 'dark' ? 'bg-gray-900/50 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                <p>💡 <b>Tip:</b> 이동평균선은 가격 추세를 보여줍니다. 단기평균선(MA5)이 장기평균선(MA60)을 상향 돌파하면 강세 신호로 해석되기도 합니다.</p>
            </div>
        </div>
    );
}
