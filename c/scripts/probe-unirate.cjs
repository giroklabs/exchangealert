// UniRateAPI 시험 조회 (저장하지 않음). 실시간 시장 환율이 원화로 오는지, 수출입은행 고시와 얼마나 다른지 본다.
// 실행: UNIRATE_API_KEY=... node c/scripts/probe-unirate.cjs
// 키 값은 출력하지 않는다.
const fs = require('fs');
const path = require('path');

const KEY = process.env.UNIRATE_API_KEY;
const EXIM_FILE = path.join(__dirname, '..', '..', 'data', 'exchange-rates.json');
const CODES = ['USD', 'JPY', 'EUR', 'CNY', 'GBP', 'HKD', 'IDR'];
const PER_100 = new Set(['JPY', 'IDR']);

function eximRates() {
    try {
        const items = JSON.parse(fs.readFileSync(EXIM_FILE, 'utf8'));
        const meta = items.find(i => i.cur_unit === 'META') || {};
        const map = {};
        for (const i of items) {
            const n = parseFloat(String(i.deal_bas_r || '').replace(/,/g, ''));
            if (i.cur_unit !== 'META' && n > 0) map[i.cur_unit] = n;
        }
        return { meta, map };
    } catch {
        return { meta: {}, map: {} };
    }
}

async function main() {
    if (!KEY) {
        console.log('⚠️ UNIRATE_API_KEY 시크릿이 없어 시험 조회를 건너뜁니다.');
        return;
    }
    const url = `https://api.unirateapi.com/api/rates?api_key=${encodeURIComponent(KEY)}&from=USD`;
    const started = Date.now();
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    console.log(`HTTP ${response.status}, ${text.length} bytes, ${Date.now() - started} ms`);

    let data;
    try {
        data = JSON.parse(text);
    } catch {
        console.log('❌ JSON이 아닌 응답:', text.slice(0, 200).replace(KEY, '***'));
        process.exitCode = 1;
        return;
    }
    console.log('응답 최상위 키:', Object.keys(data).join(', '));
    for (const k of ['base', 'from', 'date', 'timestamp', 'last_updated', 'updated', 'time']) {
        if (data[k] !== undefined) console.log(`  ${k}: ${JSON.stringify(data[k])}`);
    }

    const rates = data.rates || data.data || {};
    const count = Object.keys(rates).length;
    console.log(`통화 수: ${count}`);
    const usdKrw = parseFloat(rates.KRW);
    if (!(usdKrw > 0)) {
        console.log('❌ KRW가 응답에 없습니다.');
        process.exitCode = 1;
        return;
    }

    const exim = eximRates();
    console.log(`\n비교 기준: 수출입은행 ${exim.meta.rate_date || '?'} 고시`);
    console.log('통화 | UniRate(원) | 수출입은행(원) | 차이');
    for (const code of CODES) {
        const perUsd = code === 'USD' ? 1 : parseFloat(rates[code]);
        if (!(perUsd > 0)) {
            console.log(`${code} | 응답에 없음`);
            continue;
        }
        const krw = (usdKrw / perUsd) * (PER_100.has(code) ? 100 : 1);
        const e = exim.map[code];
        const diff = e ? `${(krw - e >= 0 ? '+' : '')}${(krw - e).toFixed(2)} (${(((krw - e) / e) * 100).toFixed(2)}%)` : '-';
        console.log(`${code}${PER_100.has(code) ? '(100)' : ''} | ${krw.toFixed(2)} | ${e ?? '-'} | ${diff}`);
    }
}

main().catch(error => {
    console.error('❌ 시험 조회 실패:', String(error.message || error).replace(KEY || '\u0000', '***'));
    process.exitCode = 1;
});
