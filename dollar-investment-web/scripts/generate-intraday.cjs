const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 1. 경로 설정 (저장소 루트 기준 및 절대 경로)
const FILE_PATH = 'data/exchange-rates.json'; 
// 웹 배포용 경로 (public/data)
const WEB_OUTPUT_FILE = path.join(__dirname, '../public/data/fx-intraday.json');
// 백업용 데이터 경로
const DATA_OUTPUT_FILE = path.join(__dirname, '../../data/fx-intraday.json');

function getIntradayData() {
    console.log('🚀 Generating intra-day data...');

    const intradayData = [];

    // 0. 현재 메모리에 있는 실시간 데이터 먼저 추가 (Git 히스토리에 반영 전의 최신점)
    try {
        if (fs.existsSync(FILE_PATH)) {
            const content = fs.readFileSync(FILE_PATH, 'utf8');
            const json = JSON.parse(content);
            const usd = json.find(item => item.cur_unit === 'USD');
            const lastUpdateFile = 'data/last-update.txt';
            const lastUpdate = fs.existsSync(lastUpdateFile) 
                ? fs.readFileSync(lastUpdateFile, 'utf8').trim() 
                : new Date().toISOString();
            
            if (usd) {
                const date = new Date(lastUpdate);
                intradayData.push({
                    time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    fullTime: lastUpdate,
                    rate: parseFloat(usd.deal_bas_r.replace(/,/g, '')),
                    timestamp: date.getTime(),
                    isLive: true
                });
                console.log(`📍 Added live point: ${lastUpdate} - ${usd.deal_bas_r}`);
            }
        }
    } catch (e) {
        console.warn('⚠️ Error adding live point:', e.message);
    }

    // 1. Git 히스토리 읽기
    try {
        const now = new Date();
        const maxAge = 8 * 24 * 60 * 60 * 1000; // 7일전 데이터를 커버하기 위해 8일(192시간) 조회
        
        console.log(`🕒 Current Time: ${now.toISOString()}`);
        console.log(`🕒 Lookback Period: ${maxAge / (60*60*1000)} hours`);

        // 커밋 로그를 충분히 가져옴 (8일 * 24시간 * 12회/시간 = 약 2304)
        const log = execSync(`git log -n 3000 --pretty=format:"%H|%ai" -- ${FILE_PATH}`, { encoding: 'utf8' });
        const lines = log.split('\n');
        console.log(`🔍 Total Git Commits to check: ${lines.length}`);

        for (const line of lines) {
            if (!line.trim()) continue;
            const [hash, dateStr] = line.split('|');
            const date = new Date(dateStr);

            if (now - date > maxAge) continue;

            try {
                const content = execSync(`git show ${hash}:${FILE_PATH}`, { encoding: 'utf8' });
                const json = JSON.parse(content);
                const usd = json.find(item => item.cur_unit === 'USD');

                if (usd && usd.deal_bas_r) {
                    intradayData.push({
                        time: date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        fullTime: dateStr,
                        rate: parseFloat(usd.deal_bas_r.replace(/,/g, '')),
                        timestamp: date.getTime()
                    });
                }
            } catch (e) {
                // 커밋에서 파일을 못 가져오는 경우 무시
            }
        }
    } catch (error) {
        console.error('❌ Git log error:', error.message);
    }

    if (intradayData.length === 0) {
        console.error('❌ No data points found!');
        return;
    }

    // 2. 시간순 정렬 및 중복 제거
    intradayData.sort((a, b) => a.timestamp - b.timestamp);
    
    const uniqueData = [];
    const seenFullTimes = new Set();
    // 최신 데이터를 우선하기 위해 역순으로 처리
    for (let i = intradayData.length - 1; i >= 0; i--) {
        // 날짜와 시/분까지 포함하여 고유성 체크
        const uniqueKey = intradayData[i].fullTime.split('+')[0].trim(); 
        if (!seenFullTimes.has(uniqueKey)) {
            uniqueData.unshift(intradayData[i]);
            seenFullTimes.add(uniqueKey);
        }
    }

    // 3. 파일 저장 (Web용 및 데이터 저장용 모두)
    const saveFile = (filePath, data) => {
        try {
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            console.log(`✅ Saved: ${filePath} (${data.length} pts)`);
        } catch (err) {
            console.error(`❌ Save error (${filePath}):`, err.message);
        }
    };

    saveFile(WEB_OUTPUT_FILE, uniqueData);
    saveFile(DATA_OUTPUT_FILE, uniqueData);
}

getIntradayData();
