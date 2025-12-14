interface GapRatioCardProps {
  current: number;
  average: number;
  isLoading?: boolean;
}

export function GapRatioCard({ current, average, isLoading }: GapRatioCardProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-gray-700 rounded w-1/2"></div>
      </div>
    );
  }

  const isAboveAverage = current > average;

  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">달러 갭 비율</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-white">
          {current.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
        </span>
        <span
          className={`text-sm font-medium ${isAboveAverage ? 'text-green-400' : 'text-red-400'}`}
        >
          {isAboveAverage ? '↑' : '↓'} 52주 평균: {average.toLocaleString('ko-KR', {
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      <div className="mt-4 text-xs text-gray-300">
        <p>달러 갭 비율 = (원/달러 환율) ÷ (달러 지수) × 100</p>
      </div>
    </div>
  );
}

