import { useTheme } from '../contexts/ThemeContext';

interface GapRatioCardProps {
  current: number;
  average: number;
  isLoading?: boolean;
}

export function GapRatioCard({ current, average, isLoading }: GapRatioCardProps) {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <div className={`rounded-lg shadow-md p-6 animate-pulse ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className={`h-4 rounded w-1/3 mb-4 ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        }`}></div>
        <div className={`h-8 rounded w-1/2 ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        }`}></div>
      </div>
    );
  }

  const isAboveAverage = current > average;

  return (
    <div className={`rounded-lg shadow-md p-6 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    }`}>
      <h3 className={`text-lg font-semibold mb-4 ${
        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
      }`}>달러 갭 비율</h3>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {current.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
        </span>
        <span
          className={`text-sm font-medium ${
            isAboveAverage 
              ? (theme === 'dark' ? 'text-green-400' : 'text-green-600')
              : (theme === 'dark' ? 'text-red-400' : 'text-red-600')
          }`}
        >
          {isAboveAverage ? '↑' : '↓'} 52주 평균: {average.toLocaleString('ko-KR', {
            maximumFractionDigits: 2,
          })}
        </span>
      </div>
      <div className={`mt-4 text-xs ${
        theme === 'dark' ? 'text-gray-300' : 'text-gray-500'
      }`}>
        <p>달러 갭 비율 = (원/달러 환율) ÷ (달러 지수) × 100</p>
      </div>
    </div>
  );
}

