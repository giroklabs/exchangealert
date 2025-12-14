import { useState, useEffect } from 'react';
import type { ExchangeRate, DollarIndexData, InvestmentSignal } from '../types';
import { fetchCurrentExchangeRate, getCurrentRateValue } from '../services/exchangeRateService';
import { fetchDollarIndex, fetchWeeklyAverages } from '../services/dollarIndexService';
import {
  calculateGapRatio,
  calculateAppropriateRate,
  checkInvestmentSuitability,
} from '../services/calculationService';

interface AnalysisData {
  exchangeRate: ExchangeRate | null;
  dollarIndex: DollarIndexData | null;
  weeklyAverages: {
    exchangeRate: { low: number; high: number; average: number };
    dollarIndex: { low: number; high: number; average: number };
    gapRatio: { average: number };
  } | null;
  signal: InvestmentSignal | null;
  isLoading: boolean;
  error: string | null;
}

export function useInvestmentAnalysis(): AnalysisData {
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [dollarIndex, setDollarIndex] = useState<DollarIndexData | null>(null);
  const [weeklyAverages, setWeeklyAverages] = useState<AnalysisData['weeklyAverages']>(null);
  const [signal, setSignal] = useState<InvestmentSignal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // 병렬로 데이터 로드
        const [rate, index, averages] = await Promise.all([
          fetchCurrentExchangeRate(),
          fetchDollarIndex(),
          fetchWeeklyAverages(),
        ]);

        setExchangeRate(rate);
        setDollarIndex(index);
        setWeeklyAverages(averages);

        // 모든 데이터가 로드되면 투자 신호 계산
        if (rate && index && averages) {
          const currentRate = getCurrentRateValue(rate);
          const currentDollarIndex = index.current;
          const currentGapRatio = calculateGapRatio(currentRate, currentDollarIndex);
          const appropriateRate = calculateAppropriateRate(
            currentDollarIndex,
            averages.gapRatio.average
          );

          const investmentSignal = checkInvestmentSuitability(
            currentRate,
            averages.exchangeRate.average,
            currentDollarIndex,
            averages.dollarIndex.average,
            currentGapRatio,
            averages.gapRatio.average,
            appropriateRate
          );

          setSignal(investmentSignal);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '데이터 로드 중 오류가 발생했습니다.');
        console.error('데이터 로드 오류:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  return {
    exchangeRate,
    dollarIndex,
    weeklyAverages,
    signal,
    isLoading,
    error,
  };
}

