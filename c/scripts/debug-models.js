import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 로드
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const GEMINI_API_KEY = envContent.split('\n')
    .find(l => l.startsWith('GEMINI_API_KEY'))
    .split('=')[1].trim().replace(/^["']|["']$/g, '');

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;

https.get(url, (res) => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
        try {
            const data = JSON.parse(body);
            if (data.models) {
                console.log("✅ 사용 가능한 모델 리스트:");
                data.models.forEach(m => console.log(`- ${m.name}`));
            } else {
                console.error("❌ 모델 목록 조회 실패:", JSON.stringify(data));
            }
        } catch (e) { console.error("❌ 파싱 오류:", body); }
    });
}).on('error', (e) => console.error("❌ 네트워크 오류:", e.message));
