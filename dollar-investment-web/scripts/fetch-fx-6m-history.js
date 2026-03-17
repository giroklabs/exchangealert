import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, '../public/data/fx-history-6m.json');
const ROOT_OUTPUT_PATH = path.join(__dirname, '../../data/fx-history-6m.json');

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
    console.log('Fetching 6-month USD/KRW history from Yahoo Finance...');
    try {
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?range=6mo&interval=1d';
        const rawData = await fetchJson(url);

        if (!rawData.chart || !rawData.chart.result || !rawData.chart.result[0]) {
            throw new Error('Invalid data format from Yahoo Finance');
        }

        const result = rawData.chart.result[0];
        const timestamps = result.timestamp;
        const quotes = result.indicators.quote[0];

        const history = timestamps.map((ts, i) => {
            const date = new Date(ts * 1000).toISOString().split('T')[0];
            return {
                date,
                high: quotes.high[i] ? parseFloat(quotes.high[i].toFixed(2)) : null,
                low: quotes.low[i] ? parseFloat(quotes.low[i].toFixed(2)) : null,
                close: quotes.close[i] ? parseFloat(quotes.close[i].toFixed(2)) : null
            };
        }).filter(item => item.high !== null && item.low !== null)
          .sort((a, b) => b.date.localeCompare(a.date)); // 최신순 정렬

        const finalData = {
            lastUpdate: new Date().toISOString(),
            data: history
        };

        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2));
        
        // 루트 data 폴더에도 저장하여 외부 연동 지원
        const rootOutputDir = path.dirname(ROOT_OUTPUT_PATH);
        if (!fs.existsSync(rootOutputDir)) {
            fs.mkdirSync(rootOutputDir, { recursive: true });
        }
        fs.writeFileSync(ROOT_OUTPUT_PATH, JSON.stringify(finalData, null, 2));

        console.log(`Successfully saved 6-month history to:\n1. ${OUTPUT_PATH}\n2. ${ROOT_OUTPUT_PATH}\n(${history.length} days)`);
    } catch (error) {
        console.error('Failed to fetch FX history:', error);
        process.exit(1);
    }
}

main();
