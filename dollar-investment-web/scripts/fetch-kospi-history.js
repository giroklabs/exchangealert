/**
 * 코스피(KOSPI) 6개월 히스토리 수집 스크립트
 * KIS API(한국투자증권)를 우선 사용하고, 실패 시 Yahoo Finance를 폴백으로 사용합니다.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = path.join(__dirname, '../public/data/kospi-history-6m.json');

// 환경 변수 로드
const KIS_APP_KEY = process.env.KIS_APP_KEY;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET;
const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

async function getKisAccessToken() {
    if (!KIS_APP_KEY || !KIS_APP_SECRET) return null;
    
    try {
        const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: "client_credentials",
                appkey: KIS_APP_KEY,
                appsecret: KIS_APP_SECRET
            })
        });
        const data = await res.json();
        return data.access_token || null;
    } catch (e) {
        console.error('❌ KIS 토큰 발급 실패:', e.message);
        return null;
    }
}

async function fetchFromKIS(token) {
    console.log('  → KIS API로 코스피(0001) 히스토리 조회 중...');
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const endDate = today.toISOString().split('T')[0].replace(/-/g, '');
    const startDate = sixMonthsAgo.toISOString().split('T')[0].replace(/-/g, '');

    const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice?fid_cond_mrkt_div_code=U&fid_input_iscd=0001&fid_input_date_1=${startDate}&fid_input_date_2=${endDate}&fid_period_div_code=D`;
    
    try {
        const res = await fetch(url, {
            headers: {
                "Content-Type": "application/json",
                "authorization": `Bearer ${token}`,
                "appkey": KIS_APP_KEY,
                "appsecret": KIS_APP_SECRET,
                "tr_id": "FHKUP03500100",
                "custtype": "P"
            }
        });
        const data = await res.json();
        
        if (data.output2 && data.output2.length > 0) {
            return data.output2.map(d => ({
                date: d.stck_bsop_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
                open: parseFloat(d.bstp_nmix_oprc) || 0,
                high: parseFloat(d.bstp_nmix_hgpr) || 0,
                low: parseFloat(d.bstp_nmix_lwpr) || 0,
                close: parseFloat(d.bstp_nmix_prpr) || 0,
                volume: parseInt(d.acml_vol) || 0
            })).sort((a, b) => b.date.localeCompare(a.date));
        }
    } catch (e) {
        console.error('❌ KIS API 호출 에러:', e.message);
    }
    return null;
}

function fetchFromYahoo() {
    console.log('  → Yahoo Finance 폴백으로 코스피(^KS11) 히스토리 조회 중...');
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?range=6mo&interval=1d';
    return new Promise((resolve, reject) => {
        https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const result = json.chart.result[0];
                    const ts = result.timestamp;
                    const qt = result.indicators.quote[0];
                    const history = ts.map((t, i) => ({
                        date: new Date(t * 1000).toISOString().split('T')[0],
                        open: parseFloat(qt.open[i]?.toFixed(2) || '0'),
                        high: parseFloat(qt.high[i]?.toFixed(2) || '0'),
                        low: parseFloat(qt.low[i]?.toFixed(2) || '0'),
                        close: parseFloat(qt.close[i]?.toFixed(2) || '0'),
                        volume: qt.volume[i] || 0
                    })).filter(d => d.close > 0).sort((a, b) => b.date.localeCompare(a.date));
                    resolve(history);
                } catch (e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function main() {
    let history = null;
    let source = 'NONE';

    // 1. KIS API 시도
    const token = await getKisAccessToken();
    if (token) {
        history = await fetchFromKIS(token);
        if (history) source = 'KIS';
    }

    // 2. Yahoo Finance 폴백
    if (!history) {
        try {
            history = await fetchFromYahoo();
            if (history) source = 'Yahoo';
        } catch (e) {
            console.error('❌ Yahoo Finance 폴백 실패:', e.message);
        }
    }

    if (history && history.length > 0) {
        const finalData = {
            symbol: source === 'KIS' ? 'KOSPI' : '^KS11',
            name: 'KOSPI',
            source: source,
            lastUpdate: new Date().toISOString(),
            data: history
        };
        fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalData, null, 2));
        console.log(`✅ 코스피 히스토리 저장 완료 (${source}, ${history.length}일치, 최신: ${history[0].date} → ${history[0].close}pt)`);
    } else {
        console.error('❌ 모든 데이터 수집 수단이 실패했습니다.');
        process.exit(1);
    }
}

main();
