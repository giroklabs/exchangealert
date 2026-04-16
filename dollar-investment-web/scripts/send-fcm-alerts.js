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
 * 서버와 앱이 동일한 시간 윈도우를 공유하여 중복 판별에 사용
 * 예: "USD_2026-04-16_14:20"
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
    console.log('🚀 FCM 개별 사용자 알림 스크립트 시작...');

    if (!SERVICE_ACCOUNT) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다.');
        return;
    }

    // 1. Firebase Admin 초기화
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

    // 2. 현재 환율 데이터 로드
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

    // 3. Firestore에서 모든 활성화된 알림 설정 가져오기
    console.log('📡 Firestore에서 알림 대상 조회 중...');
    const alertsSnapshot = await db.collection('alerts').where('isEnabled', '==', true).get();
    
    if (alertsSnapshot.empty) {
        console.log('✅ 대기 중인 알림 설정이 없습니다.');
        return;
    }

    console.log(`🔔 총 ${alertsSnapshot.size}개의 알림 설정 확인됨. 조건 체크 시작...`);

    const messages = [];
    const docsToUpdate = []; // 푸시 발송 후 lastPushedAt 업데이트용
    const now = new Date();

    for (const doc of alertsSnapshot.docs) {
        const alert = doc.data();
        const { token, currency, threshold, thresholdType } = alert;

        // ─── 쿨다운 체크: 동일 통화 알림을 COOLDOWN_MINUTES 내 재발송 방지 ───
        if (alert.lastPushedAt) {
            const lastPushed = alert.lastPushedAt.toDate ? alert.lastPushedAt.toDate() : new Date(alert.lastPushedAt);
            const minutesSince = (now - lastPushed) / (1000 * 60);
            if (minutesSince < COOLDOWN_MINUTES) {
                console.log(`⏳ 쿨다운 중: ${currency} (${doc.id}) - ${minutesSince.toFixed(1)}분 전 발송`);
                continue;
            }
        }

        // 해당 통화의 현재 환율 찾기
        const rateInfo = rates.find(r => r.cur_unit === currency);
        if (!rateInfo || !rateInfo.deal_bas_r) continue;

        const currentRate = parseFloat(rateInfo.deal_bas_r.replace(/,/g, ''));
        if (isNaN(currentRate)) continue;

        let shouldNotify = false;
        let emoji = '🔔';
        let direction = '';

        switch (thresholdType) {
            case 'upper':
            case '상한선':
                if (currentRate >= threshold) {
                    shouldNotify = true;
                    emoji = '📈';
                    direction = '상한선 돌파';
                }
                break;
            case 'lower':
            case '하한선':
                if (currentRate <= threshold) {
                    shouldNotify = true;
                    emoji = '📉';
                    direction = '하한선 돌파';
                }
                break;
            case 'both3':
            case '3% 변동':
                if (currentRate >= threshold * 1.03) {
                    shouldNotify = true;
                    emoji = '🚀';
                    direction = '3% 상승';
                } else if (currentRate <= threshold * 0.97) {
                    shouldNotify = true;
                    emoji = '⬇️';
                    direction = '3% 하락';
                }
                break;
            case 'both':
            case '5% 변동':
                if (currentRate >= threshold * 1.05) {
                    shouldNotify = true;
                    emoji = '🔥';
                    direction = '5% 상승';
                } else if (currentRate <= threshold * 0.95) {
                    shouldNotify = true;
                    emoji = '❄️';
                    direction = '5% 하락';
                }
                break;
        }

        if (shouldNotify) {
            const pushWindow = getPushWindow(currency);
            console.log(`🎯 알림 조건 충족: ${currency} (${currentRate}) -> ${direction} (목표: ${threshold}) [window: ${pushWindow}]`);
            
            messages.push({
                token: token,
                notification: {
                    title: `${emoji} ${currency} 환율 ${direction}!`,
                    body: `현재 환율이 ${currentRate.toLocaleString()}원입니다. (목표: ${threshold.toLocaleString()}원)`
                },
                data: {
                    type: 'threshold_alert',
                    currency: currency,
                    pushWindow: pushWindow,
                    rate: currentRate.toString(),
                    threshold: threshold.toString()
                },
                android: {
                    priority: 'high',
                    notification: {
                        sound: 'default',
                        clickAction: 'FLUTTER_NOTIFICATION_CLICK'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            alert: {
                                title: `${emoji} ${currency} 환율 ${direction}!`,
                                body: `현재 환율이 ${currentRate.toLocaleString()}원입니다. (목표: ${threshold.toLocaleString()}원)`
                            },
                            sound: 'default',
                            badge: 1,
                            'mutable-content': 1
                        }
                    }
                }
            });

            // 발송 성공 후 Firestore 업데이트 대상 기록
            docsToUpdate.push(doc.ref);
        }
    }

    // 4. 알림 발송 (일괄 전송)
    if (messages.length > 0) {
        console.log(`📤 ${messages.length}개의 푸시 알림 발송 중...`);
        
        // chunk로 나누어 발송 (FCM은 한 번에 최대 500개 권장)
        const chunks = [];
        for (let i = 0; i < messages.length; i += 500) {
            chunks.push(messages.slice(i, i + 500));
        }

        let totalSuccess = 0;
        let totalFail = 0;

        for (const chunk of chunks) {
            try {
                const response = await admin.messaging().sendEach(chunk);
                totalSuccess += response.successCount;
                totalFail += response.failureCount;
                console.log(`✅ 발송 완료: 성공 ${response.successCount}, 실패 ${response.failureCount}`);
                
                // 실패 응답에서 잘못된 토큰 정리
                response.responses.forEach((resp, idx) => {
                    if (!resp.success && resp.error) {
                        const errorCode = resp.error.code;
                        if (errorCode === 'messaging/invalid-registration-token' ||
                            errorCode === 'messaging/registration-token-not-registered') {
                            const badToken = chunk[idx].token;
                            console.log(`🗑️ 만료된 토큰 감지, Firestore에서 삭제 예정: ${badToken.substring(0, 8)}...`);
                            // 해당 토큰의 알림 설정 삭제
                            db.collection('alerts').where('token', '==', badToken).get()
                                .then(snap => snap.forEach(d => d.ref.delete()))
                                .catch(() => {});
                        }
                    }
                });
            } catch (e) {
                console.error('❌ 발송 에러:', e.message);
            }
        }

        // 5. 발송 성공한 알림 설정에 lastPushedAt 업데이트
        if (totalSuccess > 0) {
            const batch = db.batch();
            for (const ref of docsToUpdate) {
                batch.update(ref, { lastPushedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
            try {
                await batch.commit();
                console.log(`📝 ${docsToUpdate.length}개 알림 설정의 lastPushedAt 업데이트 완료`);
            } catch (e) {
                console.error('⚠️ lastPushedAt 업데이트 실패:', e.message);
            }
        }

        console.log(`📊 최종 결과: 성공 ${totalSuccess}, 실패 ${totalFail}`);
    } else {
        console.log('✅ 현재 조건에 맞는 알림 대상이 없습니다.');
    }

    console.log('🏁 알림 스크립트 완료');
}

main().catch(err => {
    console.error('❌ 에러 발생:', err);
    process.exit(0); // 워크플로 중단 방지
});
