import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface DataSourceInfoProps {
  exchangeRateUpdateTime?: string;
  dollarIndexDate?: string;
  calculationDate?: string;
}

export function DataSourceInfo({
  exchangeRateUpdateTime,
  dollarIndexDate,
  calculationDate,
}: DataSourceInfoProps) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`rounded-lg shadow-md p-4 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    }`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between text-left p-3 rounded-lg transition-colors ${
          theme === 'dark' 
            ? 'bg-gray-700 hover:bg-gray-600' 
            : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <span className={`font-semibold ${
          theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
        }`}>📊 데이터 출처 및 기준 시점</span>
        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4 text-sm">
          {/* 환율 데이터 출처 */}
          <div className={`p-4 rounded-lg ${
            theme === 'dark' ? 'bg-blue-900' : 'bg-blue-50'
          }`}>
            <h4 className={`font-semibold mb-2 ${
              theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
            }`}>원/달러 환율</h4>
            <ul className={`space-y-1 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <li>📊 출처: 한국수출입은행 Open API</li>
              {exchangeRateUpdateTime && (
                <li>
                  🕐 기준 시점:{' '}
                  {new Date(exchangeRateUpdateTime).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    timeZone: 'Asia/Seoul',
                  })}{' '}
                  (KST)
                </li>
              )}
              <li>🔄 업데이트: 15분 간격</li>
            </ul>
          </div>

          {/* 달러 지수 출처 */}
          <div className={`p-4 rounded-lg ${
            theme === 'dark' ? 'bg-purple-900' : 'bg-purple-50'
          }`}>
            <h4 className={`font-semibold mb-2 ${
              theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
            }`}>달러 지수</h4>
            <ul className={`space-y-1 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <li>📊 출처: FRED API (Federal Reserve Economic Data)</li>
              {dollarIndexDate && (
                <li>
                  🕐 기준 시점:{' '}
                  {new Date(dollarIndexDate + 'T09:00:00+09:00').toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Seoul',
                  })}{' '}
                  (KST)
                </li>
              )}
              <li>🔄 업데이트: 매일 오전 9시 (KST)</li>
              <li>📈 지수: DTWEXBGS (Trade Weighted U.S. Dollar Index: Broad, Goods)</li>
            </ul>
          </div>

          {/* 52주 평균 출처 */}
          <div className={`p-4 rounded-lg ${
            theme === 'dark' ? 'bg-green-900' : 'bg-green-50'
          }`}>
            <h4 className={`font-semibold mb-2 ${
              theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
            }`}>52주 평균 데이터</h4>
            <ul className={`space-y-1 ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
            }`}>
              <li>📊 출처: 수출입은행 API 히스토리 데이터 (환율), FRED API (달러 지수)</li>
              {calculationDate && (
                <li>
                  🕐 계산 기준 시점:{' '}
                  {new Date(calculationDate + 'T09:00:00+09:00').toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Seoul',
                  })}{' '}
                  (KST)
                </li>
              )}
              <li>📈 기간: 최근 52주 (약 1년)</li>
              <li>🔄 업데이트: 매일 오전 9시 (KST)</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

