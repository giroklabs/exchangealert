/**
 * 텔레그램 리모컨 핸들러 (Remote Control Handler) - 키 로드 로직 완벽 버전
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 수동 파싱 (기존 환경 변수를 덮어쓰지 않도록 함)
const envPath = path.join(__dirname, '..', '.env');
const envConfig = {};
if (fs.existsSync(envPath)) {
    try {
        const envContent = fs.readFileSync(envPath, 'utf8');
        envContent.split('\n').forEach(line => {
            const [key, ...value] = line.split('=');
            if (key && value.length > 0) {
                envConfig[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
            }
        });
    } catch (e) {}
}

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || envConfig.TELEGRAM_BOT_TOKEN;
const MY_PRIVATE_CHAT_ID = process.env.MY_PRIVATE_CHAT_ID || envConfig.MY_PRIVATE_CHAT_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || envConfig.GEMINI_API_KEY;

const DASHBOARD_FILE = path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json');
const FX_HISTORY_FILE = path.join(__dirname, '..', 'public', 'data', 'fx-history-6m.json');

function getRemoteControlMarkup() {
    return {
        inline_keyboard: [
          [{ text: "📸 실시간 스냅샷", callback_data: "cmd_snap" }, { text: "🤖 AI 한수지 상담", callback_data: "cmd_ask" }],
          [{ text: "🔄 지표 즉시 갱신", url: "https://github.com/giroklabs/exchangealert/actions/workflows/fetch-market-dashboard.yml" }, { text: "🌐 대시보드", url: "https://giroklabs.github.io/exchangealert/" }]
        ]
    };
}

async function generateSnapChart() {
    if (!fs.existsSync(FX_HISTORY_FILE)) return null;
    const historyData = JSON.parse(fs.readFileSync(FX_HISTORY_FILE, 'utf8')).data || [];
    if (historyData.length === 0) return null;
    const recent = historyData.slice(0, 20).reverse();
    const chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 450, backgroundColour: '#161b22' });
    return await chartCanvas.renderToBuffer({
        type: 'line',
        data: {
            labels: recent.map(d => d.date.split('-').slice(1).join('/')),
            datasets: [{
                label: 'USD/KRW',
                data: recent.map(d => parseFloat(d.close)),
                borderColor: '#58a6ff',
                backgroundColor: 'rgba(88, 166, 255, 0.1)',
                fill: true, tension: 0.4, borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#58a6ff'
            }]
        },
        options: { plugins: { title: { display: true, text: '실시간 환율 추이 (최근 20일)', color: '#fff' } } }
    });
}

function getDashboardSummary() {
    if (!fs.existsSync(DASHBOARD_FILE)) return "데이터파일 없음";
    const data = JSON.parse(fs.readFileSync(DASHBOARD_FILE, 'utf8'));
    const ind = data.indicators || [];
    const rates = data.majorRates || [];
    const findVal = (id) => rates.find(i => i.id === id)?.value || ind.find(i => i.id === id)?.value || '-';
    
    return "🚨 *시장 통합 요약 리포트*\n\n" +
           "💲 원/달러: " + findVal('usd-krw') + "원\n" +
           "💵 달러인덱스: " + findVal('dxy') + "\n" +
           "😨 VIX 공포지수: " + (findVal('vixcls') || findVal('vix')) + "\n\n" +
           "* [📈 국내 상황]*\n" +
           "🏢 외인순매수: " + findVal('foreigner-net-buy') + "억\n" +
           "📉 코스피 지수: " + findVal('kospi') + "\n\n" +
           "* [🛡️ 매크로 리스크]*\n" +
           "🛢️ 국제유가(WTI): $" + findVal('dcoilwtico') + "\n" +
           "⏰ 기준시점: " + (data.lastUpdate || '알수없음');
}

async function askAI(question = "") {
    if (!GEMINI_API_KEY) {
        return "🚨 Gemini API 키 미설정 (Config Error)\n- Env: " + (process.env.GEMINI_API_KEY ? "O" : "X") + "\n- File: " + (envConfig.GEMINI_API_KEY ? "O" : "X");
    }
    
    let context = "";
    if (fs.existsSync(DASHBOARD_FILE)) context = "지표 요약: " + getDashboardSummary();
    
    const prompt = "금융 분석가 한수지로서 전문적이고 친절하게 답변하세요. " + (question || "현재 시장 요약해줘") + "\n\n" + context;
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;

    return new Promise(resolve => {
        const req = https.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => {
                try { 
                    const data = JSON.parse(body);
                    if (data.error) {
                        resolve("AI 분석 API 오류: " + data.error.message);
                    } else {
                        resolve(data.candidates[0].content.parts[0].text); 
                    }
                } catch { resolve("AI 분석 답변 생성 실패 (JSON 파싱 오류)"); }
            });
        });
        req.on('error', (e) => resolve("네트워크 에러 (AI 서버 연결 실패): " + e.message));
        req.write(JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }));
        req.end();
    });
}

async function sendToTelegram(buffer, caption) {
    const boundary = '----FormBoundary' + Date.now();
    let body = Buffer.concat([
        Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"chat_id\"\r\n\r\n" + MY_PRIVATE_CHAT_ID + "\r\n"),
        Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"caption\"\r\n\r\n" + caption + "\r\n"),
        Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"parse_mode\"\r\n\r\nMarkdown\r\n"),
        Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"reply_markup\"\r\n\r\n" + JSON.stringify(getRemoteControlMarkup()) + "\r\n"),
        Buffer.from("--" + boundary + "\r\nContent-Disposition: form-data; name=\"photo\"; filename=\"snap.png\"\r\nContent-Type: image/png\r\n\r\n"),
        buffer,
        Buffer.from("\r\n--" + boundary + "--\r\n")
    ]);
    return new Promise(resolve => {
        const req = https.request("https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendPhoto", {
            method: 'POST', headers: { 'Content-Type': "multipart/form-data; boundary=" + boundary, 'Content-Length': body.length }, rejectUnauthorized: false
        }, res => resolve(res.statusCode === 200));
        req.write(body); req.end();
    });
}

async function sendTextMessage(text) {
    const data = JSON.stringify({ chat_id: MY_PRIVATE_CHAT_ID, text, parse_mode: 'Markdown', reply_markup: getRemoteControlMarkup() });
    return new Promise(resolve => {
        const req = https.request("https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage", {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }, rejectUnauthorized: false
        }, res => resolve(res.statusCode === 200));
        req.write(data); req.end();
    });
}

async function main() {
    const cmd = process.argv[2];
    const args = process.argv.slice(3).join(' ');
    if (cmd === 'snap') {
        const buf = await generateSnapChart();
        if (buf) await sendToTelegram(buf, getDashboardSummary());
    } else if (cmd === 'ask') {
        const reply = await askAI(args);
        await sendTextMessage("🙋‍♂️ *AI 한수지 답변:*\n\n" + reply);
    }
}
main().catch(err => console.error(err));
