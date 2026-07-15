/**
 * KIS (한국투자증권) API 인증 및 기초 통신 모듈
 */

import fs from 'fs';
import path from 'path';
import https from 'https';

const KIS_BASE_URL = "https://openapi.koreainvestment.com:9443"; // 실전 투자
const KIS_VTS_URL = "https://openapivts.koreainvestment.com:29443"; // 모의 투자

/**
 * .env 파일 수동 로드 (빌드 도구/프레임워크 외 환경 대응)
 */
export function loadEnv(baseDir = '.') {
    const envPath = path.join(baseDir, '.env');
    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
                process.env[key.trim()] = value;
            }
        });
        return true;
    }
    return false;
}

/**
 * KIS Access Token 발급 (재시도 및 상세 에러 처리 포함)
 * @param {string} appKey 
 * @param {string} appSecret 
 * @param {boolean} isVts 모의투자 여부
 * @param {number} retries 재시도 횟수
 * @returns {Promise<string>}
 */
export async function getKisToken(appKey, appSecret, isVts = false, retries = 3) {
    const tokenCachePath = path.join(process.cwd(), 'scripts', '.kis-token.json');
    
    // 1. 캐시된 토큰 확인
    if (fs.existsSync(tokenCachePath)) {
        try {
            const cache = JSON.parse(fs.readFileSync(tokenCachePath, 'utf8'));
            const now = Date.now();
            // 만료 10분 전까지는 유효한 것으로 간주 (안전마진)
            if (cache.access_token && cache.expiredAt > now + 600000 && cache.appKey === appKey) {
                return cache.access_token;
            }
        } catch (e) {}
    }

    const baseUrl = isVts ? KIS_VTS_URL : KIS_BASE_URL;
    const url = `${baseUrl}/oauth2/tokenP`;
    
    const body = JSON.stringify({
        grant_type: "client_credentials",
        appkey: appKey,
        appsecret: appSecret
    });

    const attempt = async (remains) => {
        return new Promise((resolve, reject) => {
            const options = {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
                timeout: 5000
            };

            const req = https.request(url, options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.access_token) {
                            // 2. 새로운 토큰 캐싱 (expire_in 초 기반 계산)
                            const expiresSec = parseInt(json.expires_in || 86400);
                            const expiredAt = Date.now() + (expiresSec * 1000);
                            
                            fs.writeFileSync(tokenCachePath, JSON.stringify({
                                access_token: json.access_token,
                                expiredAt,
                                appKey
                            }, null, 2));
                            
                            resolve(json.access_token);
                        } else {
                            const errorDetail = json.error_description || json.msg1 || JSON.stringify(json);
                            reject(new Error(`[KIS] 토큰 발급 실패: ${errorDetail}`));
                        }
                    } catch (e) {
                        reject(new Error(`[KIS] 토큰 파싱 에러 (Status: ${res.statusCode}): ${data.substring(0, 50)}`));
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('[KIS] 토큰 요청 타임아웃'));
            });
            req.on('error', (e) => reject(new Error(`[KIS] 네트워크 에러: ${e.message}`)));
            req.write(body);
            req.end();
        });
    };

    let lastError;
    for (let i = 0; i < retries; i++) {
        try {
            if (i > 0) console.log(`🔄 토큰 발급 재시도 중... (${i}/${retries})`);
            return await attempt(retries - i);
        } catch (e) {
            lastError = e;
            if (i < retries - 1) await new Promise(r => setTimeout(r, 1000 * (i + 1))); // 지수 백오프
        }
    }
    throw lastError;
}
