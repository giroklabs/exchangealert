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
      <div className={`rounded-lg shadow-md p-6 animate-pulse ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}>
        <div className={`h-6 rounded w-1/2 mb-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
          }`}></div>
        <div className="space-y-2">
          <div className={`h-4 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
          <div className={`h-4 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
          <div className={`h-4 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
          <div className={`h-4 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
            }`}></div>
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className={`rounded-lg shadow-md p-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'
        }`}>
        <h3 className={`text-lg font-semibold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
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
      label: '현재 달러 갭 비율 < 52주 평균 달러 갭 비율',
      met: signal.conditions.gapRatioBelowAverage,
    },
    {
      label: '현재 원/달러 환율 < 적정 환율',
      met: signal.conditions.rateBelowAppropriate,
      detail: `(적정 환율: ${signal.appropriateRate.toLocaleString('ko-KR', {
        maximumFractionDigits: 2,
      })}원)`,
    },
  ];

  const getStatusText = () => {
    if (signal.score === 4) return '적극 매수 권장 (4/4)';
    if (signal.score === 3) return '매수 시작 적합 (3/4)';
    if (signal.score === 2) return '관망 및 분할 매수 (2/4)';
    return '매수 부적합 (1/4)';
  };

  const getStatusColor = () => {
    if (signal.score >= 3) return theme === 'dark' ? 'text-green-300' : 'text-green-700';
    if (signal.score === 2) return theme === 'dark' ? 'text-yellow-300' : 'text-yellow-700';
    return theme === 'dark' ? 'text-red-300' : 'text-red-700';
  };

  const getBgColor = () => {
    if (signal.score >= 3) return theme === 'dark' ? 'bg-green-900 border-gray-800 dark:border-gray-200' : 'bg-green-50 border-gray-800 dark:border-gray-200';
    if (signal.score === 2) return theme === 'dark' ? 'bg-yellow-900/30 border-yellow-500' : 'bg-yellow-50 border-yellow-500';
    return theme === 'dark' ? 'bg-red-900 border-red-500' : 'bg-red-50 border-red-500';
  };

  return (
    <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className={`flex-1 p-4 rounded-xl border-2 ${getBgColor()}`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {signal.score >= 3 ? '✅' : signal.score === 2 ? '⚠️' : '❌'}
            </span>
            <span className={`text-xl font-bold ${getStatusColor()}`}>
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>

      <h3 className={`text-base font-bold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>지표 체크리스트</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {conditions.map((condition, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 p-3 rounded-xl border ${condition.met
              ? (theme === 'dark' ? 'bg-gray-700 border-yellow-500/50' : 'bg-yellow-50 border-yellow-200')
              : (theme === 'dark' ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200')
              }`}
          >
            <span className="text-xl mt-0.5">{condition.met ? '✅' : '❌'}</span>
            <div className="flex-1">
              <p
                className={`font-medium ${condition.met
                  ? (theme === 'dark' ? 'text-green-300' : 'text-green-700')
                  : (theme === 'dark' ? 'text-red-300' : 'text-red-700')
                  }`}
              >
                {condition.label}
              </p>
              {condition.detail && (
                <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
                  }`}>{condition.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>


    </div>
  );
}
