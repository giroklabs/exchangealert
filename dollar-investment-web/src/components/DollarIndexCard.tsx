import type { DollarIndexData } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface DollarIndexCardProps {
  data: DollarIndexData | null;
  average?: number;
  isLoading?: boolean;
}

export function DollarIndexCard({ data, average, isLoading }: DollarIndexCardProps) {
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

  if (!data) {
    return (
      <div className={`rounded-lg shadow-md p-6 ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      }`}>
        <h3 className={`text-lg font-semibold mb-2 ${
          theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
        }`}>달러 지수</h3>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const isBelowAverage = average ? data.current < average : false;

  return (
    <div className={`rounded-lg shadow-md p-6 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    }`}>
      <h3 className={`text-lg font-semibold mb-4 ${
        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
      }`}>달러 지수</h3>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {data.current.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
        </span>
        {average && (
          <span
            className={`text-sm font-medium ${
              isBelowAverage 
                ? (theme === 'dark' ? 'text-green-400' : 'text-green-600')
                : (theme === 'dark' ? 'text-red-400' : 'text-red-600')
            }`}
          >
            {isBelowAverage ? '↓' : '↑'} 52주 평균: {average.toLocaleString('ko-KR', {
              maximumFractionDigits: 2,
            })}
          </span>
        )}
      </div>
      <div className={`mt-4 text-sm ${
        theme === 'dark' ? 'text-gray-300' : 'text-gray-500'
      }`}>
        <p>52주 최저: {data['52week'].low.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</p>
        <p>52주 최고: {data['52week'].high.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</p>
      </div>
    </div>
  );
}

