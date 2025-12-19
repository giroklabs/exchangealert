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
    // GitHub에서 최근 52주 히스토리 데이터 로드
    // 실제로는 GitHub API를 통해 파일 목록을 가져와야 하지만,
    // 여기서는 최근 날짜들을 직접 계산하여 로드
    const history: Array<{ date: string; rate: number }> = [];
    const today = new Date();
    
    // 최근 52주 데이터 수집 (영업일 기준이므로 실제로는 더 적을 수 있음)
    // 52주 = 약 260 영업일이므로 최대 260개까지 수집
    for (let i = 0; i < 52 * 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // 날짜 형식: YYYY-MM-DD
      const dateStr = date.toISOString().split('T')[0];
      
      try {
        const url = import.meta.env.PROD
          ? `https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/history/exchange-rates-${dateStr}.json`
          : `https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/history/exchange-rates-${dateStr}.json`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data: ExchangeRate[] = await response.json();
          const usd = data.find((r) => r.cur_unit === 'USD');
          if (usd) {
            history.push({
              date: dateStr,
              rate: parseExchangeRate(usd.deal_bas_r),
            });
          }
        }
        
        // 52주치 데이터가 충분하면 중단 (약 260 영업일)
        if (history.length >= 260) break;
      } catch (e) {
        // 파일이 없으면 건너뛰기
        continue;
      }
    }
    
    // 날짜순으로 정렬 (오래된 것부터)
    return history.sort((a, b) => a.date.localeCompare(b.date));
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

