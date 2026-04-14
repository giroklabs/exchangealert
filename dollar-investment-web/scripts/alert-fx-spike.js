/**
 * 환율 급변동 알림 스크립트
 * USD/KRW 환율이 직전 기준 대비 0.5% 초과 변동 시 차트 이미지와 함께 텔레그램 발송
 *
 * 사용법:
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy node scripts/alert-fx-spike.js
 *
 * 환경변수:
 *   TELEGRAM_BOT_TOKEN  — 텔레그램 봇 토큰
 *   TELEGRAM_CHAT_ID    — 텔레그램 채팅 ID
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────── 설정 ───────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;

/** 알림 트리거 임계값 (%) */
const SPIKE_THRESHOLD = 0.5;
const DXY_THRESHOLD = 0.5;
const YIELD_DIFF_THRESHOLD = 0.1;
const FNB_THRESHOLD = -5000;
const VIX_THRESHOLD = 10;
const VIX_ABSOLUTE_THRESHOLD = 25;

/** 동일 방향 반복 알림 방지 쿨다운 (분) */
const COOLDOWN_MINUTES = 30;

/** 기준 환율 저장 파일 경로 */
const LAST_ALERT_FILE = path.join(__dirname, '..', 'public', 'data', 'last-alert-rate.json');

/** 환율 히스토리 파일 경로 (기존 파이프라인이 생성) */
const FX_HISTORY_FILE = path.join(__dirname, '..', 'public', 'data', 'fx-history-6m.json');

// ─────────────── 현재 환율 조회 ───────────────

/**
 * fx-history-6m.json 에서 가장 최신 종가를 읽어 현재 환율로 사용
 * 파일이 없으면 Naver Finance API 직접 호출
 */
/**
 * 실시간 환율 조회 (Yahoo/Naver 우선, 로컬 히스토리 보조)
 */
async function getCurrentRate() {
    // 1차: Yahoo Finance Realtime (JSON 기반으로 정확함)
    console.log('🌐 Yahoo Finance에서 실시간 환율 조회 중...');
    const yahooRate = await new Promise((resolve) => {
        // USDKRW=X의 최근 1분 데이터를 가져옴
        const url = 'https://query1.finance.yahoo.com/v8/finance/chart/USDKRW=X?interval=1m&range=1d';
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const result = json.chart?.result?.[0];
                    if (result?.meta?.regularMarketPrice) {
                        resolve({
                            rate: parseFloat(result.meta.regularMarketPrice.toFixed(2)),
                            source: 'yahoo'
                        });
                        return;
                    }
                    resolve(null);
                } catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });

    if (yahooRate) {
        console.log(`✅ Yahoo 실시간 조회 성공: ${yahooRate.rate}`);
        return { ...yahooRate, date: new Date().toISOString().split('T')[0] };
    }

    // 2차: Naver Finance API (HTML 파싱)
    console.log('🌐 Naver Finance API에서 환율 조회 중...');
    const naverRate = await new Promise((resolve) => {
        const url = 'https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW';
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const match = data.match(/class="[^"]*point_today[^"]*"[^>]*>.*?<em>([\d,]+\.?\d*)<\/em>/s);
                if (match) {
                    const rate = parseFloat(match[1].replace(/,/g, ''));
                    resolve({ rate, source: 'naver' });
                } else { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });

    if (naverRate) {
        console.log(`✅ Naver 실시간 조회 성공: ${naverRate.rate}`);
        return { ...naverRate, date: new Date().toISOString().split('T')[0] };
    }

    // 3차: 로컬 히스토리 파일 (최후의 수단)
    if (fs.existsSync(FX_HISTORY_FILE)) {
        try {
            const history = JSON.parse(fs.readFileSync(FX_HISTORY_FILE, 'utf8'));
            const latest = history.data?.[0];
            if (latest?.close) {
                console.log(`📂 [Fallback] 로컬 히스토리 사용: ${latest.close}`);
                return {
                    rate: parseFloat(latest.close),
                    date: latest.date || new Date().toISOString().split('T')[0],
                    source: 'local'
                };
            }
        } catch (e) {
            console.warn('⚠️ 히스토리 읽기 실패:', e.message);
        }
    }

    return null;
}

/**
 * fx-history-6m.json 에서 최근 N일 종가 배열 반환 (오래된 순)
 */
