import type { ExchangeRate } from '../types';
import { parseExchangeRate } from '../services/calculationService';
import { useTheme } from '../contexts/ThemeContext';

interface ExchangeRateCardProps {
  rate: ExchangeRate | null;
  average?: number;
  isLoading?: boolean;
}

export function ExchangeRateCard({ rate, average, isLoading }: ExchangeRateCardProps) {
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

  if (!rate) {
    return (
      <div className={`rounded-lg shadow-md p-6 ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      }`}>
        <h3 className={`text-lg font-semibold mb-2 ${
          theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
        }`}>원/달러 환율</h3>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const currentRate = parseExchangeRate(rate.deal_bas_r);
  const isBelowAverage = average ? currentRate < average : false;

  return (
    <div className={`rounded-lg shadow-md p-6 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    }`}>
      <h3 className={`text-lg font-semibold mb-4 ${
        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
      }`}>원/달러 환율</h3>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${
          theme === 'dark' ? 'text-white' : 'text-gray-900'
        }`}>
          {currentRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
        </span>
        {average && (
          <span
            className={`text-sm font-medium ${
              isBelowAverage 
                ? (theme === 'dark' ? 'text-green-400' : 'text-green-600')
                : (theme === 'dark' ? 'text-red-400' : 'text-red-600')
            }`}
          >
            {isBelowAverage ? '↓' : '↑'} 52주 평균: {average.toLocaleString('ko-KR')}
          </span>
        )}
      </div>
      <div className={`mt-4 text-sm ${
        theme === 'dark' ? 'text-gray-300' : 'text-gray-500'
      }`}>
        <p>매수기준율: {rate.ttb}</p>
        <p>매도기준율: {rate.tts}</p>
      </div>
    </div>
  );
}

