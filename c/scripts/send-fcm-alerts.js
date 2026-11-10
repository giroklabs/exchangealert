import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    EXPECTED_PROJECT_ID,
    MAX_RATE_AGE_MINUTES,
    areRatesFresh,
    decideAlert,
    isBadTokenError,
    isConfigurationError,
    isWithinCooldown,
    parseRate,
    ratesFingerprint,
    shouldScan,
} from './fcm-alert-logic.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RATES_FILE = path.join(__dirname, '..', '..', 'data', 'exchange-rates.json');
const SEND_CHUNK_SIZE = 500;

function getPushWindow(currency, now) {
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const min = String(Math.floor(kst.getUTCMinutes() / 10) * 10).padStart(2, '0');
    return `${currency}_${yyyy}-${mm}-${dd}_${hh}:${min}`;
}

function buildMessage({ token, currency, threshold }, decision, currentRate, now) {
    const title = `${decision.emoji} ${currency} 환율 ${decision.direction}!`;
    const body = `현재 환율이 ${currentRate.toLocaleString()}원입니다.`;
    return {
        token,
        notification: { title, body },
        data: {
            type: 'threshold_alert',
            currency,
            pushWindow: getPushWindow(currency, now),
            rate: currentRate.toString(),
            threshold: threshold.toString(),
        },
        apns: {
            payload: {
                aps: {
                    alert: { title, body },
                    sound: 'default',
                    badge: 1,
                    'mutable-content': 1,
                    // 백그라운드 앱도 도착을 기록해 같은 알림을 로컬로 다시 보내지 않게 한다.
                    'content-available': 1,
                },
            },
        },
    };
}

/** 문서별로 독립 적용한다. 그 사이 사용자가 지운 문서(NOT_FOUND)는 정상 상황이다. */
async function applyUpdates(db, updates) {
    if (updates.length === 0) return 0;
    const writer = db.bulkWriter();
    writer.onWriteError(error => error.code !== 5 && error.failedAttempts < 3);

    let failed = 0;
    for (const { ref, data } of updates) {
        writer.update(ref, data).catch(error => {
            if (error.code !== 5) {
                failed += 1;
                console.error('❌ 상태 저장 실패:', error.message);
            }
        });
    }
    await writer.close();
    return failed;
}

function collectTasks(docs, rates, now) {
    const tasks = [];
    const stateUpdates = [];
    let skipped = 0;

    for (const doc of docs) {
        try {
            const alert = doc.data();
            const currentRate = parseRate(rates.find(r => r.cur_unit === alert.currency));
            if (!alert.token || !alert.currency || !Number.isFinite(currentRate)) {
                skipped += 1;
                continue;
            }

            const decision = decideAlert(alert, currentRate);
            if (decision.invalid) {
                skipped += 1;
                continue;
            }

            if (!decision.notify) {
                if (decision.update) stateUpdates.push({ ref: doc.ref, data: decision.update });
                continue;
            }

            // 쿨다운 중이면 상태를 바꾸지 않아, 끝난 뒤 조건이 유지될 경우 발송된다.
            if (isWithinCooldown(alert.lastPushedAt, now)) continue;

            tasks.push({
                ref: doc.ref,
                update: decision.update,
                message: buildMessage(alert, decision, currentRate, now),
            });
        } catch (e) {
            // 잘못된 문서 하나가 전체 발송을 막지 않도록 한다.
            skipped += 1;
            console.error(`⚠️ 문서 처리 실패 (${doc.id.slice(-8)}):`, e.message);
        }
    }

    return { tasks, stateUpdates, skipped };
}

async function deleteTokens(db, badTokens) {
    for (const token of badTokens) {
        const snap = await db.collection('alerts').where('token', '==', token).get();
        const batch = db.batch();
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
    }
}

