import { useInvestmentAnalysis } from '../hooks/useInvestmentAnalysis';
import { ExchangeRateCard } from './ExchangeRateCard';
import { DollarIndexCard } from './DollarIndexCard';
import { GapRatioCard } from './GapRatioCard';
import { InvestmentSignal } from './InvestmentSignal';
import { DataTable } from './DataTable';
import { ExchangeRateChart } from './ExchangeRateChart';
import { DollarIndexChart } from './DollarIndexChart';
import { HistoryDataTable } from './HistoryDataTable';
import { DataSourceInfo } from './DataSourceInfo';
import { NotificationSettings } from './NotificationSettings';
import { calculateGapRatio } from '../services/calculationService';
import { getCurrentRateValue } from '../services/exchangeRateService';
import { useTheme } from '../contexts/ThemeContext';
import { useState } from 'react';

export function InvestmentAnalysis() {
  const { exchangeRate, dollarIndex, weeklyAverages, signal, isLoading, error, lastUpdateTime, exchangeRateHistory } =
    useInvestmentAnalysis();
  const { theme } = useTheme();
  const [showCharts, setShowCharts] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  if (error) {
    return (
      <div>
        <div className={`rounded-lg p-6 ${theme === 'dark'
          ? 'bg-red-900 border border-red-700'
          : 'bg-red-50 border border-red-200'
          }`}>
          <h2 className={`text-xl font-semibold mb-2 ${theme === 'dark' ? 'text-red-200' : 'text-red-800'
            }`}>오류 발생</h2>
          <p className={theme === 'dark' ? 'text-red-300' : 'text-gray-900 dark:text-gray-100'}>{error}</p>
        </div>
      </div>
    );
  }

  const currentRate = exchangeRate ? getCurrentRateValue(exchangeRate) : 0;
  const currentDollarIndex = dollarIndex?.current || 0;
  const currentGapRatio = calculateGapRatio(currentRate, currentDollarIndex);

  return (
    <div className="space-y-6">
      {/* 투자 신호 */}
      <InvestmentSignal signal={signal} isLoading={isLoading} />

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ExchangeRateCard
          rate={exchangeRate}
          average={weeklyAverages?.exchangeRate.average}
          isLoading={isLoading}
        />
        <DollarIndexCard
          data={dollarIndex}
          average={weeklyAverages?.dollarIndex.average}
          isLoading={isLoading}
        />
        <GapRatioCard
          current={currentGapRatio}
          average={weeklyAverages?.gapRatio.average || 0}
          isLoading={isLoading}
        />
      </div>

      {/* 52주 평균 데이터 테이블 */}
      {weeklyAverages && (
        <DataTable
          exchangeRate={weeklyAverages.exchangeRate}
          dollarIndex={weeklyAverages.dollarIndex}
          gapRatio={weeklyAverages.gapRatio}
          isLoading={isLoading}
        />
      )}

      {/* 차트 섹션 토글 버튼 */}
      <div className="flex justify-center gap-3">
        <button
          onClick={() => setShowCharts(!showCharts)}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${showCharts
            ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
            : (theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
            }`}
        >
          {showCharts ? '📉 차트 숨기기' : '📈 차트 보기'}
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition-colors ${showHistory
            ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
            : (theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
            }`}
        >
          {showHistory ? '📋 전체 데이터 숨기기' : '📋 전체 데이터 보기'}
        </button>
      </div>

      {/* 차트 섹션 */}
      {showCharts && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ExchangeRateChart
            data={exchangeRateHistory}
            average={weeklyAverages?.exchangeRate.average}
            isLoading={isLoading}
          />
          <DollarIndexChart
            data={dollarIndex}
            average={weeklyAverages?.dollarIndex.average}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* 전체 데이터 테이블 */}
      {showHistory && (
        <HistoryDataTable
          exchangeRateHistory={exchangeRateHistory}
          dollarIndexHistory={dollarIndex?.history || []}
          currentDollarIndex={dollarIndex ? { date: dollarIndex.date, value: dollarIndex.current } : undefined}
          isLoading={isLoading || !dollarIndex}
        />
      )}

      {/* 알림 설정 */}
      <NotificationSettings />

      {/* 데이터 출처 정보 */}
      <DataSourceInfo
        exchangeRateUpdateTime={lastUpdateTime || undefined}
        dollarIndexDate={dollarIndex?.date}
        calculationDate={weeklyAverages?.date}
      />

      {/* 환율알라미 앱 홍보 */}
      <div className={`mt-12 pt-8 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
        }`}>
        <div className="text-center p-6 rounded-lg bg-yellow-400 border border-yellow-500">
          <a
            href="https://apps.apple.com/kr/app/%ED%99%98%EC%9C%A8%EC%95%8C%EB%9D%BC%EB%AF%B8/id6752878684"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-lg font-medium text-black hover:text-gray-800 transition-colors"
          >
            📱 환율알라미 - 실시간 환율 정보와 맞춤형 알림
          </a>
          <p className="text-sm text-black mt-2 opacity-80">
            위 링크를 클릭하면 App Store에서 앱을 다운로드할 수 있습니다
          </p>
        </div>
      </div>
    </div>
  );
}

