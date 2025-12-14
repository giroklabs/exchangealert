import type { InvestmentSignal } from '../types';

interface InvestmentSignalProps {
  signal: InvestmentSignal | null;
  isLoading?: boolean;
}

export function InvestmentSignal({ signal, isLoading }: InvestmentSignalProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-4">투자 적합성 분석</h3>
        <p className="text-gray-400">데이터를 불러올 수 없습니다.</p>
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
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`flex-1 p-4 rounded-lg ${
            signal.isSuitable ? 'bg-green-900 border-2 border-green-500' : 'bg-red-900 border-2 border-red-500'
          }`}
        >
          <div className="flex items-center gap-2">
            {signal.isSuitable ? (
              <>
                <span className="text-2xl">✅</span>
                <span className="text-xl font-bold text-green-300">투자 시작 적합</span>
              </>
            ) : (
              <>
                <span className="text-2xl">⚠️</span>
                <span className="text-xl font-bold text-red-300">투자 시작 부적합</span>
              </>
            )}
          </div>
        </div>
      </div>

      <h3 className="text-lg font-semibold text-gray-200 mb-4">투자 조건 체크리스트</h3>
      <div className="space-y-3">
        {conditions.map((condition, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 p-3 rounded-lg ${
              condition.met ? 'bg-green-900' : 'bg-red-900'
            }`}
          >
            <span className="text-xl mt-0.5">{condition.met ? '✅' : '❌'}</span>
            <div className="flex-1">
              <p
                className={`font-medium ${condition.met ? 'text-green-300' : 'text-red-300'}`}
              >
                {condition.label}
              </p>
              {condition.detail && (
                <p className="text-sm text-gray-300 mt-1">{condition.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-900 rounded-lg">
        <p className="text-sm text-blue-200">
          <strong>참고:</strong> 모든 조건을 만족해야 투자 시작이 적합합니다. 이는 분할 매수를
          시작하는 시점을 의미하며, 하락 위험을 완전히 배제할 수는 없습니다.
        </p>
      </div>
    </div>
  );
}

