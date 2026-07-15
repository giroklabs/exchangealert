/**
 * 시장 대시보드 및 예측 모델을 위한 수학/통계 유틸리티 모듈
 */

/**
 * 오버나잇 프리미엄 계산 (부동 소수점 오차 방지)
 * 수식: ((야간 선물가 - 전일 정규장 종가) / 전일 정규장 종가) * 100
 * @param {number} regClose 전일 정규장 종가 (15:45 마감)
 * @param {number} nightClose 야간 선물 마감가 (05:00 마감)
 * @returns {number} 프리미엄 (%) - 소수점 2자리 반올림
 */
export function calculateOvernightPremium(regClose, nightClose) {
    if (!regClose || !nightClose || regClose <= 0) return 0;
    
    // 정밀도를 위해 소수점 4자리까지 계산 후 2자리에서 반올림
    const rawPremium = ((nightClose - regClose) / regClose) * 100;
    return parseFloat(rawPremium.toFixed(2));
}

/**
 * 허용 오차 내에서 두 수치가 일치하는지 확인 (테스트용)
 * @param {number} actual 실제값
 * @param {number} expected 기대값
 * @param {number} tolerance 허용 오차 (기본 0.01)
 * @returns {boolean}
 */
export function isWithinTolerance(actual, expected, tolerance = 0.01) {
    return Math.abs(actual - expected) <= tolerance;
}

/**
 * 시초가 예상 강도 분류
 * @param {number} premium 오버나잇 프리미엄 (%)
 * @returns {Object} { trend: '상승'|'하락'|'보합', level: '강'|'약'|'중' }
 */
export function getPremiumSentiment(premium) {
    const absPrem = Math.abs(premium);
    const trend = premium > 0.1 ? '상승' : (premium < -0.1 ? '하락' : '보합');
    let level = '약';
    
    if (absPrem >= 0.5) level = '강';
    else if (absPrem >= 0.2) level = '중';
    
    return { trend, level };
}