function getRecentHistory(days = 30) {
    if (!fs.existsSync(FX_HISTORY_FILE)) return [];
    try {
        const history = JSON.parse(fs.readFileSync(FX_HISTORY_FILE, 'utf8'));
        const data = history.data || [];
        // data는 최신→과거 순이므로 slice 후 reverse해 오래된→최신 순으로 변환
        return data.slice(0, days).reverse().map(d => ({
            date: d.date,
            close: parseFloat(d.close)
        }));
    } catch (e) {
        console.warn('⚠️ 히스토리 읽기 실패:', e.message);
        return [];
    }
}

// ─────────────── 기준 환율 파일 관리 ───────────────

async function getYahooData(ticker) {
    return await new Promise((resolve) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;
        const options = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const result = json.chart?.result?.[0];
                    if (result?.meta?.regularMarketPrice) {
                        resolve(parseFloat(result.meta.regularMarketPrice.toFixed(4)));
                        return;
                    }
                    resolve(null);
                } catch { resolve(null); }
            });
        }).on('error', () => resolve(null));
    });
}

function getMarketDashboardData() {
    const dashboardPath = path.join(__dirname, '..', 'public', 'data', 'market-dashboard.json');
    if (!fs.existsSync(dashboardPath)) return null;
    try {
        const json = JSON.parse(fs.readFileSync(dashboardPath, 'utf8'));
        const fnbObj = json.indicators?.find(i => i.id === 'foreigner-net-buy');
        const kr10yObj = json.indicators?.find(i => i.id === 'kr-10y');
        
        return {
            fnb: fnbObj ? parseFloat(fnbObj.value.toString().replace(/,/g, '')) : null,
            kr10y: kr10yObj ? parseFloat(kr10yObj.value) : null
        };
    } catch { return null; }
}

// ─────────────── 기준 상태 관리 ───────────────

function loadLastAlertInfo() {
    if (!fs.existsSync(LAST_ALERT_FILE)) {
        return { rate: null, lastAlertAt: null };
    }
    try {
        return JSON.parse(fs.readFileSync(LAST_ALERT_FILE, 'utf8'));
    } catch {
        return { rate: null, lastAlertAt: null };
    }
}

function saveLastAlertInfo(state, alertAt) {
    const dir = path.dirname(LAST_ALERT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    // state가 단일 숫자(예전 버전)일 경우 대비
    const data = typeof state === 'object' && state !== null 
                 ? { ...state, lastAlertAt: alertAt } 
                 : { rate: state, lastAlertAt: alertAt };
                 
    fs.writeFileSync(LAST_ALERT_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─────────────── 차트 생성 ───────────────

/**
 * 최근 N일 환율 라인차트 PNG 생성
 * @param {Array} history        — [{ date, close }] 오래된→최신 순
 * @param {number} currentRate   — 현재 환율 (급변동 시점 표시용)
 * @param {number} baseRate      — 직전 기준 환율
 * @param {number} changePct     — 변동률 (부호 포함)
 * @returns {Buffer} PNG 이미지 버퍼
 */
async function generateChart(history, currentRate, baseRate, changePct) {
    const width = 800;
    const height = 400;
    const chartCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: '#1a1a2e' });

    const labels = history.map(d => {
        const [, month, day] = d.date.split('-');
        return `${parseInt(month)}/${parseInt(day)}`;
    });

    // 현재 시점 레이블 추가
    const now = new Date();
    const currentLabel = `${now.getMonth() + 1}/${now.getDate()}(현재)`;
    labels.push(currentLabel);

    const values = [...history.map(d => d.close), currentRate];

    const isUp = changePct > 0;
    const accentColor = isUp ? '#FF6B6B' : '#4EC9B0';
    const pointColors = values.map((_, i) => i === values.length - 1 ? accentColor : 'transparent');
    const pointBorderColors = values.map((_, i) => i === values.length - 1 ? accentColor : 'transparent');
    const pointRadius = values.map((_, i) => i === values.length - 1 ? 8 : 0);

    const config = {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'USD/KRW',
                    data: values,
                    borderColor: '#7EC8E3',
                    backgroundColor: 'rgba(126, 200, 227, 0.08)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2,
                    pointBackgroundColor: pointColors,
                    pointBorderColor: pointBorderColors,
                    pointRadius,
                },
                // 기준 환율 수평선
                {
                    label: '직전 기준',
                    data: Array(values.length).fill(baseRate),
                    borderColor: 'rgba(255, 200, 80, 0.6)',
                    borderDash: [6, 4],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                }
            ]
        },
        options: {
            animation: false,
            responsive: false,
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#cccccc', font: { size: 12, family: "'NanumGothic', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" } }
                },
                title: {
                    display: true,
                    text: `USD/KRW 환율 추이 (최근 ${history.length}일)`,
                    color: '#ffffff',
                    font: { size: 16, weight: 'bold', family: "'NanumGothic', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#aaaaaa', maxRotation: 45, font: { size: 10, family: "'NanumGothic', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" } },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                },
                y: {
                    ticks: { color: '#aaaaaa', font: { size: 11, family: "'NanumGothic', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" } },
                    grid: { color: 'rgba(255,255,255,0.08)' }
                }
            }
        }
    };

    return await chartCanvas.renderToBuffer(config);
}

