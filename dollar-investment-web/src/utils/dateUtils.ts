/**
 * 날짜 유틸리티 함수
 */

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * YYYYMMDD 형식을 YYYY-MM-DD로 변환
 */
export function formatDateFromString(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

/**
 * 날짜 문자열을 Date 객체로 변환
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * N일 전 날짜 반환
 */
export function getDaysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

/**
 * 52주 전 날짜 반환
 */
export function get52WeeksAgo(): Date {
  return getDaysAgo(52 * 7);
}

