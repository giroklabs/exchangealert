import type { InvestmentSignal as InvestmentSignalType } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface InvestmentSignalProps {
  signal: InvestmentSignalType | null;
  isLoading?: boolean;
}

export function InvestmentSignal({ signal, isLoading }: InvestmentSignalProps) {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <div className={`rounded-2xl shadow-xl border p-6 md:p-8 animate-pulse ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className={`h-16 rounded-2xl w-full mb-8 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
        <div className={`h-4 rounded w-32 mb-5 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-24 rounded-2xl ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}></div>
          ))}
        </div>
      </div>
    );
  }

  if (!signal) {
    return (
      <div className={`rounded-2xl shadow-xl p-6 border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>투자 적합성 분석</h3>
        <p className={theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}>데이터를 불러올 수 없습니다.</p>
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
      detail: `(적정 환율: ${signal.appropriateRate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원)`,
    },
  ];

  const getStatusConfig = () => {
    if (signal.score >= 3) return {
      text: `적극 매수 권장 (${signal.score}/4)`,
      color: theme === 'dark' ? 'text-amber-400' : 'text-amber-600',
      bg: theme === 'dark' ? 'bg-amber-400/10' : 'bg-amber-50',
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    };
    if (signal.score === 2) return {
      text: `관망 및 분할 매수 (2/4)`,
      color: theme === 'dark' ? 'text-amber-400' : 'text-amber-600',
      bg: theme === 'dark' ? 'bg-amber-400/10' : 'bg-amber-50',
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
    };
    return {
      text: `매수 부적합 (${signal.score}/4)`,
      color: theme === 'dark' ? 'text-amber-400' : 'text-amber-600',
      bg: theme === 'dark' ? 'bg-amber-400/10' : 'bg-amber-50',
      icon: <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    };
  };

  const status = getStatusConfig();

  return (
    <div className={`p-6 md:p-8 rounded-2xl shadow-xl border transition-all duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
      {/* Top Banner */}
      <div className={`flex items-center justify-center md:justify-start gap-3 p-5 rounded-2xl mb-8 ${status.bg}`}>
        <div className={`${status.color}`}>
          {status.icon}
        </div>
        <h2 className={`text-xl font-black tracking-tight ${status.color}`}>
          {status.text}
        </h2>
      </div>

      <div className="flex items-center gap-2 mb-5">
        <h3 className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>지표 체크리스트</h3>
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {conditions.map((condition, index) => {
          const isMet = condition.met;
          const cardBg = isMet
            ? (theme === 'dark' ? 'bg-amber-900/10' : 'bg-amber-50/50')
            : (theme === 'dark' ? 'bg-gray-800/20' : 'bg-gray-50/50');

          const borderColor = isMet
            ? (theme === 'dark' ? 'border-amber-500/20' : 'border-amber-200')
            : (theme === 'dark' ? 'border-gray-800' : 'border-gray-100');

          const textColor = isMet
            ? (theme === 'dark' ? 'text-amber-400' : 'text-amber-700')
            : (theme === 'dark' ? 'text-gray-500' : 'text-gray-500');

          const iconColor = isMet
            ? (theme === 'dark' ? 'text-amber-400' : 'text-amber-500')
            : (theme === 'dark' ? 'text-gray-600' : 'text-gray-300');

          return (
            <div
              key={index}
              className={`flex items-start gap-4 p-5 rounded-2xl border transition-colors duration-300 ${cardBg} ${borderColor}`}
            >
              <div className={`mt-0.5 shrink-0 ${iconColor}`}>
                {isMet ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`font-semibold text-sm leading-snug ${textColor}`}>
                  {condition.label}
                </p>
                {condition.detail && (
                  <p className={`text-xs mt-1.5 font-medium ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                    {condition.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
