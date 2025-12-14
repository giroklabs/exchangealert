import type { InvestmentSignal } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface InvestmentSignalProps {
  signal: InvestmentSignal | null;
  isLoading?: boolean;
}

export function InvestmentSignal({ signal, isLoading }: InvestmentSignalProps) {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <div className={`rounded-lg shadow-md p-6 animate-pulse ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className={`h-6 rounded w-1/2 mb-4 ${
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        }`}></div>
        <div className="space-y-2">
          <div className={`h-4 rounded ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
          <div className={`h-4 rounded ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
          <div className={`h-4 rounded ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
          <div className={`h-4 rounded ${
            theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className={`rounded-lg shadow-md p-6 ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${
          theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
        }`}>투자 적합성 분석</h3>
        <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const conditions = [
    {
      label: '현재 원/달러 환율 < 52주 평균 환율',
      met: signal.conditions.rateBelowAverage,
    },
    {
      label: '현재 달러 지수 < 52주 평균 달러 지수',
      met: signal.conditions.dollarIndexBelowAverage,
    },
    {
      label: '현재 달러 갭 비율 > 52주 평균 달러 갭 비율',
      met: signal.conditions.gapRatioAboveAverage,
    },
    {
      label: '현재 원/달러 환율 < 적정 환율',
      met: signal.conditions.rateBelowAppropriate,
      detail: `(적정 환율: ${signal.appropriateRate.toLocaleString('ko-KR', {
        maximumFractionDigits: 2,
      })}원)`,
    },
  ];

  return (
    <div className={`rounded-lg shadow-md p-6 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    }`}>
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`flex-1 p-4 rounded-lg border-2 ${
            signal.isSuitable 
              ? (theme === 'dark' ? 'bg-green-900 border-green-500' : 'bg-green-50 border-green-500')
              : (theme === 'dark' ? 'bg-red-900 border-red-500' : 'bg-red-50 border-red-500')
          }`}
        >
          <div className="flex items-center gap-2">
            {signal.isSuitable ? (
              <>
                <span className="text-2xl">✅</span>
                <span className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-green-300' : 'text-green-700'
                }`}>투자 시작 적합</span>
              </>
            ) : (
              <>
                <span className="text-2xl">⚠️</span>
                <span className={`text-xl font-bold ${
                  theme === 'dark' ? 'text-red-300' : 'text-red-700'
                }`}>투자 시작 부적합</span>
              </>
            )}
          </div>
        </div>
      </div>

      <h3 className={`text-lg font-semibold mb-4 ${
        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
      }`}>투자 조건 체크리스트</h3>
      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              condition.met 
                ? (theme === 'dark' ? 'bg-green-900' : 'bg-green-50')
                : (theme === 'dark' ? 'bg-red-900' : 'bg-red-50')
            }`}
          >
            <span className="text-xl mt-0.5">{condition.met ? '✅' : '❌'}</span>
            <div className="flex-1">
              <p
                className={`font-medium ${
                  condition.met 
                    ? (theme === 'dark' ? 'text-green-300' : 'text-green-700')
                    : (theme === 'dark' ? 'text-red-300' : 'text-red-700')
                }`}
              >
                {condition.label}
              </p>
              {condition.detail && (
                <p className={`text-sm mt-1 ${
                  theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                }`}>{condition.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={`mt-6 p-4 rounded-lg ${
        theme === 'dark' ? 'bg-blue-900' : 'bg-blue-50'
      }`}>
        <p className={`text-sm ${
          theme === 'dark' ? 'text-blue-200' : 'text-blue-800'
        }`}>
          <strong>참고:</strong> 모든 조건을 만족해야 투자 시작이 적합합니다. 이는 분할 매수를
          시작하는 시점을 의미하며, 하락 위험을 완전히 배제할 수는 없습니다.
        </p>
      </div>
    </div>
  );
}