// ─────────────── 텔레그램 전송 ───────────────

/**
 * Telegram sendPhoto API로 이미지와 캡션 전송
 */
async function sendTelegramPhoto(imageBuffer, caption) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('❌ TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다.');
        return false;
    }

    const boundary = `----FormBoundary${Date.now()}`;
    const filename = 'fx-chart.png';

    // multipart/form-data 직접 구성
    const parts = [];

    // chat_id 필드
    parts.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${TELEGRAM_CHAT_ID}\r\n`)
    );
    // parse_mode 필드
    parts.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="parse_mode"\r\n\r\nMarkdown\r\n`)
    );
    // caption 필드
    parts.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${caption}\r\n`)
    );
    // photo 파일
    parts.push(
        Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="photo"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`)
    );
    parts.push(imageBuffer);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${TELEGRAM_TOKEN}/sendPhoto`,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ [Telegram] 차트 알림 전송 완료');
                    resolve(true);
                } else {
                    console.error(`❌ [Telegram] 전송 실패 (${res.statusCode}):`, responseBody.substring(0, 200));
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ [Telegram] 네트워크 에러:', e.message);
            resolve(false);
        });

        req.write(body);
        req.end();
    });
}

// ─────────────── 메시지 포맷 ───────────────

function buildCaption(currentRate, baseRate, triggers, state) {
    const changeAbs = currentRate - baseRate;
    const changePct = (changeAbs / baseRate) * 100;
    const sign = changePct > 0 ? '+' : '';
    
    const kstTime = new Date().toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    const triggerLines = triggers.map(t => `- ${t}`).join('\n');

    const sourceMap = {
        'yahoo': 'Yahoo Finance',
        'naver': 'Naver Finance',
        'local': 'Local History'
    };
    const sourceLabel = sourceMap[state.source] || state.source || 'Unknown';

    return `🚨 *매크로 핵심 지표 급변동 감지!*

${triggerLines}

[현재 참고 지표]
💲 원/달러: ${state.rate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}원 (${sign}${changePct.toFixed(2)}%)
(출처: ${sourceLabel})
💵 DXY 인덱스: ${state.dxy || '-'}
📉 한미 금리차: ${state.yieldDiff !== null ? state.yieldDiff.toFixed(2) + '%p' : '-'}
🏢 외인 순매수: ${state.fnb !== null ? state.fnb + '억원' : '-'}
😨 VIX 공포지수: ${state.vix || '-'}

⏰ ${kstTime} KST
🌐 [대시보드 바로가기](https://giroklabs.github.io/exchangealert/)`;
}

// ─────────────── FCM 푸시 전송 ───────────────

