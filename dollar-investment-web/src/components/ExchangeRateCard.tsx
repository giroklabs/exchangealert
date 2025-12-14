import type { ExchangeRate } from '../types';
import { parseExchangeRate } from '../services/calculationService';

interface ExchangeRateCardProps {
  rate: ExchangeRate | null;
  average?: number;
  isLoading?: boolean;
  lastUpdate?: string;
}

export function ExchangeRateCard({ rate, average, isLoading, lastUpdate }: ExchangeRateCardProps) {
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
          {currentRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원
        </span>
        {average && (
          <span
            className={`text-sm font-medium ${
              isBelowAverage ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isBelowAverage ? '↓' : '↑'} 52주 평균: {average.toLocaleString('ko-KR')}원
          </span>
        )}
      </div>
      <div className="mt-4 text-sm text-gray-500">
        <p>매수기준율: {rate.ttb}원</p>
        <p>매도기준율: {rate.tts}원</p>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
        <p>📊 출처: 한국수출입은행 Open API</p>
        {lastUpdate && (
          <p>🕐 기준 시점: {new Date(lastUpdate).toLocaleString('ko-KR', { 
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: 'Asia/Seoul'
          })} (KST)</p>
        )}
        <p>🔄 업데이트: 15분 간격</p>
      </div>
    </div>
  );
}

