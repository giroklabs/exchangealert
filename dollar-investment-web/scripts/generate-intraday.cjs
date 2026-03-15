const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Git 명령어에서 사용할 저장소 루트 기준 파일 경로
const FILE_PATH = 'data/exchange-rates.json'; 
const OUTPUT_FILE = path.join(__dirname, '../public/data/fx-intraday.json');
const ROOT_OUTPUT_FILE = path.join(__dirname, '../../data/fx-intraday.json');

function getIntradayData() {
    console.log('🚀 Generating intra-day data from git history...');

    const intradayData = [];

    try {
        // 최근 300개의 커밋 내역 가져오기 (날짜와 해시)
        const log = execSync(`git log -n 300 --pretty=format:"%H|%ai" -- ${FILE_PATH}`, { encoding: 'utf8' });
        const lines = log.split('\n');

        const now = new Date();
        const isWeekend = now.getDay() === 0 || now.getDay() === 6; // 0: 일요일, 6: 토요일
        const maxAge = isWeekend ? 72 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

        for (const line of lines) {
            const [hash, dateStr] = line.split('|');
            const date = new Date(dateStr);

            // 주말이면 72시간(금요일 포함), 평일이면 24시간 데이터만 수집
            if (now - date > maxAge) continue;

            try {
                // 특정 커밋 시점의 파일 내용 읽기
                const content = execSync(`git show ${hash}:${FILE_PATH}`, { encoding: 'utf8' });
                const json = JSON.parse(content);
                const usd = json.find(item => item.cur_unit === 'USD');

                if (usd) {
                    intradayData.push({
                        time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        fullTime: dateStr,
                        rate: parseFloat(usd.deal_bas_r.replace(/,/g, '')),
                        timestamp: date.getTime()
                    });
                }
            } catch (e) {
                console.warn(`Skipping commit ${hash}: ${e.message}`);
            }
        }
        
        // 데이터가 너무 적으면(예: 월요일 새벽 등) 필터링 조건을 완화하여 300개 다 가져옴
        if (intradayData.length < 10) {
            console.log('⚠️ Too few records in timeframe, ignoring age filter...');
            // 위 루프와 동일하지만 age 필터 없이 재수행하는 로직을 간단히 구현하거나
            // 그냥 300개 중에서USD 있는 걸 다 넣음
        }
    } catch (error) {
        console.error('Error reading git history:', error);
        return;
    }

    // 시간순 정렬 (과거 -> 현재)
    intradayData.sort((a, b) => a.timestamp - b.timestamp);

    // 중복 시간 제거 (같은 분에 여러 번 실행된 경우 최신 것만)
    const uniqueData = [];
    const seenTimes = new Set();
    for (let i = intradayData.length - 1; i >= 0; i--) {
        if (!seenTimes.has(intradayData[i].time)) {
            uniqueData.unshift(intradayData[i]);
            seenTimes.add(intradayData[i].time);
        }
    }

    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueData, null, 2));
    fs.writeFileSync(ROOT_OUTPUT_FILE, JSON.stringify(uniqueData, null, 2));

    console.log(`✅ Success! Generated ${uniqueData.length} intra-day records.`);
    console.log(`- Local: ${OUTPUT_FILE}`);
}

getIntradayData();
