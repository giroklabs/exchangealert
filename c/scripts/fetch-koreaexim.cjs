// 한국수출입은행 현재환율 Open API(AP01)로 data/exchange-rates.json을 만든다.
// 2026-11-12부터 네이버 내부 주소가 GitHub 서버의 요청을 거부해 공식 출처로 옮겼다.
//
// - 영업일에 하루 한 번 고시된다. 고시 전이거나 휴일이면 빈 배열이 온다.
// - 이미 오늘 고시분을 받았으면 API를 부르지 않는다 (하루 호출 한도 보호).
// - 기존 파일 형식(cur_unit, deal_bas_r, ttb, tts, cur_nm …)을 그대로 지켜 앱·알림·차트가 바뀌지 않게 한다.
// - 출력: GITHUB_OUTPUT에 updated=true|false
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OUTPUT = path.join(ROOT, 'data', 'exchange-rates.json');
const API = 'https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON';
const LOOKBACK_DAYS = 7;

// 앱이 쓰는 통화와 데이터 파일의 표기 (기존 네이버 수집과 같은 표기)
const CODE_MAP = {
    USD: 'USD', 'JPY(100)': 'JPY', EUR: 'EUR', GBP: 'GBP', CNH: 'CNY', AUD: 'AUD', CAD: 'CAD', CHF: 'CHF',
    HKD: 'HKD', THB: 'THB', SGD: 'SGD', NZD: 'NZD', SEK: 'SEK', NOK: 'NOK', DKK: 'DKK', MYR: 'MYR',
    SAR: 'SAR', AED: 'AED', KWD: 'KWD', BHD: 'BHD', 'IDR(100)': 'IDR', BND: 'BND',
};
const NAMES = {
    USD: '미국 달러', JPY: '일본 엔', EUR: '유로', GBP: '영국 파운드', CNY: '중국 위안', AUD: '호주 달러',
    CAD: '캐나다 달러', CHF: '스위스 프랑', HKD: '홍콩 달러', THB: '태국 바트', SGD: '싱가포르 달러',
    NZD: '뉴질랜드 달러', SEK: '스웨덴 크로나', NOK: '노르웨이 크로네', DKK: '덴마크 크로네',
    MYR: '말레이시아 링깃', SAR: '사우디 리얄', AED: '아랍에미리트 디르함', KWD: '쿠웨이트 디나르',
    BHD: '바레인 디나르', IDR: '인도네시아 루피아', BND: '브루나이 달러',
};
const RESULT_ERRORS = { 2: 'DATA 코드 오류', 3: '인증키 오류', 4: '일일 호출 한도 초과' };

function kstParts(date) {
    const kst = new Date(date.getTime() + 9 * 3600 * 1000);
    const y = kst.getUTCFullYear();
    const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const d = String(kst.getUTCDate()).padStart(2, '0');
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const mm = String(kst.getUTCMinutes()).padStart(2, '0');
    const ss = String(kst.getUTCSeconds()).padStart(2, '0');
    return { ymd: `${y}${m}${d}`, iso: `${y}-${m}-${d}`, stamp: `${y}-${m}-${d}T${hh}:${mm}:${ss}+0900` };
}

function parseNumber(text) {
    const n = parseFloat(String(text ?? '').replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
}

function readCurrentMeta() {
    try {
        const items = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
        return items.find(i => i.cur_unit === 'META') || null;
    } catch {
        return null;
    }
}

async function fetchDay(authkey, ymd) {
    const url = `${API}?authkey=${encodeURIComponent(authkey)}&searchdate=${ymd}&data=AP01`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error(`JSON이 아닌 응답: ${text.slice(0, 120)}`);
    }
    if (!Array.isArray(data)) throw new Error('배열이 아닌 응답');
    const bad = data.find(item => item.result !== 1);
    if (bad) throw new Error(`API 결과 코드 ${bad.result} (${RESULT_ERRORS[bad.result] || '알 수 없음'})`);
    return data;
}

