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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────── 설정 ───────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/** 알림 트리거 임계값 (%) */
const SPIKE_THRESHOLD = 0.0;

/** 동일 방향 반복 알림 방지 쿨다운 (분) */
const COOLDOWN_MINUTES = 0;

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

function saveLastAlertInfo(rate, alertAt) {
    const dir = path.dirname(LAST_ALERT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LAST_ALERT_FILE, JSON.stringify({
        rate,
        lastAlertAt: alertAt
    }, null, 2), 'utf8');
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

function buildCaption(currentRate, baseRate, changePct, changeAbs) {
    const isUp = changePct > 0;
    const dirEmoji = isUp ? '📈' : '📉';
    const dirText = isUp ? '상승' : '하락';
    const sign = isUp ? '+' : '';

    const now = new Date();
    const kstTime = now.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return `🚨 *환율 급변동 감지!*
━━━━━━━━━━━━━━━━
${dirEmoji} *방향:* ${dirText} (${sign}${changePct.toFixed(2)}%)
💲 *현재:* ${currentRate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}원
📌 *직전 기준:* ${baseRate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}원
🔢 *변동폭:* ${sign}${changeAbs.toFixed(2)}원
━━━━━━━━━━━━━━━━
⏰ ${kstTime} KST
🌐 [대시보드 바로가기](https://giroklabs.github.io/exchangealert/)`;
}

// ─────────────── 메인 ───────────────

async function main() {
    console.log('🚀 환율 급변동 알림 스크립트 시작...');
    console.log(`- Telegram 봇: ${TELEGRAM_TOKEN ? '✅' : '❌ 미설정'}`);
    console.log(`- Chat ID: ${TELEGRAM_CHAT_ID ? '✅' : '❌ 미설정'}`);

    // 1. 현재 환율 조회
    const current = await getCurrentRate();
    if (!current) {
        console.error('❌ 현재 환율 조회 실패. 종료합니다.');
        process.exit(0); // 실패해도 워크플로 성공 처리
    }
    console.log(`📊 현재 환율: ${current.rate}원 (소스: ${current.source})`);

    // 2. 직전 기준 환율 로드
    const lastInfo = loadLastAlertInfo();

    // 최초 실행 시 기준값 설정 후 종료
    if (!lastInfo.rate) {
        console.log(`📝 최초 실행 - 현재 환율(${current.rate})을 기준으로 저장합니다.`);
        saveLastAlertInfo(current.rate, null);
        return;
    }

    const baseRate = lastInfo.rate;

    // 3. 변동률 계산
    const changeAbs = current.rate - baseRate;
    const changePct = (changeAbs / baseRate) * 100;
    console.log(`📉 직전 기준: ${baseRate}원 | 변동: ${changePct.toFixed(3)}% (${changeAbs >= 0 ? '+' : ''}${changeAbs.toFixed(2)}원)`);

    // 4. 임계값 미만이면 종료
    if (Math.abs(changePct) < SPIKE_THRESHOLD) {
        console.log(`✅ 변동률 ${Math.abs(changePct).toFixed(3)}% < 임계값 ${SPIKE_THRESHOLD}% — 알림 대상 아님`);
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

    console.log(`🚨 급변동 감지! ${changePct.toFixed(3)}% 변동 — 알림 발송 시작`);

    // 6. 차트 생성
    console.log('📊 차트 이미지 생성 중...');
    const history = getRecentHistory(30);
    const chartBuffer = await generateChart(history, current.rate, baseRate, changePct);
    console.log(`✅ 차트 생성 완료 (${Math.round(chartBuffer.length / 1024)}KB)`);

    // 7. 텔레그램 전송
    const caption = buildCaption(current.rate, baseRate, changePct, changeAbs);
    const success = await sendTelegramPhoto(chartBuffer, caption);

    // 8. 성공 시 기준 환율 업데이트
    if (success) {
        saveLastAlertInfo(current.rate, new Date().toISOString());
        console.log(`📝 기준 환율 업데이트: ${baseRate} → ${current.rate}`);
    }

    console.log('🏁 스크립트 완료');
}

main().catch(e => {
    console.error('❌ 스크립트 실행 에러:', e.message);
    process.exit(0); // 워크플로 에러로 중단되지 않도록
});
