/**
 * 코스피(KOSPI) 6개월 히스토리 수집 스크립트
 * Yahoo Finance에서 ^KS11 데이터를 가져와 기술적 지표 계산용 히스토리를 저장합니다.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, '../public/data/kospi-history-6m.json');

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('📈 Fetching 6-month KOSPI history from Yahoo Finance (^KS11)...');
    try {
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?range=6mo&interval=1d';
        const rawData = await fetchJson(url);

        if (!rawData.chart || !rawData.chart.result || !rawData.chart.result[0]) {
            throw new Error('Invalid data format from Yahoo Finance for KOSPI');
        }

        const result = rawData.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];

        const historyMap = new Map();
        timestamps.forEach((ts, i) => {
            const date = new Date(ts * 1000).toISOString().split('T')[0];
            const open = quotes.open[i];
            const high = quotes.high[i];
            const low = quotes.low[i];
            const close = quotes.close[i];
            const volume = quotes.volume[i];

            if (high !== null && low !== null && close !== null) {
                historyMap.set(date, {
                    date,
                    open: parseFloat(open?.toFixed(2) || '0'),
                    high: parseFloat(high.toFixed(2)),
                    low: parseFloat(low.toFixed(2)),
                    close: parseFloat(close.toFixed(2)),
                    volume: volume || 0
                });
            }
        });

        const history = Array.from(historyMap.values())
            .sort((a, b) => b.date.localeCompare(a.date)); // 최신순 정렬

        const finalData = {
            symbol: '^KS11',
            name: 'KOSPI',
            lastUpdate: new Date().toISOString(),
            data: history
        };

        fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2));

        console.log(`✅ KOSPI 6개월 히스토리 저장 완료: ${OUTPUT_PATH} (${history.length}일치)`);
        if (history.length > 0) {
            console.log(`   최신: ${history[0].date} → ${history[0].close}pt`);
            console.log(`   최고: ${Math.max(...history.map(h => h.high)).toFixed(2)}pt`);
            console.log(`   최저: ${Math.min(...history.map(h => h.low)).toFixed(2)}pt`);
        }
    } catch (error) {
        console.error('❌ KOSPI 히스토리 수집 실패:', error.message);
        process.exit(1);
    }
}

main();
