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

/**
 * Yahoo Finance에서 실시간 시세 수집
 */
async function fetchFromYahooFinance(symbol) {
    return new Promise((resolve) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const result = json.chart?.result?.[0];
                    if (!result) return resolve(null);
                    
                    const meta = result.meta;
                    const indicators = result.indicators.quote[0];
                    const closes = indicators.close;
                    
                    // 유효한 마지막 종가 찾기
                    let lastPrice = meta.regularMarketPrice;
                    for (let i = closes.length - 1; i >= 0; i--) {
                        if (closes[i] !== null) {
                            lastPrice = closes[i];
                            break;
                        }
                    }

                    resolve({
                        price: lastPrice,
                        prevClose: meta.previousClose,
                        change: ((lastPrice - meta.previousClose) / meta.previousClose * 100).toFixed(2)
                    });
                } catch (e) {
                    console.error(`❌ Yahoo Finance Error (${symbol}):`, e.message);
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            console.error(`❌ Yahoo Finance Network Error (${symbol}):`, e.message);
            resolve(null);
        });
    });
}

async function main() {
    console.log("🚀 야간 선물(ETN 대체) 모닝 브리핑 수집 시작...");

    try {
        if (!GEMINI_API_KEY || !TELEGRAM_TOKEN) {
            throw new Error("필수 API 키가 .env에 누락되었습니다.");
        }

        // 1. Yahoo Finance를 통한 야간선물(ETN) 데이터 수집
        console.log("📊 Yahoo Finance 데이터 수집 중 (580039.KS)...");
        const etnData = await fetchFromYahooFinance('580039.KS');
        
        let nightPrice = 0;
        let regPrice = 0;
        let premium = 0;
        let dataSource = "Yahoo Finance (580039.KS)";

        if (etnData) {
            // 💡 580039.KS는 코스피 200 레버리지(2x) ETN이므로
            // 수익률의 절반을 일반 선물 프리미엄으로 추정함
            premium = parseFloat((etnData.change / 2).toFixed(2));
            nightPrice = etnData.price;
            regPrice = etnData.prevClose;
            console.log(`✅ ETN 수집 성공: 현재가 ${nightPrice}, 등락률 ${etnData.change}% (선물추정 프리미엄: ${premium}%)`);
        } else {
            console.warn("⚠️ Yahoo Finance 수집 실패. KIS 폴백 시도...");
            // 2. KIS 폴백 (기존 로직)
            try {
                const token = await getKisToken(KIS_APP_KEY, KIS_APP_SECRET);
                const res = await fetchFuturesPrice('10100', token, { appKey: KIS_APP_KEY, appSecret: KIS_APP_SECRET });
                nightPrice = parseFloat(res.stck_prpr || 0);
                regPrice = parseFloat(res.stck_sdpr || 0);
                premium = calculateOvernightPremium(regPrice, nightPrice);
                dataSource = "한국투자증권 (10100)";
            } catch (kisErr) {
                console.error("❌ KIS 폴백도 실패:", kisErr.message);
            }
        }

        if (premium === 0 && nightPrice === 0) {
            throw new Error("모든 소스에서 데이터 수집에 실패했습니다.");
        }
        
        // 3. 심리 상태 분석
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