async function sendPushNotifications(db, triggers, state) {
    try {
        console.log('📡 Firestore에서 푸시 알림 대상 조회 중...');
        // 일단 알림 설정이 되어 있는 모든 토큰 수집
        const alertsSnapshot = await db.collection('alerts').get();
        const tokens = new Set();
        alertsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.token) tokens.add(data.token);
        });

        if (tokens.size === 0) {
            console.log('✅ 푸시를 보낼 대상 토큰이 없습니다.');
            return;
        }

        const tokenList = Array.from(tokens);
        const title = `🚨 매크로 지표 급변동 감지!`;
        const body = triggers[0] + (triggers.length > 1 ? ` 외 ${triggers.length - 1}건` : '') + ` (환율: ${state.rate}원)`;

        console.log(`📤 ${tokenList.size}개 기기로 푸시 알림 발송 중...`);

        const messages = tokenList.map(token => ({
            token: token,
            notification: {
                title: title,
                body: body
            },
            data: {
                type: 'spike_alert',
                rate: state.rate.toString()
            },
            apns: {
                payload: {
                    aps: { sound: 'default', badge: 1 }
                }
            }
        }));

        // FCM은 500개씩 나눠서 전송
        for (let i = 0; i < messages.length; i += 500) {
            const chunk = messages.slice(i, i + 500);
            const response = await admin.messaging().sendEach(chunk);
            console.log(`✅ 푸시 발송 완료: 성공 ${response.successCount}, 실패 ${response.failureCount}`);
        }
    } catch (e) {
        console.error('❌ 푸시 알림 발송 에러:', e.message);
    }
}

// ─────────────── 메인 ───────────────

