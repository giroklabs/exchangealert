interface HistoryDataTableProps {
  exchangeRateHistory: Array<{ date: string; rate: number }>;
  dollarIndexHistory: Array<{ date: string; value: number }>;
  isLoading?: boolean;
}

export function HistoryDataTable({
  exchangeRateHistory,
  dollarIndexHistory,
  isLoading,
}: HistoryDataTableProps) {
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

  // 두 히스토리를 날짜 기준으로 병합
  const combinedData: Array<{
    date: string;
    rate: number | null;
    dollarIndex: number | null;
    gapRatio: number | null;
  }> = [];

  // 날짜 형식 정규화 함수 (YYYY-MM-DD 형식으로 통일)
  const normalizeDate = (dateStr: string): string => {
    // 이미 YYYY-MM-DD 형식이면 그대로 반환
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    // 다른 형식이면 Date 객체를 통해 변환
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return dateStr;
  };

  // 날짜를 정규화하여 Map 생성
  const rateMap = new Map(
    exchangeRateHistory.map((item) => [normalizeDate(item.date), item.rate])
  );
  const indexMap = new Map(
    dollarIndexHistory.map((item) => [normalizeDate(item.date), item.value])
  );

  // 모든 날짜 수집 (정규화된 날짜 사용)
  const allDates = new Set([
    ...exchangeRateHistory.map((item) => normalizeDate(item.date)),
    ...dollarIndexHistory.map((item) => normalizeDate(item.date)),
  ]);

  // 날짜별로 정렬하여 최신순으로 표시
  Array.from(allDates)
    .sort()
    .reverse() // 최신순
    .forEach((date) => {
      const rate = rateMap.get(date) || null;
      const dollarIndex = indexMap.get(date) || null;
      const gapRatio =
        rate && dollarIndex ? (rate / dollarIndex) * 100 : null;

      combinedData.push({ date, rate, dollarIndex, gapRatio });
    });
  
  // 디버깅을 위한 로그 (개발 환경에서만)
  if (process.env.NODE_ENV === 'development') {
    console.log('HistoryDataTable - Exchange Rate History:', exchangeRateHistory.length);
    console.log('HistoryDataTable - Dollar Index History:', dollarIndexHistory.length);
    console.log('HistoryDataTable - Combined Data:', combinedData.length);
    console.log('HistoryDataTable - Sample dates:', combinedData.slice(0, 5).map(d => d.date));
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-700 mb-4">전체 데이터 (최근 52주)</h3>
      <div className="overflow-x-auto max-h-96 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4 font-semibold text-gray-700">날짜</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">원/달러 환율</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">달러 지수</th>
              <th className="text-right py-3 px-4 font-semibold text-gray-700">달러 갭 비율</th>
            </tr>
          </thead>
          <tbody>
            {combinedData.map((item, index) => (
              <tr
                key={item.date}
                className={`border-b border-gray-100 ${
                  index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                }`}
              >
                <td className="py-2 px-4 text-gray-700">
                  {new Date(item.date).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </td>
                <td className="py-2 px-4 text-right">
                  {item.rate
                    ? item.rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
                    : '-'}
                </td>
                <td className="py-2 px-4 text-right">
                  {item.dollarIndex
                    ? item.dollarIndex.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
                    : '-'}
                </td>
                <td className="py-2 px-4 text-right">
                  {item.gapRatio
                    ? item.gapRatio.toLocaleString('ko-KR', { maximumFractionDigits: 2 })
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-400">
        <p>📊 총 {combinedData.length}개 데이터</p>
        <p>💡 스크롤하여 전체 데이터 확인 가능</p>
      </div>
    </div>
  );
}