/** 작업이 실패로 표시되어야 하는 문제가 있으면 false를 반환한다. */
export async function run({ firebase, serviceAccountJson, rates, now = new Date(), lastScan = null, onScanComplete = () => {} }) {
    console.log('🚀 FCM 알림 스크립트 시작...');

    if (!serviceAccountJson) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다.');
        return false;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    if (serviceAccount.project_id !== EXPECTED_PROJECT_ID) {
        console.error(`❌ 서비스 계정 프로젝트가 다릅니다: ${serviceAccount.project_id} (필요: ${EXPECTED_PROJECT_ID})`);
        return false;
    }

    if (!areRatesFresh(rates, now)) {
        console.warn(`::warning::환율 데이터가 ${MAX_RATE_AGE_MINUTES}분보다 오래되었거나 시각 정보가 없어 이번 회차를 건너뜁니다.`);
        return true;
    }

    const fingerprint = ratesFingerprint(rates);
    if (!shouldScan(lastScan, fingerprint, now)) {
        console.log('⏭️ 조회 조건에 해당하지 않아 이번 회차를 건너뜁니다.');
        return true;
    }
    const scanState = { fingerprint, scannedAt: now.toISOString() };

    if (firebase.apps.length === 0) {
        firebase.initializeApp({ credential: firebase.credential.cert(serviceAccount) });
    }
    const db = firebase.firestore();

    console.log('📡 대상 조회 중...');
    const snapshot = await db.collection('alerts').where('isEnabled', '==', true).get();
    if (snapshot.empty) {
        console.log('✅ 대기 중인 알림이 없습니다.');
        onScanComplete(scanState);
        return true;
    }

    const { tasks, stateUpdates, skipped } = collectTasks(snapshot.docs, rates, now);
    console.log(`🔎 문서 ${snapshot.size}개, 발송 ${tasks.length}개, 상태 갱신 ${stateUpdates.length}개, 건너뜀 ${skipped}개`);

    let healthy = (await applyUpdates(db, stateUpdates)) === 0;

    const badTokens = new Set();
    const sentUpdates = [];
    const errorCounts = {};

    for (let i = 0; i < tasks.length; i += SEND_CHUNK_SIZE) {
        const chunk = tasks.slice(i, i + SEND_CHUNK_SIZE);
        try {
            const response = await firebase.messaging().sendEach(chunk.map(t => t.message));
            response.responses.forEach((resp, idx) => {
                if (resp.success) {
                    sentUpdates.push({
                        ref: chunk[idx].ref,
                        data: { ...chunk[idx].update, lastPushedAt: firebase.firestore.FieldValue.serverTimestamp() },
                    });
                    return;
                }
                const code = resp.error.code;
                errorCounts[code] = (errorCounts[code] || 0) + 1;
                if (isBadTokenError(code)) badTokens.add(chunk[idx].message.token);
                if (isConfigurationError(code)) healthy = false;
            });
        } catch (e) {
            healthy = false;
            console.error('❌ 발송 에러:', e.message);
        }
    }

    if (badTokens.size > 0) {
        console.log(`🧹 무효 토큰 ${badTokens.size}개 정리 중...`);
        await deleteTokens(db, badTokens);
    }
    if ((await applyUpdates(db, sentUpdates)) > 0) healthy = false;

    if (Object.keys(errorCounts).length > 0) console.error('⚠️ 발송 실패 코드:', JSON.stringify(errorCounts));
    console.log(`📊 결과: 성공 ${sentUpdates.length}, 정리 ${badTokens.size}개`);
    console.log('🏁 완료');
    if (healthy) onScanComplete(scanState);
    return healthy;
}

function readScanState(file) {
    try {
        return file ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    } catch {
        return null;
    }
}

function saveScanState(file, state) {
    if (file) fs.writeFileSync(file, JSON.stringify(state));
    if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'scanned=true\n');
}

async function main() {
    if (!fs.existsSync(RATES_FILE)) {
        console.error('❌ 환율 데이터 파일이 없습니다.');
        process.exitCode = 1;
        return;
    }
    const stateFile = process.env.FCM_SCAN_STATE_FILE;
    const healthy = await run({
        firebase: admin,
        serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT,
        rates: JSON.parse(fs.readFileSync(RATES_FILE, 'utf8')),
        lastScan: readScanState(stateFile),
        onScanComplete: state => saveScanState(stateFile, state),
    });
    if (!healthy) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
    main().catch(error => {
        console.error('❌ FCM 알림 작업 실패:', error);
        process.exitCode = 1;
    });
}
