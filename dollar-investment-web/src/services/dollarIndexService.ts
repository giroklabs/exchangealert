import type { DollarIndexData } from '../types';

/**
 * 달러 지수 데이터 서비스
 * GitHub에서 달러 지수 데이터를 로드
 */

// GitHub Raw URL (실제 사용 시 저장소 경로로 변경 필요)
const GITHUB_BASE_URL = 'https://raw.githubusercontent.com';
const REPO_PATH = 'your-username/your-repo'; // 실제 저장소 경로로 변경

/**
 * 달러 지수 데이터 로드
 */
export async function fetchDollarIndex(): Promise<DollarIndexData | null> {
  try {
    // 로컬 개발 환경에서는 상대 경로 사용
    const url = import.meta.env.DEV
      ? '/data/dollar-index.json'
      : `${GITHUB_BASE_URL}/${REPO_PATH}/main/data/dollar-index.json`;

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
    const url = import.meta.env.DEV
      ? '/data/weekly-averages.json'
      : `${GITHUB_BASE_URL}/${REPO_PATH}/main/data/weekly-averages.json`;

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

