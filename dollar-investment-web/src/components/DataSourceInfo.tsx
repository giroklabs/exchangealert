import { useState } from 'react';

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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
      >
        <span className="font-semibold text-gray-200">📊 데이터 출처 및 기준 시점</span>
        <span className="text-gray-400">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4 text-sm">
          {/* 환율 데이터 출처 */}
          <div className="p-4 bg-blue-900 rounded-lg">
            <h4 className="font-semibold text-gray-200 mb-2">원/달러 환율</h4>
            <ul className="space-y-1 text-gray-300">
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
          <div className="p-4 bg-purple-900 rounded-lg">
            <h4 className="font-semibold text-gray-200 mb-2">달러 지수</h4>
            <ul className="space-y-1 text-gray-300">
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
          <div className="p-4 bg-green-900 rounded-lg">
            <h4 className="font-semibold text-gray-200 mb-2">52주 평균 데이터</h4>
            <ul className="space-y-1 text-gray-300">
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

