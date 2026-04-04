/**
 * 지수평균 (EMA)
 * @param {number[]} data
 * @param {number} period
 * @returns {number[]}
 */
export function calculateEMA(data, period) {
    if (!data || data.length === 0) return [];
    
    // If we have fewer data points than the period, just calculate EMA over what we have
    const actualPeriod = Math.min(period, data.length);
    const k = 2 / (actualPeriod + 1);
    
    const emas = [];
    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            emas.push(data[i]);
        } else {
            const prev = emas[emas.length - 1];
            const ema = data[i] * k + prev * (1 - k);
            emas.push(ema);
        }
    }
    return emas;
}
