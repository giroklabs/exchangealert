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
  if (isLoading) {
    return (
      <div className="bg-gray-800 rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">52주 평균 데이터</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-600">
              <th className="text-left py-3 px-4 font-semibold text-gray-200">항목</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-200">52주 최저</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-200">52주 최고</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-200">52주 평균</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-700">
              <td className="py-3 px-4 text-gray-200">원/달러 환율</td>
              <td className="py-3 px-4 text-right text-gray-300">
                {exchangeRate.low.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right text-gray-300">
                {exchangeRate.high.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right font-semibold text-white">
                {exchangeRate.average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
            </tr>
            <tr className="border-b border-gray-700">
              <td className="py-3 px-4 text-gray-200">달러 지수</td>
              <td className="py-3 px-4 text-right text-gray-300">
                {dollarIndex.low.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right text-gray-300">
                {dollarIndex.high.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right font-semibold text-white">
                {dollarIndex.average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 text-gray-200">달러 갭 비율</td>
              <td className="py-3 px-4 text-right text-gray-500">-</td>
              <td className="py-3 px-4 text-right text-gray-500">-</td>
              <td className="py-3 px-4 text-right font-semibold text-white">
                {gapRatio.average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

