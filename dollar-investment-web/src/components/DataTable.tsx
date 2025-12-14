import { useTheme } from '../contexts/ThemeContext';

interface DataTableProps {
  exchangeRate: {
    low: number;
    high: number;
    average: number;
  };
  dollarIndex: {
    low: number;
    high: number;
    average: number;
  };
  gapRatio: {
    average: number;
  };
  isLoading?: boolean;
}

export function DataTable({
  exchangeRate,
  dollarIndex,
  gapRatio,
  isLoading,
}: DataTableProps) {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <div className={`rounded-lg shadow-md p-6 animate-pulse ${
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      }`}>
        <div className={`h-6 rounded w-1/3 mb-4 ${
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
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg shadow-md p-6 ${
      theme === 'dark' ? 'bg-gray-800' : 'bg-white'
    }`}>
      <h3 className={`text-lg font-semibold mb-4 ${
        theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
      }`}>52주 평균 데이터</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${
              theme === 'dark' ? 'border-gray-600' : 'border-gray-200'
            }`}>
              <th className={`text-left py-3 px-4 font-semibold ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}>항목</th>
              <th className={`text-right py-3 px-4 font-semibold ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}>52주 최저</th>
              <th className={`text-right py-3 px-4 font-semibold ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}>52주 최고</th>
              <th className={`text-right py-3 px-4 font-semibold ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}>52주 평균</th>
            </tr>
          </thead>
          <tbody>
            <tr className={`border-b ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
            }`}>
              <td className={`py-3 px-4 ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}>원/달러 환율</td>
              <td className={`py-3 px-4 text-right ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {exchangeRate.low.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className={`py-3 px-4 text-right ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {exchangeRate.high.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className={`py-3 px-4 text-right font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {exchangeRate.average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
            </tr>
            <tr className={`border-b ${
              theme === 'dark' ? 'border-gray-700' : 'border-gray-100'
            }`}>
              <td className={`py-3 px-4 ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}>달러 지수</td>
              <td className={`py-3 px-4 text-right ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {dollarIndex.low.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className={`py-3 px-4 text-right ${
                theme === 'dark' ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {dollarIndex.high.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className={`py-3 px-4 text-right font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {dollarIndex.average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
            </tr>
            <tr>
              <td className={`py-3 px-4 ${
                theme === 'dark' ? 'text-gray-200' : 'text-gray-700'
              }`}>달러 갭 비율</td>
              <td className={`py-3 px-4 text-right ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>-</td>
              <td className={`py-3 px-4 text-right ${
                theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
              }`}>-</td>
              <td className={`py-3 px-4 text-right font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {gapRatio.average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

