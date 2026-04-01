/**
 * KRX 야간 선물 모닝 브리핑 자동화 스크립트 (Production)
 * 
 * [수행 작업]
 * 1. KIS API를 통한 정규/야간 선물 데이터 수집
 * 2. 오버나잇 프리미엄 계산 및 심리 상태 분석
 * 3. Gemini AI를 활용한 시초가 갭(Gap) 브리핑 생성
 * 4. 텔레그램 자동 전송 (MY_PRIVATE_CHAT_ID)
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

// 고도화된 라이브러리 임포트
import { loadEnv, getKisToken } from './lib/kis-auth.js';
import { calculateOvernightPremium, getPremiumSentiment } from './lib/market-math.js';
import { fetchFuturesPrice } from './lib/futures-client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 환경 변수 로드
loadEnv(path.join(__dirname, '..'));

const KIS_APP_KEY = process.env.KIS_APP_KEY;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.MY_PRIVATE_CHAT_ID;

const HISTORY_FILE = path.join(__dirname, '..', 'public', 'data', 'prediction-history.json');

/**
 * 텔레그램 메시지 전송
 */
async function sendBriefing(text) {
    const data = JSON.stringify({
        chat_id: CHAT_ID,
        text: text,
        parse_mode: 'Markdown'
    });

    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
            rejectUnauthorized: false
        };

        const req = https.request(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, options, res => {
            resolve(res.statusCode === 200);
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

/**
 * AI 분석 브리핑 생성 (Gemini)
 */
async function generateAiBriefing(data) {
    const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
    const prompt = `
[KOSPI 시초가 예측 데이터]
- 기준 시각: ${now}
- 정규 선물 종가: ${data.regPrice}
- 야간 선물 마감: ${data.nightPrice}
- 오버나잇 프리미엄: ${data.premium}% (${data.sentiment.level}${data.sentiment.trend})

한국 증시 분석가 "한수지"로서 이 데이터를 바탕으로 오늘 시초가 대응 전략을 3문장 이내로 명확하게 요약해줘.
    `.trim();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    return new Promise(resolve => {
        const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve(json.candidates[0].content.parts[0].text);
                } catch (e) { resolve(`🚨 AI 분석 생성 오류: ${e.message}`); }
            });
        });
        req.on('error', (e) => resolve(`🚨 AI 서버 연결 실패: ${e.message}`));
        req.write(JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }));
        req.end();
    });
}

async function main() {
    console.log("🚀 야간 선물 모닝 브리핑 수집 시작...");

    try {
        if (!KIS_APP_KEY || !GEMINI_API_KEY || !TELEGRAM_TOKEN) {
            throw new Error("필수 API 키가 .env에 누락되었습니다.");
        }

        // 1. KIS 토큰 발급
        const token = await getKisToken(KIS_APP_KEY, KIS_APP_SECRET);
        console.log("✅ KIS 토큰 발급 완료");

        // 2. 선물 시세 수집 (10100 종목 하나면 주/야간 데이터 확보 가능)
        // futs_prpr: 오전 08:35 기준 야간 세션 마감가
        // futs_prdy_clpr: 전일 오후 15:45 기준 정규 세션 종가
        const res = await fetchFuturesPrice('10100', token, { appKey: KIS_APP_KEY, appSecret: KIS_APP_SECRET });
        
        const nightPrice = parseFloat(res.stck_prpr || 0);
        const regPrice = parseFloat(res.stck_sdpr || 0);

        if (nightPrice === 0 || regPrice === 0) {
            console.warn("⚠️ KIS로부터 선물 데이터를 받지 못했습니다. (권한 또는 시장 마감 확인 필요)");
            await sendBriefing(`⚠️ *[주의]* KIS API로부터 선물 데이터를 수집하지 못했습니다.\n\n해당 계정의 *국내선물옵션 시세 이용 권한*을 확인해 주세요. (현재 069500 등 주식 데이터는 정상 수신 중)`);
            return;
        }
        
        // 3. 지표 계산
        const premium = calculateOvernightPremium(regPrice, nightPrice);
        const sentiment = getPremiumSentiment(premium);
        
        console.log(`📊 분석 성공: Reg(전일종가) ${regPrice} | Night(현재가/야간종가) ${nightPrice} | Premium ${premium}% (${sentiment.level}${sentiment.trend})`);

        // 4. AI 브리핑 생성
        const briefing = await generateAiBriefing({ regPrice, nightPrice, premium, sentiment });
        
        // 5. 텔레그램 메시지 구성
        const message = `
🌕 *[야간 선물 모닝 브리핑]*

📊 *지표 요약*
- 정규 선물(10100): ${regPrice}
- 야간 선물(10100): ${nightPrice}
- *오버나잇 프리미엄: ${premium}%*
- *시장 신호: [${sentiment.level}${sentiment.trend}]*

🙋‍♂️ *AI 한수지 분석 전략*
${briefing}

⏰ 기준시점: ${new Date().toLocaleTimeString('ko-KR', { hour12: false })} (KST)
        `.trim();

        // 6. 발송
        await sendBriefing(message);
        console.log("✨ 텔레그램 브리핑 전송 성공!");

        // 7. 이력 저장 (History)
        if (fs.existsSync(HISTORY_FILE)) {
            const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            if (!history.records) history.records = []; 
            
            history.records.push({
                date: new Date().toISOString().split('T')[0],
                type: 'night_futures',
                premium,
                sentiment: sentiment.trend,
                aiBrief: briefing.substring(0, 500) // 너무 길지 않게 저장
            });
            fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
            console.log("💾 분석 이력 저장 완료");
        }

    } catch (err) {
        console.error("❌ 오류 발생:", err.message);
        await sendBriefing(`🚨 *야간 선물 수집 오류 발생:*\n${err.message}`);
    }
}

main();
