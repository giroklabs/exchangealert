import type { DollarIndexData } from '../types';

/**
 * 달러 지수 데이터 서비스
 * GitHub Pages에서 달러 지수 데이터를 로드
 */

/**
 * 달러 지수 데이터 로드
 */
export async function fetchDollarIndex(): Promise<DollarIndexData | null> {
  try {
    // Vite의 base 경로를 사용하여 올바른 경로 생성
    const baseUrl = import.meta.env.BASE_URL || '/';
    const url = `${baseUrl}data/dollar-index.json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: DollarIndexData = await response.json();
    return data;
  } catch (error) {
    console.error('달러 지수 데이터 로드 실패:', error);
    return null;
  }
}

/**
 * 52주 평균 데이터 로드
 */
export async function fetchWeeklyAverages(): Promise<{
  exchangeRate: { low: number; high: number; average: number };
  dollarIndex: { low: number; high: number; average: number };
  gapRatio: { average: number };
} | null> {
  try {
    const baseUrl = import.meta.env.BASE_URL || '/';
    const url = `${baseUrl}data/weekly-averages.json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('52주 평균 데이터 로드 실패:', error);
    return null;
  }
}

