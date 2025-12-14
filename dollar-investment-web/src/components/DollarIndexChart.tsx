import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { DollarIndexData } from '../types';

interface DollarIndexChartProps {
  data: DollarIndexData | null;
  average?: number;
  isLoading?: boolean;
}

export function DollarIndexChart({ data, average, isLoading }: DollarIndexChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!data || !data.history || data.history.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">달러 지수 추이 (52주)</h3>
        <p className="text-gray-500">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  // 차트 데이터 포맷팅
  const chartData = data.history.map((item) => ({
    date: new Date(item.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
    fullDate: item.date,
    value: item.value,
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">달러 지수 추이 (52주)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280"
            fontSize={12}
            tick={{ fill: '#6b7280' }}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            tick={{ fill: '#6b7280' }}
            domain={['dataMin - 2', 'dataMax + 2']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px'
            }}
            formatter={(value: number) => [`${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`, '달러 지수']}
            labelFormatter={(label) => `날짜: ${label}`}
          />
          {average && (
            <ReferenceLine 
              y={average} 
              stroke="#22c55e" 
              strokeDasharray="5 5" 
              label={{ value: `52주 평균: ${average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`, position: 'right' }}
            />
          )}
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#8b5cf6" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 text-xs text-gray-400">
        <p>📊 기간: 최근 52주</p>
        <p>📈 보라색 선: 달러 지수, 초록색 점선: 52주 평균</p>
      </div>
    </div>
  );
}