async function main() {
    console.log('🚀 환율 및 매크로 지표 급변동 알림 스크립트 시작...');
    console.log(`- Telegram 봇: ${TELEGRAM_TOKEN ? '✅' : '❌ 미설정'}`);
    console.log(`- Chat ID: ${TELEGRAM_CHAT_ID ? '✅' : '❌ 미설정'}`);

    // 1. Firebase Admin 초기화 (푸시용)
    const db = (() => {
        if (!SERVICE_ACCOUNT) {
            console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT 미설정 - 푸시 알림은 건너뜁니다.');
            return null;
        }
        try {
            const serviceAccount = JSON.parse(SERVICE_ACCOUNT);
            if (admin.apps.length === 0) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            }
            return admin.firestore();
        } catch (e) {
            console.error('❌ Firebase 초기화 실패:', e.message);
            return null;
        }
    })();

    // 1. 현재 모든 지표 데이터 조회
    const current = await getCurrentRate();
    if (!current) {
        console.error('❌ 현재 환율 조회 실패. 종료합니다.');
        process.exit(0);
    }
    
    const dxy = await getYahooData('DX-Y.NYB');
    const vix = await getYahooData('^VIX');
    const us10y = await getYahooData('^TNX');
    const dashboardData = getMarketDashboardData();

    const currentState = {
        rate: current.rate,
        source: current.source,
        dxy: dxy,
        vix: vix,
        yieldDiff: (us10y !== null && dashboardData?.kr10y !== null && dashboardData?.kr10y !== undefined) ? us10y - dashboardData.kr10y : null,
        fnb: dashboardData?.fnb
    };

    console.log(`📊 현재 지표 -> USDKRW: ${currentState.rate}, DXY: ${currentState.dxy}, VIX: ${currentState.vix}, 금리차: ${currentState.yieldDiff?.toFixed(2)}%p, 외인순매수: ${currentState.fnb}억`);

    // 2. 직전 기준 지표 로드
    const lastInfo = loadLastAlertInfo();

    // 최초 실행 시 기준값 설정 후 종료
    if (!lastInfo.rate) {
        console.log(`📝 최초 실행 - 현재 상태를 기준으로 저장합니다.`);
        saveLastAlertInfo(currentState, null);
        return;
    }

    const triggers = [];

    // USD/KRW Trigger (0.5%)
    const rateChangeAbs = currentState.rate - lastInfo.rate;
    const rateChangePct = (rateChangeAbs / lastInfo.rate) * 100;
    if (Math.abs(rateChangePct) >= SPIKE_THRESHOLD) {
        triggers.push(`💲 원/달러 환율 (${rateChangePct > 0 ? '+' : ''}${rateChangePct.toFixed(2)}%) 👉 ${currentState.rate}원`);
    }

    // DXY Trigger (0.5%)
    if (currentState.dxy && lastInfo.dxy) {
        const dxyChange = ((currentState.dxy - lastInfo.dxy) / lastInfo.dxy) * 100;
        if (Math.abs(dxyChange) >= DXY_THRESHOLD) {
            triggers.push(`💵 달러 인덱스 (${dxyChange > 0 ? '+' : ''}${dxyChange.toFixed(2)}%) 👉 ${currentState.dxy.toFixed(2)}`);
        }
    }

    // Yield Differential Trigger (0.1%p = 10bp)
    if (currentState.yieldDiff !== null && lastInfo.yieldDiff !== null) {
        const diffChange = currentState.yieldDiff - lastInfo.yieldDiff;
        if (Math.abs(diffChange) >= YIELD_DIFF_THRESHOLD) {
            triggers.push(`📉 한미 금리차 (${diffChange > 0 ? '+' : ''}${diffChange.toFixed(3)}%p) 👉 ${currentState.yieldDiff.toFixed(2)}%p`);
        }
    }

    // Foreigner Net Buy Trigger (Crossing -5000 threshold)
    if (currentState.fnb !== null && lastInfo.fnb !== null) {
        if (currentState.fnb <= FNB_THRESHOLD && lastInfo.fnb > FNB_THRESHOLD) {
            triggers.push(`🚨 외국인 코스피 대규모 순매도 발생 👉 ${currentState.fnb}억원`);
        }
    }

    // VIX Trigger (Absolute > 25, or 10% change)
    if (currentState.vix && lastInfo.vix) {
        const vixChange = ((currentState.vix - lastInfo.vix) / lastInfo.vix) * 100;
        if (currentState.vix >= VIX_ABSOLUTE_THRESHOLD && lastInfo.vix < VIX_ABSOLUTE_THRESHOLD) {
            triggers.push(`😨 VIX 공포지수 ${VIX_ABSOLUTE_THRESHOLD} 돌파! 👉 ${currentState.vix.toFixed(2)}`);
        } else if (Math.abs(vixChange) >= VIX_THRESHOLD) {
            triggers.push(`😨 VIX 공포지수 급변동 (${vixChange > 0 ? '+' : ''}${vixChange.toFixed(1)}%) 👉 ${currentState.vix.toFixed(2)}`);
        }
    }

    // 4. 임계값 조건 불만족 시 종료
    if (triggers.length === 0) {
        console.log(`✅ 설정된 임계값(환율 ${SPIKE_THRESHOLD}%)을 초과한 지표 없음 — 알림 대상 아님`);
        console.log(`💡 참고: 환율 변동률은 기준가(${lastInfo.rate}원) 대비 ${(Math.abs(rateChangePct)).toFixed(3)}% 로 확인되었습니다.`);
        return;
    }

    // 5. 쿨다운 체크
    if (lastInfo.lastAlertAt) {
        const minutesSinceLastAlert = (Date.now() - new Date(lastInfo.lastAlertAt).getTime()) / (1000 * 60);
        if (minutesSinceLastAlert < COOLDOWN_MINUTES) {
            console.log(`⏳ 쿨다운 중 (마지막 알림 ${minutesSinceLastAlert.toFixed(0)}분 전, 쿨다운: ${COOLDOWN_MINUTES}분) — 알림 건너뜀`);
            return;
        }
    }

    console.log(`🚨 급변동 감지! 알림 발송 시작 (트리거: ${triggers.length}건)`);
    triggers.forEach(t => console.log(`   ${t}`));

    // 6. 차트 생성 (USD/KRW 기준 선 차트를 유지. 직관적 상황 파악용)
    console.log('📊 차트 이미지 생성 중...');
    const history = getRecentHistory(30);
    const chartBuffer = await generateChart(history, currentState.rate, lastInfo.rate, rateChangePct);
    console.log(`✅ 차트 생성 완료 (${Math.round(chartBuffer.length / 1024)}KB)`);

    // 7. 텔레그램 전송
    const caption = buildCaption(currentState.rate, lastInfo.rate, triggers, currentState);
    const success = await sendTelegramPhoto(chartBuffer, caption);

    // 8. 성공 시 기준 지표 전체 업데이트 상태 저장
    if (success) {
        saveLastAlertInfo(currentState, new Date().toISOString());
        console.log(`📝 모든 모니터링 기준 지표 업데이트 완료.`);
        
        // 9. 앱 푸시 알림 발송
        if (db) {
            await sendPushNotifications(db, triggers, currentState);
        }
    }

    console.log('🏁 스크립트 완료');
}

main().catch(e => {
    console.error('❌ 스크립트 실행 에러:', e.message);
    process.exit(0); // 워크플로 에러로 중단되지 않도록
});
