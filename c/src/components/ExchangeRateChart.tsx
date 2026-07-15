import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

interface ExchangeRateChartProps {
  data: Array<{ date: string; rate: number }>;
  average?: number;
  isLoading?: boolean;
}

export function ExchangeRateChart({ data, average, isLoading }: ExchangeRateChartProps) {
  const { theme } = useTheme();
  if (isLoading) {
    return (
      <div className={`rounded-2xl shadow-xl border p-6 animate-pulse ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
        }`}>
        <div className={`h-6 rounded w-1/3 mb-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
        <div className={`h-[300px] rounded mb-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
        <div className="space-y-2">
          <div className={`h-3 rounded w-1/2 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
          <div className={`h-3 rounded w-1/3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={`rounded-2xl shadow-xl border p-6 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <h3 className="text-lg font-semibold text-gray-700 mb-4">환율 추이 (52주)</h3>
        <p className="text-gray-500">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  // 차트 데이터 포맷팅 (날짜를 간단하게 표시)
  const chartData = data.map((item) => ({
    date: new Date(item.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
    fullDate: item.date,
    rate: item.rate,
  }));

  return (
    <div className={`rounded-2xl shadow-xl border p-6 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
      <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>원/달러 환율 추이 (52주)</h3>
      <ResponsiveContainer width="100%" height={300} minWidth={0}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
          <XAxis
            dataKey="date"
            stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'}
            fontSize={12}
            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
          />
          <YAxis
            stroke={theme === 'dark' ? '#9ca3af' : '#6b7280'}
            fontSize={12}
            tick={{ fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }}
            domain={[(dataMin: number) => Math.floor(dataMin - 50), (dataMax: number) => Math.ceil(dataMax + 50)]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme === 'dark' ? '#1f2937' : '#fff',
              border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
              borderRadius: '8px',
              padding: '8px'
            }}
            itemStyle={{ color: '#3b82f6' }}
            formatter={(value: number) => [`${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`, '환율']}
            labelFormatter={(label) => `날짜: ${label}`}
          />
          {average && (
            <ReferenceLine
              y={average}
              stroke="#22c55e"
              strokeDasharray="5 5"
              label={{
                value: `52주 평균: ${average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`,
                position: 'right',
                fill: theme === 'dark' ? '#4ade80' : '#16a34a',
                fontSize: 10
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="rate"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className={`mt-4 text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
        <p>📊 기간: 최근 52주 (영업일 기준)</p>
        <p>📈 파란색 선: 원/달러 환율, 초록색 점선: 52주 평균</p>
      </div>
    </div>
  );
}

