import type { DollarIndexData } from '../types';

interface DollarIndexCardProps {
  data: DollarIndexData | null;
  average?: number;
  isLoading?: boolean;
}

export function DollarIndexCard({ data, average, isLoading }: DollarIndexCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">달러 지수</h3>
        <p className="text-gray-500">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const isBelowAverage = average ? data.current < average : false;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">달러 지수</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">
          {data.current.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
        </span>
        {average && (
          <span
            className={`text-sm font-medium ${
              isBelowAverage ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isBelowAverage ? '↓' : '↑'} 52주 평균: {average.toLocaleString('ko-KR', {
              maximumFractionDigits: 2,
            })}
          </span>
        )}
      </div>
      <div className="mt-4 text-sm text-gray-500">
        <p>52주 최저: {data['52week'].low.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</p>
        <p>52주 최고: {data['52week'].high.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}</p>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
        <p>📊 출처: FRED API (Federal Reserve Economic Data)</p>
        <p>🕐 기준 시점: {new Date(data.date).toLocaleString('ko-KR', { 
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          timeZone: 'Asia/Seoul'
        })}</p>
        <p>🔄 업데이트: 매일 오전 9시 (KST)</p>
        <p>📈 지수: DTWEXBGS (Trade Weighted U.S. Dollar Index: Broad, Goods)</p>
      </div>
    </div>
  );
}

