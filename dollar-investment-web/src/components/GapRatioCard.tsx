interface GapRatioCardProps {
  current: number;
  average: number;
  isLoading?: boolean;
}

export function GapRatioCard({ current, average, isLoading }: GapRatioCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  const isAboveAverage = current > average;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">달러 갭 비율</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">
          {current.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
        </span>
        <span
          className={`text-sm font-medium ${isAboveAverage ? 'text-green-600' : 'text-red-600'}`}
        >
          {isAboveAverage ? '↑' : '↓'} 52주 평균: {average.toLocaleString('ko-KR', {
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      <div className="mt-4 text-xs text-gray-500">
        <p>달러 갭 비율 = (원/달러 환율) ÷ (달러 지수) × 100</p>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
        <p>📊 계산값: 환율과 달러 지수를 기반으로 자동 계산</p>
      </div>
    </div>
  );
}

