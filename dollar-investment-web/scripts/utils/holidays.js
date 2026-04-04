/**
 * 2026년 한국 및 미국 거래 휴장일 관리 유틸리티
 */

const TRADING_HOLIDAYS_2026 = {
    'KR': [
        { date: "2026-01-01", name: "New Year's Day" },
        { date: "2026-02-16", name: "Seollal (Lunar New Year) Holiday" },
        { date: "2026-02-17", name: "Seollal (Lunar New Year)" },
        { date: "2026-02-18", name: "Seollal (Lunar New Year) Holiday" },
        { date: "2026-03-01", name: "Independence Movement Day" },
        { date: "2026-03-02", name: "Substitute Independence Day" },
        { date: "2026-05-05", name: "Children's Day" },
        { date: "2026-05-24", name: "Buddha's Birthday" },
        { date: "2026-05-25", name: "Substitute Buddha's Birthday" },
        { date: "2026-06-03", name: "Local Election Day" },
        { date: "2026-06-06", name: "Memorial Day" },
        { date: "2026-08-15", name: "Liberation Day" },
        { date: "2026-08-17", name: "Substitute Graduation Day" },
        { date: "2026-09-24", name: "Chuseok Holiday" },
        { date: "2026-09-25", name: "Chuseok" },
        { date: "2026-09-26", name: "Chuseok Holiday" },
        { date: "2026-10-03", name: "National Foundation Day" },
        { date: "2026-10-05", name: "Substitute National Foundation Day" },
        { date: "2026-10-09", name: "Hangeul Proclamation Day" },
        { date: "2026-12-25", name: "Christmas Day" }
    ],
    'US': [
        { date: "2026-01-01", name: "New Year's Day" },
        { date: "2026-01-19", name: "Martin Luther King Jr. Day" },
        { date: "2026-02-16", name: "Presidents' Day" },
        { date: "2026-04-03", name: "Good Friday" }, // 🌟 [추가] 사용자의 누락분 보강 (VIX/미증시 휴장)
        { date: "2026-05-25", name: "Memorial Day" },
        { date: "2026-06-19", name: "Juneteenth" },
        { date: "2026-07-03", name: "Independence Day (Observed)" },
        { date: "2026-09-07", name: "Labor Day" },
        { date: "2026-11-26", name: "Thanksgiving Day" },
        { date: "2026-12-25", name: "Christmas Day" }
    ]
};

/**
 * 특정 날짜가 해당 국가의 거래 휴장일인지 확인
 * @param {string} dateStr "YYYY-MM-DD"
 * @param {string} region "KR" 또는 "US"
 * @returns {boolean} 휴장일 여부
 */
export function isTradingHoliday(dateStr, region = 'US') {
    const holidays = TRADING_HOLIDAYS_2026[region.toUpperCase()] || [];
    const dateOnly = dateStr.split(',')[0].trim(); // 날짜만 추출 (시각 제외)
    
    // 1. 주말 체크 (0: 일, 6: 토)
    const day = new Date(dateOnly).getDay();
    if (day === 0 || day === 6) return true;
    
    // 2. 명시적 공휴일 리스트 체크
    return holidays.some(h => h.date === dateOnly);
}
