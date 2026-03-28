const https = require('https');

async function fetchFromYahooFinance(symbol) {
    return new Promise((resolve, reject) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.chart.result && json.chart.result[0].timestamp) {
                        const val = json.chart.result[0].indicators.quote[0].close.filter(v => v !== null).reverse()[0];
                        resolve(val);
                    } else resolve(null);
                } catch (e) { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

const symbols = [
    { name: 'KOSPI', sym: '^KS11' },
    { name: 'USD/KRW', sym: 'KRW=X' },
    { name: 'KR 10Y (RR)', sym: 'KR10YT=RR' },
    { name: 'KR 10Y (KS)', sym: 'KR10Y.KS' }
];

(async () => {
    for (const s of symbols) {
        const val = await fetchFromYahooFinance(s.sym);
        console.log(`${s.name} (${s.sym}): ${val || 'FAILED'}`);
    }
})();
