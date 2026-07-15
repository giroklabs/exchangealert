import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const RATES_FILE = path.join(__dirname, '..', '..', 'data', 'exchange-rates.json');
const COOLDOWN_MINUTES = 10;

function getPushWindow(currency) {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const yyyy = kst.getUTCFullYear();
    const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(kst.getUTCDate()).padStart(2, '0');
    const hh = String(kst.getUTCHours()).padStart(2, '0');
    const min = String(Math.floor(kst.getUTCMinutes() / 10) * 10).padStart(2, '0');
    return `${currency}_${yyyy}-${mm}-${dd}_${hh}:${min}`;
}

async function main() {
    console.log('🚀 [안정화 버전] FCM 알림 스크립트 시작...');

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
    } catch (e) {
        console.error('❌ Firebase 초기화 실패:', e.message);
        return;
    }

    const db = admin.firestore();

    if (!fs.existsSync(RATES_FILE)) {
        console.error('❌ 환율 데이터 파일이 없습니다.');
        return;
    }

    let rates = JSON.parse(fs.readFileSync(RATES_FILE, 'utf8'));

    console.log('📡 대상 조회 중...');
    const alertsSnapshot = await db.collection('alerts').where('isEnabled', '==', true).get();
    
    if (alertsSnapshot.empty) {
        console.log('✅ 대기 중인 알림이 없습니다.');
        return;
    }

    const tasks = [];
    const now = new Date();

    for (const doc of alertsSnapshot.docs) {
        const alert = doc.data();
        const { token, currency, threshold, thresholdType } = alert;

        if (alert.lastPushedAt) {
            const lastPushed = alert.lastPushedAt.toDate ? alert.lastPushedAt.toDate() : new Date(alert.lastPushedAt);
            if ((now - lastPushed) / (1000 * 60) < COOLDOWN_MINUTES) continue;
        }

        const rateInfo = rates.find(r => r.cur_unit === currency);
        if (!rateInfo || !rateInfo.deal_bas_r) continue;

        const currentRate = parseFloat(rateInfo.deal_bas_r.replace(/,/g, ''));
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
            tasks.push({
                ref: doc.ref,
                message: {
                    token: token,
                    notification: {
                        title: `${emoji} ${currency} 환율 ${direction}!`,
                        body: `현재 환율이 ${currentRate.toLocaleString()}원입니다.`
                    },
                    data: { type: 'threshold_alert', currency, pushWindow: getPushWindow(currency), rate: currentRate.toString(), threshold: threshold.toString() },
                    apns: { payload: { aps: { alert: { title: `${emoji} ${currency} 환율 ${direction}!`, body: `현재 환율이 ${currentRate.toLocaleString()}원입니다.` }, sound: 'default', badge: 1, 'mutable-content': 1 } } }
                }
            });
        }
    }

    if (tasks.length > 0) {
        console.log(`📤 ${tasks.length}개 발송 시도...`);
        const badTokens = new Set();
        const successRefs = [];

        for (let i = 0; i < tasks.length; i += 500) {
            const chunk = tasks.slice(i, i + 500);
            const messages = chunk.map(t => t.message);
            
            try {
                const response = await admin.messaging().sendEach(messages);
                response.responses.forEach((resp, idx) => {
                    if (resp.success) {
                        successRefs.push(chunk[idx].ref);
                    } else {
                        const errorCode = resp.error.code;
                        if (['messaging/invalid-registration-token', 'messaging/registration-token-not-registered', 'messaging/invalid-argument', 'messaging/third-party-auth-error'].includes(errorCode)) {
                            badTokens.add(chunk[idx].message.token);
                        }
                    }
                });
            } catch (e) {
                console.error('❌ 발송 에러:', e.message);
            }
        }

        // 1. 무효 토큰 삭제 (성공한 게 있든 없든 진행)
        if (badTokens.size > 0) {
            console.log(`🧹 무효 토큰 ${badTokens.size}개 정리 중...`);
            for (const token of badTokens) {
                const snap = await db.collection('alerts').where('token', '==', token).get();
                const batch = db.batch();
                snap.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }

        // 2. 발송 성공한 문서만 쿨다운 업데이트 (삭제된 문서는 제외됨)
        if (successRefs.length > 0) {
            console.log(`📝 성공한 ${successRefs.length}개 문서 쿨다운 업데이트...`);
            const batch = db.batch();
            successRefs.forEach(ref => batch.update(ref, { lastPushedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await batch.commit();
        }

        console.log(`📊 결과: 성공 ${successRefs.length}, 정리 ${badTokens.size}개`);
    } else {
        console.log('✅ 발송 대상 없음');
    }
    console.log('🏁 완료');
}

main().catch(console.error);
