import { useInvestmentAnalysis } from '../hooks/useInvestmentAnalysis';
import { ExchangeRateCard } from './ExchangeRateCard';
import { DollarIndexCard } from './DollarIndexCard';
import { GapRatioCard } from './GapRatioCard';
import { InvestmentSignal } from './InvestmentSignal';
import { DataTable } from './DataTable';
import { ExchangeRateChart } from './ExchangeRateChart';
import { DollarIndexChart } from './DollarIndexChart';
import { HistoryDataTable } from './HistoryDataTable';
import { calculateGapRatio } from '../services/calculationService';
import { getCurrentRateValue } from '../services/exchangeRateService';
import { useState } from 'react';

export function InvestmentAnalysis() {
  const { exchangeRate, dollarIndex, weeklyAverages, signal, isLoading, error, lastUpdateTime, exchangeRateHistory } =
    useInvestmentAnalysis();
  const [showCharts, setShowCharts] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">오류 발생</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  const currentRate = exchangeRate ? getCurrentRateValue(exchangeRate) : 0;
  const currentDollarIndex = dollarIndex?.current || 0;
  const currentGapRatio = calculateGapRatio(currentRate, currentDollarIndex);

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">달러 투자 적정 시기 분석</h1>
        <p className="text-gray-600 mt-2">데이터가 알려주는 투자 최적기</p>
      </div>

      {/* 투자 신호 */}
      <InvestmentSignal signal={signal} isLoading={isLoading} />

      {/* 주요 지표 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ExchangeRateCard
          rate={exchangeRate}
          average={weeklyAverages?.exchangeRate.average}
          isLoading={isLoading}
          lastUpdate={lastUpdateTime || undefined}
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
          calculationDate={weeklyAverages.date}
        />
      )}

      {/* 차트 섹션 토글 버튼 */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setShowCharts(!showCharts)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          {showCharts ? '📉 차트 숨기기' : '📈 차트 보기'}
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
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
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

