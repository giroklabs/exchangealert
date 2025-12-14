import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface ExchangeRateChartProps {
  data: Array<{ date: string; rate: number }>;
  average?: number;
  isLoading?: boolean;
}

export function ExchangeRateChart({ data, average, isLoading }: ExchangeRateChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
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
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">원/달러 환율 추이 (52주)</h3>
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
            domain={['dataMin - 50', 'dataMax + 50']}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#fff', 
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '8px'
            }}
            formatter={(value: number) => [`${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}`, '환율']}
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
            dataKey="rate" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 text-xs text-gray-400">
        <p>📊 기간: 최근 52주 (영업일 기준)</p>
        <p>📈 파란색 선: 원/달러 환율, 초록색 점선: 52주 평균</p>
      </div>
    </div>
  );
}

