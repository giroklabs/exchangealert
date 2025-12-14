import type { DollarIndexData } from '../types';

/**
 * 달러 지수 데이터 서비스
 * GitHub에서 달러 지수 데이터를 로드
 */

// GitHub Raw URL
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com';
const REPO_PATH = 'giroklabs/exchangealert';

/**
 * 달러 지수 데이터 로드
 */
export async function fetchDollarIndex(): Promise<DollarIndexData | null> {
  try {
    // GitHub Pages에서는 상대 경로 사용 (public/data가 dist/data로 복사됨)
    const url = '/data/dollar-index.json';

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
    const url = '/data/weekly-averages.json';

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

