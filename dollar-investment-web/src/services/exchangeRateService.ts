import type { ExchangeRate } from '../types';
import { parseExchangeRate } from './calculationService';

/**
 * 환율 데이터 서비스
 * GitHub Pages에서 환율 데이터를 로드
 */

/**
 * 현재 환율 데이터 로드
 */
export async function fetchCurrentExchangeRate(): Promise<ExchangeRate | null> {
  try {
    // 실제 환율 데이터는 GitHub의 data/exchange-rates.json에서 로드
    // 이 파일은 GitHub Actions로 15분마다 자동 업데이트됨
    const url = import.meta.env.PROD 
      ? 'https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json'
      : 'https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/exchange-rates.json';

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: ExchangeRate[] = await response.json();
    const usdRate = data.find((rate) => rate.cur_unit === 'USD');
    return usdRate || null;
  } catch (error) {
    console.error('환율 데이터 로드 실패:', error);
    return null;
  }
}

/**
 * 환율 데이터 마지막 업데이트 시간 로드
 */
export async function fetchLastUpdateTime(): Promise<string | null> {
  try {
    const url = import.meta.env.PROD 
      ? 'https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/last-update.txt'
      : 'https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/last-update.txt';

    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    return text.trim();
  } catch (error) {
    console.error('업데이트 시간 로드 실패:', error);
    return null;
  }
}

/**
 * 환율 히스토리 데이터 로드 (52주)
 */
export async function fetchExchangeRateHistory(): Promise<Array<{ date: string; rate: number }>> {
  try {
    // 실제 구현 시 GitHub에서 히스토리 데이터를 로드
    // 여기서는 예시로 빈 배열 반환
    const history: Array<{ date: string; rate: number }> = [];

    // 로컬 개발 환경에서는 data/history 폴더에서 로드
    if (import.meta.env.DEV) {
      // 개발 환경에서는 샘플 데이터 사용
      return history;
    }

    return history;
  } catch (error) {
    console.error('환율 히스토리 로드 실패:', error);
    return [];
  }
}

/**
 * 현재 환율을 숫자로 반환
 */
export function getCurrentRateValue(rate: ExchangeRate | null): number {
  if (!rate) return 0;
  return parseExchangeRate(rate.deal_bas_r);
}