function buildFile(items, rateDate, now) {
    const meta = { result: 1, cur_unit: 'META', fetched_at: kstParts(now).stamp, rate_date: rateDate, source: 'koreaexim' };
    const rows = [];
    for (const item of items) {
        const code = CODE_MAP[item.cur_unit];
        const rate = parseNumber(item.deal_bas_r);
        if (!code || !rate) continue;
        // 앱은 살때·팔때를 "매매기준율 ±1.8% 참고값"으로 안내한다. 기존 수집과 같은 계산을 유지한다.
        rows.push({
            result: 1,
            cur_unit: code,
            ttb: (rate * 1.018).toFixed(2),
            tts: (rate * 0.982).toFixed(2),
            deal_bas_r: item.deal_bas_r,
            bkpr: item.bkpr ?? String(Math.trunc(rate)),
            yy_efee_r: item.yy_efee_r ?? '0',
            ten_dd_efee_r: item.ten_dd_efee_r ?? '0',
            kftc_bkpr: item.kftc_bkpr ?? String(Math.trunc(rate)),
            kftc_deal_bas_r: item.kftc_deal_bas_r ?? item.deal_bas_r,
            cur_nm: NAMES[code] || item.cur_nm,
        });
    }
    return [meta, ...rows];
}

function setOutput(updated) {
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `updated=${updated}\n`);
}

async function main() {
    const authkey = process.env.KOREAEXIM_API_KEY;
    if (!authkey) {
        console.error('❌ KOREA_EXIM_API_KEY 시크릿이 없습니다.');
        process.exitCode = 1;
        return;
    }

    const now = new Date();
    const today = kstParts(now);
    const current = readCurrentMeta();
    if (current?.source === 'koreaexim' && current.rate_date === today.iso) {
        console.log(`⏭️ 오늘(${today.iso}) 고시 환율을 이미 받았습니다.`);
        setOutput(false);
        return;
    }

    // 오늘 고시분이 없으면(고시 전·휴일) 아직 수출입은행 데이터가 없을 때만 최근 영업일을 찾는다.
    const days = current?.source === 'koreaexim' ? 1 : LOOKBACK_DAYS;
    for (let i = 0; i < days; i++) {
        const day = kstParts(new Date(now.getTime() - i * 86400000));
        const items = await fetchDay(authkey, day.ymd);
        if (items.length === 0) {
            console.log(`ℹ️ ${day.iso} 고시 환율이 아직 없습니다.`);
            continue;
        }
        if (current?.source === 'koreaexim' && current.rate_date >= day.iso) break;

        const file = buildFile(items, day.iso, now);
        const count = file.length - 1;
        if (count < 10) throw new Error(`통화가 ${count}개뿐이라 저장하지 않습니다.`);
        const body = JSON.stringify(file, null, 0).replace(/^\[/, '[\n').replace(/\},\{/g, '}\n,{').replace(/\]$/, '\n]');
        fs.writeFileSync(OUTPUT, body + '\n');
        fs.mkdirSync(path.join(ROOT, 'data', 'history'), { recursive: true });
        fs.mkdirSync(path.join(ROOT, 'data', 'daily'), { recursive: true });
        fs.copyFileSync(OUTPUT, path.join(ROOT, 'data', 'history', `exchange-rates-${day.iso}.json`));
        fs.copyFileSync(OUTPUT, path.join(ROOT, 'data', 'daily', `exchange-rates-${day.iso}.json`));
        fs.writeFileSync(path.join(ROOT, 'data', 'last-update.txt'), today.stamp + '\n');
        const usd = file.find(r => r.cur_unit === 'USD');
        console.log(`✅ ${day.iso} 고시 환율 ${count}개 저장 (USD ${usd ? usd.deal_bas_r : '-'})`);
        setOutput(true);
        return;
    }
    setOutput(false);
}

main().catch(error => {
    console.error('❌ 수출입은행 환율 수집 실패:', error.message);
    process.exitCode = 1;
});
