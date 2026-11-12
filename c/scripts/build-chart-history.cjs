// 앱 환율 차트용: 통화별 일별 매매기준율을 하나의 작은 파일로 모은다.
// 출력 형식: { updatedAt, dates: ["YYYY-MM-DD", ...], rates: { USD: [1386.3, null, ...], ... } }
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE_DIRS = ['data/history', 'data/daily'].map(d => path.join(ROOT, d)); // 뒤 폴더가 우선
const OUTPUT_FILE = path.join(ROOT, 'data', 'fx-chart-history.json');

// 앱의 통화 코드로 맞춘다. JPY(100)·IDR(100)은 예전 표기다.
const CODE_ALIASES = { CNY: 'CNH', 'JPY(100)': 'JPY', 'IDR(100)': 'IDR' };
const SKIP_CODES = new Set(['META', 'KRW']);

function toAppCode(unit) {
    return CODE_ALIASES[unit] || unit;
}

function parseRate(value) {
    const n = parseFloat(String(value ?? '').replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : null;
}

function isWeekend(dateStr) {
    const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
    return day === 0 || day === 6;
}

function dateFromFile(file) {
    let d = file.replace('exchange-rates-', '').replace('.json', '');
    if (/^\d{8}$/.test(d)) d = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

function build() {
    const byDate = new Map(); // date -> { CODE: rate }

    for (const dir of SOURCE_DIRS) {
        if (!fs.existsSync(dir)) continue;
        for (const file of fs.readdirSync(dir)) {
            if (!file.startsWith('exchange-rates-') || !file.endsWith('.json')) continue;
            const date = dateFromFile(file);
            if (!date || isWeekend(date)) continue;
            try {
                const items = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
                if (!Array.isArray(items)) continue;
                const day = {};
                for (const item of items) {
                    if (!item || SKIP_CODES.has(item.cur_unit)) continue;
                    const rate = parseRate(item.deal_bas_r);
                    if (rate) day[toAppCode(item.cur_unit)] = rate;
                }
                if (Object.keys(day).length > 0) byDate.set(date, day);
            } catch (e) {
                console.error(`⚠️ ${file} 읽기 실패:`, e.message);
            }
        }
    }

    const dates = [...byDate.keys()].sort();
    if (dates.length === 0) {
        console.error('❌ 차트용 환율 기록이 없습니다.');
        process.exitCode = 1;
        return;
    }

    const codes = [...new Set(dates.flatMap(d => Object.keys(byDate.get(d))))].sort();
    const rates = {};
    for (const code of codes) rates[code] = dates.map(d => byDate.get(d)[code] ?? null);

    const output = { updatedAt: new Date().toISOString(), dates, rates };
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));
    console.log(`✅ 차트 기록: ${dates.length}일 × ${codes.length}통화 (${dates[0]} ~ ${dates[dates.length - 1]})`);
}

build();
