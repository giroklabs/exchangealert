import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env');
const envConfig = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').filter(Boolean).forEach(line => {
        const [key, ...value] = line.split('=');
        if (key && value) {
            envConfig[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN || envConfig.TELEGRAM_BOT_TOKEN;
const MY_PRIVATE_CHAT_ID = process.env.MY_PRIVATE_CHAT_ID || envConfig.MY_PRIVATE_CHAT_ID;
const REPO_OWNER = "giroklabs";
const REPO_NAME = "exchangealert";

async function updateButtons() {
    const text = "🚀 *24시간 클라우드 리모컨 무중단 가동!*\n\n이제 이 메시지 아래의 버튼들은 사용자님의 노트북이 꺼져 있어도 GitHub 클라우드 서버에서 직접 응답합니다.\n\n[💡 팁] 버튼을 누르면 GitHub Actions 화면이 뜨며 데이터 갱신/스냅샷 생성이 즉각 시작됩니다.";
    
    const data = JSON.stringify({
        chat_id: MY_PRIVATE_CHAT_ID,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "📸 실시간 스냅샷 (Cloud)", url: "https://github.com/" + REPO_OWNER + "/" + REPO_NAME + "/actions/workflows/telegram-remote.yml" },
                    { text: "🤖 AI 한수지 상담 (Cloud)", url: "https://github.com/" + REPO_OWNER + "/" + REPO_NAME + "/actions" }
                ],
                [
                    { text: "🔄 지표 즉시 갱신", url: "https://github.com/" + REPO_OWNER + "/" + REPO_NAME + "/actions/workflows/fetch-market-dashboard.yml" },
                    { text: "🌐 대시보드", url: "https://" + REPO_OWNER + ".github.io/" + REPO_NAME + "/" }
                ]
            ]
        }
    });

    const options = {
        hostname: 'api.telegram.org', port: 443, path: "/bot" + TELEGRAM_TOKEN + "/sendMessage", method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }, rejectUnauthorized: false
    };

    const req = https.request(options, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            if (res.statusCode === 200) {
                console.log("✅ [Cloud Remote] 버튼 업데이트 성공! 이제 노트북을 끄셔도 됩니다.");
            } else {
                console.error("❌ 오류 발생: " + res.statusCode + "\n" + body);
            }
        });
    });
    req.write(data); req.end();
}

updateButtons().catch(console.error);
