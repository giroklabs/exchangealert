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
    // GitHub Pages에서는 base 경로를 포함한 경로 사용
    const url = import.meta.env.PROD 
      ? '/exchangealert/data/exchange-rates.json'
      : '/data/exchange-rates.json';

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

