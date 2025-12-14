import type { ExchangeRate } from '../types';
import { parseExchangeRate } from '../services/calculationService';

interface ExchangeRateCardProps {
  rate: ExchangeRate | null;
  average?: number;
  isLoading?: boolean;
}

export function ExchangeRateCard({ rate, average, isLoading }: ExchangeRateCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!rate) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">원/달러 환율</h3>
        <p className="text-gray-500">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const currentRate = parseExchangeRate(rate.deal_bas_r);
  const isBelowAverage = average ? currentRate < average : false;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">원/달러 환율</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">
          {currentRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
        </span>
        {average && (
          <span
            className={`text-sm font-medium ${
              isBelowAverage ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isBelowAverage ? '↓' : '↑'} 52주 평균: {average.toLocaleString('ko-KR')}
          </span>
        )}
      </div>
      <div className="mt-4 text-sm text-gray-500">
        <p>매수기준율: {rate.ttb}</p>
        <p>매도기준율: {rate.tts}</p>
      </div>
    </div>
  );
}

