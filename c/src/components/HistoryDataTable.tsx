import { useTheme } from '../contexts/ThemeContext';

interface HistoryDataTableProps {
  exchangeRateHistory: Array<{ date: string; rate: number }>;
  dollarIndexHistory: Array<{ date: string; value: number }>;
  currentDollarIndex?: { date: string; value: number };
  isLoading?: boolean;
}

export function HistoryDataTable({
  exchangeRateHistory,
  dollarIndexHistory,
  currentDollarIndex,
  isLoading,
}: HistoryDataTableProps) {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <div className={`rounded-2xl shadow-xl border p-6 animate-pulse ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
        <div className={`h-6 rounded w-1/3 mb-4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        <div className="space-y-4">
          <div className={`h-4 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          <div className={`h-4 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
          <div className={`h-4 rounded ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
        </div>
      </div>
    );
  }

  // 두 히스토리를 날짜 기준으로 병합
  const combinedData: Array<{
    date: string;
    rate: number | null;
    dollarIndex: number | null;
    gapRatio: number | null;
  }> = [];

  // 날짜 형식 정규화 함수 (YYYY-MM-DD 형식으로 통일)
  const normalizeDate = (dateStr: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return dateStr;
  };

  const rateMap = new Map(
    exchangeRateHistory.map((item) => [normalizeDate(item.date), item.rate])
  );

  const indexEntries = [...dollarIndexHistory.map((item) => [normalizeDate(item.date), item.value])];

  if (currentDollarIndex) {
    const normalizedCurrentDate = normalizeDate(currentDollarIndex.date);
    if (!indexEntries.some(([date]) => date === normalizedCurrentDate)) {
      indexEntries.push([normalizedCurrentDate, currentDollarIndex.value]);
    }
  }

  const indexMap = new Map(indexEntries as [string, number][]);

  const allDates = new Set([
    ...exchangeRateHistory.map((item) => normalizeDate(item.date)),
    ...Array.from(indexMap.keys())
  ]);

  const sortedDates = Array.from(allDates).sort();
  let lastKnownDollarIndex: number | null = null;

  sortedDates.forEach((date) => {
    const rate = rateMap.get(date) || null;
    let dollarIndex = indexMap.get(date) || null;

    if (dollarIndex === null && lastKnownDollarIndex !== null) {
      dollarIndex = lastKnownDollarIndex;
    }

    if (dollarIndex !== null) {
      lastKnownDollarIndex = dollarIndex;
    }

    const gapRatio =
      rate && dollarIndex ? (rate / dollarIndex) * 100 : null;

    combinedData.push({ date, rate, dollarIndex, gapRatio });
  });

  combinedData.reverse();

  return (
    <div className={`rounded-2xl shadow-xl border p-6 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
      <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>전체 데이터 (최근 52주)</h3>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className={`sticky top-0 z-10 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <tr className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
              <th className={`text-left py-3 px-4 font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>날짜</th>
              <th className={`text-right py-3 px-4 font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>원/달러 환율</th>
              <th className={`text-right py-3 px-4 font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>달러 지수</th>
              <th className={`text-right py-3 px-4 font-bold ${theme === 'dark' ? 'text-gray-200' : 'text-gray-900'}`}>달러 갭 비율</th>
            </tr>
          </thead>
          <tbody>
            {combinedData.map((item, index) => (
              <tr
                key={item.date}
                className={`border-b ${theme === 'dark' ? 'border-gray-700' : 'border-gray-50'} ${index % 2 === 0
                    ? (theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-50/50')
                    : (theme === 'dark' ? 'bg-gray-800' : 'bg-white')
                  }`}
              >
                <td className={`py-2 px-4 font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                  {new Date(item.date).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </td>
                <td className={`py-2 px-4 text-right font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                  {item.rate
                    ? item.rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
                    : <span className="text-gray-500">-</span>}
                </td>
                <td className={`py-2 px-4 text-right font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                  {item.dollarIndex
                    ? item.dollarIndex.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
                    : <span className="text-gray-500">-</span>}
                </td>
                <td className={`py-2 px-4 text-right font-semibold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                  {item.gapRatio
                    ? item.gapRatio.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
                    : <span className="text-gray-500">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`mt-4 pt-4 border-t ${theme === 'dark' ? 'border-gray-700 text-gray-500' : 'border-gray-200 text-gray-400'} text-xs`}>
        <p>📊 총 {combinedData.length}개 데이터</p>
        <p>💡 스크롤하여 전체 데이터 확인 가능</p>
      </div>
    </div>
  );
}
