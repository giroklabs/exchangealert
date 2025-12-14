import { useInvestmentAnalysis } from '../hooks/useInvestmentAnalysis';
import { ExchangeRateCard } from './ExchangeRateCard';
import { DollarIndexCard } from './DollarIndexCard';
import { GapRatioCard } from './GapRatioCard';
import { InvestmentSignal } from './InvestmentSignal';
import { DataTable } from './DataTable';
import { calculateGapRatio } from '../services/calculationService';
import { getCurrentRateValue } from '../services/exchangeRateService';

export function InvestmentAnalysis() {
  const { exchangeRate, dollarIndex, weeklyAverages, signal, isLoading, error, lastUpdateTime } =
    useInvestmentAnalysis();

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
    </div>
  );
}

