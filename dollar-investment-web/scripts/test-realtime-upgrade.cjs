const https = require('https');
const fs = require('fs');
const path = require('path');

// 환경 변수 설정 (로컬 테스트용)
const KIS_APP_KEY = process.env.KIS_APP_KEY;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET;

async function fetchFromYahooFinance(symbol) {
    return new Promise((resolve) => {
        const options = {
            hostname: 'query1.finance.yahoo.com',
            port: 443,
            path: `/v8/finance/chart/${symbol}?interval=1d&range=5d`,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
            }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (!json.chart || !json.chart.result) return resolve(null);
                    const result = json.chart.result[0];
                    const quotes = result.indicators.quote[0];
                    const timestamps = result.timestamp;
                    if (!timestamps) return resolve(null);
                    const history = timestamps.map((t, i) => ({
                        date: new Date(t * 1000).toISOString().split('T')[0],
                        value: quotes.close[i]
                    })).filter(h => h.value !== null).reverse();
                    resolve(history);
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', (e) => resolve(null));
    });
}

function getKisToken() {
    if (!KIS_APP_KEY || !KIS_APP_SECRET) return Promise.resolve(null);
    return new Promise((resolve) => {
        const data = JSON.stringify({
            grant_type: "client_credentials",
            appkey: KIS_APP_KEY,
            appsecret: KIS_APP_SECRET
        });
        const options = {
            hostname: 'openapi.koreainvestment.com',
            port: 443,
            path: '/oauth2/tokenP',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve(json.access_token);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.write(data);
        req.end();
    });
}

async function fetchKISInvestorDeposits(token) {
    if (!token) return null;
    return new Promise((resolve) => {
        const options = {
            hostname: 'openapi.koreainvestment.com', port: 443,
            path: '/uapi/domestic-stock/v1/quotations/inquire-market-daily-price?fid_cond_mrkt_div_code=U&fid_input_iscd=0001',
            method: 'GET',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
                "appkey": KIS_APP_KEY, "appsecret": KIS_APP_SECRET,
                "tr_id": "FHKST01012400", "custtype": "P"
            }
        };
        const req = https.get(options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.output && json.output.length > 0) {
                        resolve(json.output.map(d => ({
                            date: d.stck_bsop_date,
                            value: Math.round(parseFloat(d.bstn_amt) / 100)
                        })).slice(0, 5));
                    } else resolve(null);
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
    });
}

async function test() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // 로컬 테스트용
    console.log('🚀 실시간 데이터 소스 업그레이드 테스트 시작...');

    const yahooSymbols = [
        { name: '달러인덱스(DXY)', symbol: 'DX-Y.NYB' },
        { name: '미 10년물 금리(TNX)', symbol: '^TNX' },
        { name: 'VIX 공포지수', symbol: '^VIX' },
        { name: 'SOX 반도체지수', symbol: '^SOX' },
        { name: 'WTI 원유선물', symbol: 'CL=F' },
        { name: '한국 10년물 국채(Yahoo)', symbol: 'KR10YT=RR' }
    ];

    console.log('\n--- [Yahoo Finance 테스트] ---');
    for (const s of yahooSymbols) {
        const hist = await fetchFromYahooFinance(s.symbol);
        if (hist && hist.length > 0) {
            console.log(`✅ ${s.name} (${s.symbol}): ${hist[0].value} (최신날짜: ${hist[0].date})`);
        } else {
            console.log(`❌ ${s.name} (${s.symbol}) 수집 실패`);
        }
    }

    console.log('\n--- [KIS API 테스트] ---');
    const token = await getKisToken();
    if (token) {
        const deposits = await fetchKISInvestorDeposits(token);
        if (deposits && deposits.length > 0) {
            console.log(`✅ 투자자예탁금: ${deposits[0].value}억원 (최신날짜: ${deposits[0].date})`);
        } else {
            console.log(`❌ 투자자예탁금 수집 실패 (TR: FHKST01012400)`);
        }
    } else {
        console.log('❌ KIS 토큰 발급 실패. API 키를 확인해 주세요.');
    }
}

test();
