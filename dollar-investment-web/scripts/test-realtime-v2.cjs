const https = require('https');

async function fetchFromYahooFinance(symbol) {
    return new Promise((resolve, reject) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
        const options = {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const result = json.chart.result[0];
                    const quote = result.indicators.quote[0];
                    const timestamps = result.timestamp;
                    if (!timestamps || !quote || !quote.close) {
                        resolve(null);
                        return;
                    }
                    const history = timestamps.map((t, i) => ({
                        time: new Date(t * 1000).toISOString(),
                        date: new Date(t * 1000).toISOString().split('T')[0],
                        value: quote.close[i]
                    })).filter(h => h.value !== null).reverse();
                    resolve(history);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

const symbols = [
    { name: 'DXY', sym: 'DX-Y.NYB' },
    { name: 'US 10Y', sym: '^TNX' },
    { name: 'VIX', sym: '^VIX' },
    { name: 'SOX', sym: '^SOX' },
    { name: 'WTI', sym: 'CL=F' },
    { name: 'KR 10Y', sym: 'KR10YT=RR' }
];

(async () => {
    console.log(`🚀 Starting Yahoo Finance real-time test (Local time: ${new Date().toLocaleString()})...`);
    for (const s of symbols) {
        try {
            const history = await fetchFromYahooFinance(s.sym);
            if (history && history.length > 0) {
                console.log(`✅ [Yahoo] ${s.name} (${s.sym}): ${history[0].value.toFixed(2)} (Last point: ${history[0].time})`);
            } else {
                console.log(`❌ [Yahoo] ${s.name} (${s.sym}): No data`);
            }
        } catch (e) {
            console.log(`❌ [Yahoo] ${s.name} (${s.sym}): Error - ${e.message}`);
        }
    }
})();
