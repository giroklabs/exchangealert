/**
 * 배열에 대한 Z-score 계산
 * @param {number[]} arr
 * @returns {number[]}
 */
export function calcZScore(arr) {
    const n = arr.length;
    if (n === 0) return [];
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
    const std = Math.sqrt(variance);
    return arr.map(x => (std === 0 ? 0 : (x - mean) / std));
}

/**
 * rolling Z-score (윈도우 기준)
 * @param {number[]} arr
 * @param {number} window
 * @returns {number[]}
 */
export function rollingZScore(arr, window = 252) {
    return arr.map((v, i) => {
        const start = Math.max(0, i - window + 1);
        const slice = arr.slice(start, i + 1);
        const z = calcZScore(slice);
        return z[z.length - 1];
    });
}
