import type { CalculationResult, InvestmentSignal } from '../types';

/**
 * 계산 서비스
 * 52주 평균, 달러 갭 비율, 적정 환율 등을 계산
 */

/**
 * 52주 평균 계산 (최저, 최고, 평균)
 */
export function calculate52WeekAverage(data: number[]): CalculationResult {
  if (data.length === 0) {
    return { low: 0, high: 0, average: 0 };
  }

  const sorted = [...data].sort((a, b) => a - b);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  const sum = data.reduce((acc, val) => acc + val, 0);
  const average = sum / data.length;

  return { low, high, average };
}

/**
 * 달러 갭 비율 계산
 * 공식: (원/달러 환율) ÷ (달러 지수) × 100
 */
export function calculateGapRatio(exchangeRate: number, dollarIndex: number): number {
  if (dollarIndex === 0) return 0;
  return (exchangeRate / dollarIndex) * 100;
}

/**
 * 적정 환율 계산
 * 공식: 현재 달러 지수 ÷ 52주 평균 달러 갭 비율 × 100
 */
export function calculateAppropriateRate(
  currentDollarIndex: number,
  avgGapRatio: number
): number {
  if (avgGapRatio === 0) return 0;
  return (currentDollarIndex / avgGapRatio) * 100;
}

/**
 * 투자 적합성 판단
 * 4가지 조건을 모두 만족해야 투자 적합
 */
export function checkInvestmentSuitability(
  currentRate: number,
  avgRate: number,
  currentDollarIndex: number,
  avgDollarIndex: number,
  currentGapRatio: number,
  avgGapRatio: number,
  appropriateRate: number
): InvestmentSignal {
  const conditions = {
    // 조건 1: 현재 원/달러 환율 < 52주 평균 환율
    rateBelowAverage: currentRate < avgRate,
    // 조건 2: 현재 달러 지수 < 52주 평균 달러 지수
    dollarIndexBelowAverage: currentDollarIndex < avgDollarIndex,
    // 조건 3: 현재 달러 갭 비율 > 52주 평균 달러 갭 비율
    gapRatioAboveAverage: currentGapRatio > avgGapRatio,
    // 조건 4: 현재 원/달러 환율 < 적정 환율
    rateBelowAppropriate: currentRate < appropriateRate,
  };

  // 모든 조건을 만족해야 투자 적합
  const isSuitable =
    conditions.rateBelowAverage &&
    conditions.dollarIndexBelowAverage &&
    conditions.gapRatioAboveAverage &&
    conditions.rateBelowAppropriate;

  return {
    isSuitable,
    conditions,
    appropriateRate,
    currentGapRatio,
    averageGapRatio: avgGapRatio,
  };
}

/**
 * 환율 문자열을 숫자로 변환 (콤마 제거)
 */
export function parseExchangeRate(rateStr: string): number {
  return parseFloat(rateStr.replace(/,/g, ''));
}

