const fs = require('fs');
const path = require('path');

const HISTORY_DIR = path.join(__dirname, '../../data/history');
const DAILY_DIR = path.join(__dirname, '../../data/daily');
const OUTPUT_FILE = path.join(__dirname, '../public/data/fx-history.json');
const ROOT_OUTPUT_FILE = path.join(__dirname, '../../data/fx-history.json');

/**
 * 쉼표가 포함된 문자열 숫자를 숫자로 변환
 */
function parseRate(rateStr) {
    if (!rateStr) return 0;
    return parseFloat(rateStr.replace(/,/g, ''));
}

/**
 * 이동평균선 계산
 */
function calculateMA(data, period) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
            result.push(null);
            continue;
        }
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].rate;
        }
        result.push(Number((sum / period).toFixed(2)));
    }
    return result;
}

async function consolidate() {
    console.log('🚀 Starting FX data consolidation...');

    const fxDataMap = new Map();

    // 1. History 및 Daily 폴더의 모든 파일 읽기
    const dirs = [HISTORY_DIR, DAILY_DIR];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            console.warn(`Warning: Directory not found: ${dir}`);
            continue;
        }

        const files = fs.readdirSync(dir).filter(f => f.startsWith('exchange-rates-') && f.endsWith('.json'));

        for (const file of files) {
            // 파일명에서 날짜 추출 (exchange-rates-YYYY-MM-DD.json 또는 exchange-rates-YYYYMMDD.json)
            let dateStr = file.replace('exchange-rates-', '').replace('.json', '');

            // YYYYMMDD 형식을 YYYY-MM-DD로 통일
            if (dateStr.length === 8 && !dateStr.includes('-')) {
                dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
            }

            try {
                const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
                // USD 데이터 찾기
                const usdData = content.find(item => item.cur_unit === 'USD');

                if (usdData) {
                    const rate = parseRate(usdData.deal_bas_r);
                    if (rate > 0) {
                        // 🌟 [추가] 주말(토,일) 데이터는 히스토리에 포함하지 않도록 차단 (데이터 왜곡 방지)
                        const d = new Date(dateStr);
                        const day = d.getDay();
                        if (day === 0 || day === 6) {
                            console.log(`⏩ Skipping weekend record for ${dateStr}`);
                            continue;
                        }

                        // 중복 시 더 큰 파일(데이터가 더 완전할 가능성) 또는 나중에 읽은 것으로 갱신
                        fxDataMap.set(dateStr, rate);
                    }
                }
            } catch (e) {
                console.error(`Error parsing ${file}:`, e.message);
            }
        }
    }

    // 2. 날짜순 정렬
    const sortedDates = Array.from(fxDataMap.keys()).sort();
    const consolidatedData = sortedDates.map(date => ({
        date,
        rate: fxDataMap.get(date)
    }));

    if (consolidatedData.length === 0) {
        console.error('❌ No USD data found to consolidate!');
        return;
    }

    // 3. 이동평균선 계산
    const ma5 = calculateMA(consolidatedData, 5);
    const ma20 = calculateMA(consolidatedData, 20);
    const ma60 = calculateMA(consolidatedData, 60);

    // 4. 최종 데이터 조합
    const finalData = consolidatedData.map((item, index) => ({
        ...item,
        ma5: ma5[index],
        ma20: ma20[index],
        ma60: ma60[index]
    }));

    // 5. 결과 저장
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
    fs.writeFileSync(ROOT_OUTPUT_FILE, JSON.stringify(finalData, null, 2));
    console.log(`✅ Success! Consolidated ${finalData.length} records.`);
    console.log(`- Local: ${OUTPUT_FILE}`);
    console.log(`- Root: ${ROOT_OUTPUT_FILE}`);
}

consolidate();
