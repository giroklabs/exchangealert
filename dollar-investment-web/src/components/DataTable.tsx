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
  calculationDate?: string;
}

export function DataTable({
  exchangeRate,
  dollarIndex,
  gapRatio,
  isLoading,
  calculationDate,
}: DataTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">52주 평균 데이터</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">항목</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">52주 최저</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">52주 최고</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">52주 평균</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-3 px-4 text-gray-700">원/달러 환율</td>
              <td className="py-3 px-4 text-right">
                {exchangeRate.low.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right">
                {exchangeRate.high.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right font-semibold">
                {exchangeRate.average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-3 px-4 text-gray-700">달러 지수</td>
              <td className="py-3 px-4 text-right">
                {dollarIndex.low.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right">
                {dollarIndex.high.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
              <td className="py-3 px-4 text-right font-semibold">
                {dollarIndex.average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
            </tr>
            <tr>
              <td className="py-3 px-4 text-gray-700">달러 갭 비율</td>
              <td className="py-3 px-4 text-right text-gray-400">-</td>
              <td className="py-3 px-4 text-right text-gray-400">-</td>
              <td className="py-3 px-4 text-right font-semibold">
                {gapRatio.average.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
        <p>📊 출처: 수출입은행 API 히스토리 데이터 (환율), FRED API (달러 지수)</p>
        {calculationDate && (
          <p>🕐 계산 기준 시점: {new Date(calculationDate + 'T09:00:00+09:00').toLocaleString('ko-KR', { 
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Seoul'
          })} (KST)</p>
        )}
        <p>📈 기간: 최근 52주 (약 1년)</p>
        <p>🔄 업데이트: 매일 오전 9시 (KST)</p>
      </div>
    </div>
  );
}

