import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Env 로드
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const getVal = (key) => envContent.split('\n').find(l => l.startsWith(key)).split('=')[1].trim().replace(/^["']|["']$/g, '');

const KIS_APP_KEY = getVal('KIS_APP_KEY');
const KIS_APP_SECRET = getVal('KIS_APP_SECRET');
const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443";

async function getToken() {
    const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: "client_credentials", appkey: KIS_APP_KEY, appsecret: KIS_APP_SECRET })
    });
    const data = await res.json();
    return data.access_token;
}

async function scanSymbol(symbol, codes, token) {
    console.log(`\n🔍 [${symbol}] 정밀 바디 스캔...`);
    for (const code of codes) {
        const url = `${KIS_BASE_URL}/uapi/domestic-futureoption/v1/quotations/inquire-price?fid_cond_mrkt_div_code=${code}&fid_input_iscd=${symbol}`;
        const res = await fetch(url, {
            headers: {
                "content-type": "application/json",
                "authorization": `Bearer ${token}`,
                "appkey": KIS_APP_KEY,
                "appsecret": KIS_APP_SECRET,
                "tr_id": "FHKST01010100",
                "custtype": "P",
                "User-Agent": "Mozilla/5.0"
            }
        });
        const json = await res.json();
        const price = json.output ? (json.output.futs_prpr || json.output.stck_prpr || "0") : "ERROR";
        console.log(`📡 Code: ${code} | Price: ${price} | Msg: ${json.msg1 || 'None'}`);
        if (price !== "0" && price !== "ERROR") {
            console.log("⭐ [성공 조합 발견!] Output Sample:", JSON.stringify(json.output).substring(0, 150));
        }
    }
}

async function main() {
    const token = await getToken();
    const targetCodes = ['F', 'J', 'B'];
    const targetSymbols = ['10100', '101N3'];
    
    for (const s of targetSymbols) {
        await scanSymbol(s, targetCodes, token);
    }
}

main();
