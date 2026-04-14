import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────── 설정 ───────────────
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const RATES_FILE = path.join(__dirname, '..', '..', 'data', 'exchange-rates.json');

async function main() {
    console.log('🚀 FCM 알림 서버 스크립트 시작...');

    if (!SERVICE_ACCOUNT) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT 환경변수가 설정되지 않았습니다.');
        return;
    }

    // 1. Firebase Admin 초기화
    try {
        const serviceAccount = JSON.parse(SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
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
    const now = new Date();

    for (const doc of alertsSnapshot.docs) {
        const alert = doc.data();
        const { token, currency, threshold, thresholdType } = alert;

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
            console.log(`🎯 알림 조건 충족: ${currency} (${currentRate}) -> ${direction} (목표: ${threshold})`);
            
            messages.push({
                token: token,
                notification: {
                    title: `${emoji} ${currency} 환율 ${direction}!`,
                    body: `현재 환율이 ${currentRate.toLocaleString()}원입니다. (목표: ${threshold.toLocaleString()}원)`
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

        for (const chunk of chunks) {
            try {
                const response = await admin.messaging().sendEach(chunk);
                console.log(`✅ 발송 완료: 성공 ${response.successCount}, 실패 ${response.failureCount}`);
                
                // 실패한 경우 중 잘못된 토큰 등은 Firestore에서 삭제하거나 처리하는 로직 추가 가능
            } catch (e) {
                console.error('❌ 발송 에러:', e.message);
            }
        }
    } else {
        console.log('✅ 현재 조건에 맞는 알림 대상이 없습니다.');
    }

    console.log('🏁 알림 스크립트 완료');
}

main().catch(err => {
    console.error('❌ 에러 발생:', err);
    process.exit(1);
});
