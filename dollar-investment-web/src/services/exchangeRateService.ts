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
 * 병렬 처리로 성능 최적화
 */
export async function fetchExchangeRateHistory(): Promise<Array<{ date: string; rate: number }>> {
  try {
    // 캐시 키 생성
    const cacheKey = 'exchange-rate-history';
    const cacheTimestampKey = 'exchange-rate-history-timestamp';
    const CACHE_DURATION = 15 * 60 * 1000; // 15분 캐시
    
    // 캐시 확인
    const cachedData = sessionStorage.getItem(cacheKey);
    const cachedTimestamp = sessionStorage.getItem(cacheTimestampKey);
    
    if (cachedData && cachedTimestamp) {
      const timestamp = parseInt(cachedTimestamp, 10);
      if (Date.now() - timestamp < CACHE_DURATION) {
        console.log('📦 환율 히스토리 캐시에서 로드');
        return JSON.parse(cachedData);
      }
    }
    
    // GitHub에서 최근 52주 히스토리 데이터 로드
    const today = new Date();
    
    // 날짜 배열 생성 (최근 52주, 약 364일)
    const datePromises: Array<Promise<{ date: string; rate: number } | null>> = [];
    const maxDays = 52 * 7;
    
    // 병렬로 모든 날짜에 대한 요청 생성
    for (let i = 0; i < maxDays; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const url = `https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/history/exchange-rates-${dateStr}.json`;
      
      // 각 날짜에 대한 fetch Promise 생성
      const promise = fetch(url)
        .then(response => {
          if (!response.ok) return null;
          return response.json();
        })
        .then((data: ExchangeRate[] | null) => {
          if (!data) return null;
          const usd = data.find((r) => r.cur_unit === 'USD');
          if (usd) {
            return {
              date: dateStr,
              rate: parseExchangeRate(usd.deal_bas_r),
            };
          }
          return null;
        })
        .catch(() => null);
      
      datePromises.push(promise);
      
      // 260개 요청이 충분하면 중단
      if (i >= 260) break;
    }
    
    // 모든 요청을 병렬로 실행 (배치 처리로 동시 요청 수 제한)
    const BATCH_SIZE = 20; // 동시에 20개씩 처리
    const results: Array<{ date: string; rate: number } | null> = [];
    
    for (let i = 0; i < datePromises.length; i += BATCH_SIZE) {
      const batch = datePromises.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
      
      // 유효한 데이터가 260개 이상이면 중단
      const validCount = results.filter(r => r !== null).length;
      if (validCount >= 260) break;
    }
    
    // null 제거 및 정렬
    const validHistory = results
      .filter((item): item is { date: string; rate: number } => item !== null)
      .sort((a, b) => a.date.localeCompare(b.date));
    
    // 캐시 저장
    sessionStorage.setItem(cacheKey, JSON.stringify(validHistory));
    sessionStorage.setItem(cacheTimestampKey, Date.now().toString());
    
    console.log(`✅ 환율 히스토리 로드 완료: ${validHistory.length}개 데이터`);
    return validHistory;
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

