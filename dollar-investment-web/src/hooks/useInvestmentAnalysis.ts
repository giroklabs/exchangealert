import { useState, useEffect, useRef } from 'react';
import type { ExchangeRate, DollarIndexData, InvestmentSignal } from '../types';
import { fetchCurrentExchangeRate, getCurrentRateValue, fetchLastUpdateTime, fetchExchangeRateHistory } from '../services/exchangeRateService';
import { fetchDollarIndex, fetchWeeklyAverages } from '../services/dollarIndexService';
import {
  calculateGapRatio,
  calculateAppropriateRate,
  checkInvestmentSuitability,
} from '../services/calculationService';
import { sendInvestmentNotification, getNotificationPermission } from '../utils/notificationService';

interface AnalysisData {
  exchangeRate: ExchangeRate | null;
  dollarIndex: DollarIndexData | null;
  weeklyAverages: {
    exchangeRate: { low: number; high: number; average: number };
    dollarIndex: { low: number; high: number; average: number };
    gapRatio: { average: number };
    date?: string;
  } | null;
  signal: InvestmentSignal | null;
  isLoading: boolean;
  error: string | null;
  lastUpdateTime: string | null;
  exchangeRateHistory: Array<{ date: string; rate: number }>;
}

export function useInvestmentAnalysis(): AnalysisData {
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
  const [dollarIndex, setDollarIndex] = useState<DollarIndexData | null>(null);
  const [weeklyAverages, setWeeklyAverages] = useState<AnalysisData['weeklyAverages']>(null);
  const [signal, setSignal] = useState<InvestmentSignal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
  const [exchangeRateHistory, setExchangeRateHistory] = useState<Array<{ date: string; rate: number }>>([]);
  
  // 이전 신호 상태를 추적하여 변경 감지
  const previousSignalRef = useRef<InvestmentSignal | null>(null);
  const lastNotificationTimeRef = useRef<number>(0);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);

      try {
        // 핵심 데이터를 먼저 로드 (히스토리는 나중에)
        const [rate, index, averages, updateTime] = await Promise.all([
          fetchCurrentExchangeRate(),
          fetchDollarIndex(),
          fetchWeeklyAverages(),
          fetchLastUpdateTime(),
        ]);
        
        setLastUpdateTime(updateTime);
        
        // 히스토리는 백그라운드에서 로드 (UI 블로킹 방지)
        fetchExchangeRateHistory().then(history => {
          setExchangeRateHistory(history);
        }).catch(err => {
          console.error('환율 히스토리 로드 실패:', err);
          setExchangeRateHistory([]);
        });

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

          // 신호 상태 변경 감지 및 알림 발송
          const previousSignal = previousSignalRef.current;
          if (previousSignal !== null && previousSignal.isSuitable !== investmentSignal.isSuitable) {
            // 상태가 변경되었고, 마지막 알림 후 5분이 지났는지 확인 (스팸 방지)
            const now = Date.now();
            const timeSinceLastNotification = now - lastNotificationTimeRef.current;
            const fiveMinutes = 5 * 60 * 1000;

            if (timeSinceLastNotification > fiveMinutes) {
              // 알림 권한이 있는 경우에만 알림 발송
              const notificationPermission = getNotificationPermission();
              if (notificationPermission.granted) {
                const details = `환율: ${currentRate.toFixed(2)}, 달러지수: ${currentDollarIndex.toFixed(2)}`;
                sendInvestmentNotification(investmentSignal.isSuitable, details);
                lastNotificationTimeRef.current = now;
              }
            }
          }

          previousSignalRef.current = investmentSignal;
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

    // 15분마다 데이터 새로고침 (환율 업데이트 주기와 동일)
    const interval = setInterval(() => {
      loadData();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    exchangeRate,
    dollarIndex,
    weeklyAverages,
    signal,
    isLoading,
    error,
    lastUpdateTime,
    exchangeRateHistory,
  };
}

