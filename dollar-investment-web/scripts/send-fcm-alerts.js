import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────── 설정 ───────────────
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const RATES_FILE = path.join(__dirname, '..', '..', 'data', 'exchange-rates.json');

/** 동일 통화 반복 알림 방지 쿨다운 (분) */
const COOLDOWN_MINUTES = 10;

/**
 * 10분 단위 푸시 윈도우 ID 생성
 */
function getPushWindow(currency) {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC → KST
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const min = String(Math.floor(kst.getUTCMinutes() / 10) * 10).padStart(2, '0');
    return `${currency}_${yyyy}-${mm}-${dd}_${hh}:${min}`;
}

async function main() {
    console.log('🚀 [최신버전] FCM 알림 및 토큰 정리 스크립트 시작...');

    if (!SERVICE_ACCOUNT) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다.');
        return;
    }

    try {
        const serviceAccount = JSON.parse(SERVICE_ACCOUNT);
        if (admin.apps.length === 0) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        console.log('✅ Firebase Admin 초기화 완료');
    } catch (e) {
        console.error('❌ Firebase 초기화 실패:', e.message);
        return;
    }

    const db = admin.firestore();

    if (!fs.existsSync(RATES_FILE)) {
        console.error('❌ 환율 데이터 파일이 없습니다:', RATES_FILE);
        return;
    }

    let rates;
    try {
        rates = JSON.parse(fs.readFileSync(RATES_FILE, 'utf8'));
    } catch (e) {
        console.error('❌ 환율 파일 파싱 실패:', e.message);
        return;
    }

    console.log('📡 Firestore에서 알림 대상 조회 중...');
    const alertsSnapshot = await db.collection('alerts').where('isEnabled', '==', true).get();
    
    if (alertsSnapshot.empty) {
        console.log('✅ 대기 중인 알림 설정이 없습니다.');
        return;
    }

    console.log(`🔔 총 ${alertsSnapshot.size}개의 알림 설정 확인됨. 조건 체크 시작...`);

    const messages = [];
    const docsToUpdate = [];
    const now = new Date();

    for (const doc of alertsSnapshot.docs) {
        const alert = doc.data();
        const { token, currency, threshold, thresholdType } = alert;

        if (alert.lastPushedAt) {
            const lastPushed = alert.lastPushedAt.toDate ? alert.lastPushedAt.toDate() : new Date(alert.lastPushedAt);
            const minutesSince = (now - lastPushed) / (1000 * 60);
            if (minutesSince < COOLDOWN_MINUTES) {
                // 쿨다운 중에는 스킵
                continue;
            }
        }

        const rateInfo = rates.find(r => r.cur_unit === currency);
        if (!rateInfo || !rateInfo.deal_bas_r) continue;

        const currentRate = parseFloat(rateInfo.deal_bas_r.replace(/,/g, ''));
        if (isNaN(currentRate)) continue;

        let shouldNotify = false;
        let emoji = '🔔';
        let direction = '';

        switch (thresholdType) {
            case '상한선': if (currentRate >= threshold) { shouldNotify = true; emoji = '📈'; direction = '상한선 돌파'; } break;
            case '하한선': if (currentRate <= threshold) { shouldNotify = true; emoji = '📉'; direction = '하한선 돌파'; } break;
            case '3% 변동':
                if (currentRate >= threshold * 1.03) { shouldNotify = true; emoji = '🚀'; direction = '3% 상승'; }
                else if (currentRate <= threshold * 0.97) { shouldNotify = true; emoji = '⬇️'; direction = '3% 하락'; }
                break;
            case '5% 변동':
                if (currentRate >= threshold * 1.05) { shouldNotify = true; emoji = '🔥'; direction = '5% 상승'; }
                else if (currentRate <= threshold * 0.95) { shouldNotify = true; emoji = '❄️'; direction = '5% 하락'; }
                break;
        }

        if (shouldNotify) {
            const pushWindow = getPushWindow(currency);
            messages.push({
                token: token,
                notification: {
                    title: `${emoji} ${currency} 환율 ${direction}!`,
                    body: `현재 환율이 ${currentRate.toLocaleString()}원입니다. (목표: ${threshold.toLocaleString()}원)`
                },
                data: { type: 'threshold_alert', currency, pushWindow, rate: currentRate.toString(), threshold: threshold.toString() },
                apns: { payload: { aps: { alert: { title: `${emoji} ${currency} 환율 ${direction}!`, body: `현재 환율이 ${currentRate.toLocaleString()}원입니다.` }, sound: 'default', badge: 1, 'mutable-content': 1 } } }
            });
            docsToUpdate.push(doc.ref);
        }
    }

    if (messages.length > 0) {
        console.log(`📤 ${messages.length}개의 푸시 알림 발송 중...`);
        const badTokens = new Set();
        let totalSuccess = 0;
        let totalFail = 0;

        // 500개씩 나눠서 발송
        for (let i = 0; i < messages.length; i += 500) {
            const chunk = messages.slice(i, i + 500);
            try {
                const response = await admin.messaging().sendEach(chunk);
                totalSuccess += response.successCount;
                totalFail += response.failureCount;

                response.responses.forEach((resp, idx) => {
                    if (!resp.success && resp.error) {
                        const errorCode = resp.error.code;
                        const badToken = chunk[idx].token;
                        
                        // 모든 종류의 무효/인증 에러 토큰 수집
                        if (errorCode === 'messaging/invalid-registration-token' ||
                            errorCode === 'messaging/registration-token-not-registered' ||
                            errorCode === 'messaging/invalid-argument' ||
                            errorCode === 'messaging/third-party-auth-error') {
                            console.log(`🗑️ 정리 대상 감지 (${errorCode}): ${badToken ? badToken.substring(0, 8) : 'null'}...`);
                            if (badToken) badTokens.add(badToken);
                        } else {
                            console.error(`❌ 기타 발송 실패: ${errorCode} - ${resp.error.message}`);
                        }
                    }
                });
            } catch (e) {
                console.error('❌ 일괄 발송 에러:', e.message);
            }
        }

        // Firestore에서 무효 토큰 삭제
        if (badTokens.size > 0) {
            console.log(`🧹 ${badTokens.size}개의 무효 토큰 Firestore에서 삭제 중...`);
            for (const token of badTokens) {
                const snap = await db.collection('alerts').where('token', '==', token).get();
                const batch = db.batch();
                snap.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
            console.log('✅ 무효 토큰 정리 완료');
        }

        // 성공한 건들만 쿨다운 업데이트
        if (totalSuccess > 0) {
            const batch = db.batch();
            docsToUpdate.slice(0, totalSuccess).forEach(ref => {
                batch.update(ref, { lastPushedAt: admin.firestore.FieldValue.serverTimestamp() });
            });
            await batch.commit();
        }

        console.log(`📊 최종 결과: 성공 ${totalSuccess}, 실패 ${totalFail}, 정리 ${badTokens.size}개`);
    } else {
        console.log('✅ 현재 발송할 알림이 없습니다.');
    }
    console.log('🏁 완료');
}

main().catch(console.error);
