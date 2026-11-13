import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    areRatesFresh,
    decideAlert,
    evaluateCondition,
    findRateInfo,
    isBadTokenError,
    isWithinCooldown,
    ratesFingerprint,
    shouldScan,
} from './fcm-alert-logic.js';
import { run } from './send-fcm-alerts.js';

const NOW = new Date('2026-11-10T05:00:00Z');
const SERVICE_ACCOUNT = JSON.stringify({ project_id: 'exchange-alert-91b92' });
const SIGNATURE = '상한선|1400';

const ratesAt = (usd, fetchedAt = '2026-11-10T13:55:00+0900') => [
    { cur_unit: 'META', fetched_at: fetchedAt },
    { cur_unit: 'USD', deal_bas_r: usd },
];

function fakeFirebase(documents, sendResult) {
    const updates = [];
    const deleted = [];
    const sent = [];
    const docs = documents.map(({ id, ...data }) => ({ id, ref: { id }, data: () => data }));
    const collection = {
        where: (field, _op, value) => ({
            get: async () => {
                const matched = field === 'isEnabled' ? docs : docs.filter(d => d.data().token === value);
                return { empty: matched.length === 0, size: matched.length, docs: matched, forEach: fn => matched.forEach(fn) };
            },
        }),
    };
    const db = {
        collection: () => collection,
        batch: () => ({ delete: ref => deleted.push(ref.id), commit: async () => {} }),
        bulkWriter: () => ({
            onWriteError: () => {},
            update: async (ref, data) => updates.push({ id: ref.id, data }),
            close: async () => {},
        }),
    };
    const firestore = () => db;
    firestore.FieldValue = { serverTimestamp: () => 'SERVER_TIME' };
    return {
        updates,
        deleted,
        sent,
        firebase: {
            apps: [{}],
            firestore,
            messaging: () => ({
                sendEach: async messages => {
                    sent.push(...messages);
                    return { responses: messages.map(m => sendResult(m)) };
                },
            }),
        },
    };
}

const baseAlert = { id: 'a', token: 't1', currency: 'USD', threshold: 1400, thresholdType: '상한선', armSignature: SIGNATURE };
const ok = () => ({ success: true });
const failWith = code => () => ({ success: false, error: { code } });

test('상태가 없는 문서는 조건을 넘어 있어도 보내지 않고 기록만 한다', () => {
    const result = decideAlert({ threshold: 1400, thresholdType: '상한선' }, 1450);
    assert.equal(result.notify, false);
    assert.deepEqual(result.update, { armSignature: SIGNATURE, conditionActive: true });
});

test('조건을 넘는 순간 한 번만 보낸다', () => {
    const inactive = { threshold: 1400, thresholdType: '상한선', armSignature: SIGNATURE, conditionActive: false };
    assert.equal(decideAlert(inactive, 1401).notify, true);
    assert.equal(decideAlert({ ...inactive, conditionActive: true }, 1401).notify, false);
});

test('기준선 부근 흔들림으로는 재무장되지 않고, 충분히 되돌아오면 재무장된다', () => {
    const active = { threshold: 1400, thresholdType: '상한선', armSignature: SIGNATURE, conditionActive: true };
    assert.equal(decideAlert(active, 1399).update, null);
    assert.deepEqual(decideAlert(active, 1390).update, { conditionActive: false });
});

test('기준값을 바꾸면 새로 기록만 하고 보내지 않는다', () => {
    const result = decideAlert({ threshold: 1300, thresholdType: '상한선', armSignature: SIGNATURE, conditionActive: false }, 1450);
    assert.equal(result.notify, false);
    assert.equal(result.update.armSignature, '상한선|1300');
});

test('변동 알림은 양방향을 판정한다', () => {
    assert.equal(evaluateCondition('3% 변동', 1400, 1442).direction, '3% 상승');
    assert.equal(evaluateCondition('5% 변동', 1400, 1330).direction, '5% 하락');
    assert.equal(evaluateCondition('5% 변동', 1400, 1400).met, false);
});

test('기준값 0, 문자열, 알 수 없는 유형은 무효 처리한다', () => {
    assert.equal(decideAlert({ threshold: 0, thresholdType: '상한선' }, 1400).invalid, true);
    assert.equal(decideAlert({ threshold: '1400', thresholdType: '상한선' }, 1400).invalid, true);
    assert.equal(decideAlert({ thresholdType: '상한선' }, 1400).invalid, true);
    assert.equal(decideAlert({ threshold: 1400, thresholdType: '기타' }, 1400).invalid, true);
});

test('+0900 형식의 시각으로 신선도를 판단한다', () => {
    assert.equal(areRatesFresh(ratesAt('1,400'), NOW), true);
    assert.equal(areRatesFresh(ratesAt('1,400', '2026-11-10T12:00:00+0900'), NOW), false);
    assert.equal(areRatesFresh([{ cur_unit: 'USD' }], NOW), false);
});

test('수출입은행 데이터는 고시일 기준으로 신선도를 판단한다', () => {
    const exim = (rateDate) => [
        { cur_unit: 'META', fetched_at: '2026-11-08T09:00:00+0900', source: 'koreaexim', rate_date: rateDate },
        { cur_unit: 'USD', deal_bas_r: '1,400' },
    ];
    const kstToday = new Date(NOW.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    assert.equal(areRatesFresh(exim(kstToday), NOW), true);
    assert.equal(areRatesFresh(exim('2020-01-01'), NOW), false);
    assert.equal(areRatesFresh(exim('2999-01-01'), NOW), false);
    assert.equal(areRatesFresh(exim(undefined), NOW), false);
});

test('토큰 무효 오류만 삭제 대상이다', () => {
    assert.equal(isBadTokenError('messaging/registration-token-not-registered'), true);
    assert.equal(isBadTokenError('messaging/third-party-auth-error'), false);
    assert.equal(isBadTokenError('messaging/invalid-argument'), false);
});

test('쿨다운은 60분이다', () => {
    assert.equal(isWithinCooldown(new Date(NOW - 59 * 60000), NOW), true);
    assert.equal(isWithinCooldown(new Date(NOW - 61 * 60000), NOW), false);
    assert.equal(isWithinCooldown(undefined, NOW), false);
});

const minutesAgo = minutes => new Date(NOW - minutes * 60000).toISOString();

test('지문은 시각이 달라도 같고 환율이 다르면 달라진다', () => {
    assert.equal(ratesFingerprint(ratesAt('1,400')), ratesFingerprint(ratesAt('1,400', '2026-11-10T13:50:00+0900')));
    assert.notEqual(ratesFingerprint(ratesAt('1,400')), ratesFingerprint(ratesAt('1,401')));
});

test('조회 여부는 기록, 최소 간격, 환율 변동, 최대 공백으로 결정된다', () => {
    assert.equal(shouldScan(null, 'A', NOW), true);
    assert.equal(shouldScan({ fingerprint: 'A', scannedAt: 'broken' }, 'A', NOW), true);
    assert.equal(shouldScan({ fingerprint: 'A', scannedAt: minutesAgo(5) }, 'B', NOW), false);
    assert.equal(shouldScan({ fingerprint: 'A', scannedAt: minutesAgo(10) }, 'B', NOW), true);
    assert.equal(shouldScan({ fingerprint: 'A', scannedAt: minutesAgo(30) }, 'A', NOW), false);
    assert.equal(shouldScan({ fingerprint: 'A', scannedAt: minutesAgo(60) }, 'A', NOW), true);
});

test('환율 변동이 없으면 Firestore를 조회하지 않고 기록도 바꾸지 않는다', async () => {
    const fake = fakeFirebase([{ ...baseAlert, conditionActive: false }], ok);
    fake.firebase.firestore = () => assert.fail('조회하면 안 된다');
    let saved = null;
    const rates = ratesAt('1,450');
    const healthy = await run({
        firebase: fake.firebase,
        serviceAccountJson: SERVICE_ACCOUNT,
        rates,
        now: NOW,
        lastScan: { fingerprint: ratesFingerprint(rates), scannedAt: minutesAgo(20) },
        onScanComplete: state => { saved = state; },
    });
    assert.equal(healthy, true);
    assert.equal(saved, null);
});

test('조회에 성공하면 기록을 남기고, 발송 설정 오류면 다음 회차에 다시 조회하도록 남기지 않는다', async () => {
    let saved = null;
    const success = fakeFirebase([{ ...baseAlert, conditionActive: false }], ok);
    await run({ firebase: success.firebase, serviceAccountJson: SERVICE_ACCOUNT, rates: ratesAt('1,450'), now: NOW, onScanComplete: s => { saved = s; } });
    assert.equal(saved.scannedAt, NOW.toISOString());

    saved = null;
    const failure = fakeFirebase([{ ...baseAlert, conditionActive: false }], failWith('messaging/third-party-auth-error'));
    await run({ firebase: failure.firebase, serviceAccountJson: SERVICE_ACCOUNT, rates: ratesAt('1,450'), now: NOW, onScanComplete: s => { saved = s; } });
    assert.equal(saved, null);
});

test('위안화 알림(CNH)은 CNY 데이터로 판정한다', () => {
    const rates = [{ cur_unit: 'CNY', deal_bas_r: '201.5' }, { cur_unit: 'USD', deal_bas_r: '1,400' }];
    assert.equal(findRateInfo(rates, 'CNH').deal_bas_r, '201.5');
    assert.equal(findRateInfo(rates, 'USD').deal_bas_r, '1,400');
    assert.equal(findRateInfo(rates, 'XYZ'), undefined);
});

test('매크로 프로젝트 키이면 발송 없이 실패한다', async () => {
    const fake = fakeFirebase([{ ...baseAlert, conditionActive: false }], ok);
    const healthy = await run({
        firebase: fake.firebase,
        serviceAccountJson: JSON.stringify({ project_id: 'macro-alert-4e51c' }),
        rates: ratesAt('1,450'),
        now: NOW,
    });
    assert.equal(healthy, false);
    assert.equal(fake.sent.length, 0);
});

test('오래된 환율이면 아무것도 보내지 않는다', async () => {
    const fake = fakeFirebase([{ ...baseAlert, conditionActive: false }], ok);
    const healthy = await run({
        firebase: fake.firebase,
        serviceAccountJson: SERVICE_ACCOUNT,
        rates: ratesAt('1,450', '2026-11-08T12:00:00+0900'),
        now: NOW,
    });
    assert.equal(healthy, true);
    assert.equal(fake.sent.length, 0);
});

test('발송 성공 시 상태와 쿨다운을 저장하고 content-available을 보낸다', async () => {
    const fake = fakeFirebase([{ ...baseAlert, conditionActive: false }], ok);
    const healthy = await run({ firebase: fake.firebase, serviceAccountJson: SERVICE_ACCOUNT, rates: ratesAt('1,450'), now: NOW });
    assert.equal(healthy, true);
    assert.equal(fake.sent.length, 1);
    assert.equal(fake.sent[0].apns.payload.aps['content-available'], 1);
    assert.deepEqual(fake.updates, [{ id: 'a', data: { conditionActive: true, lastPushedAt: 'SERVER_TIME' } }]);
});

test('재가동 첫 회차에는 조건을 넘은 문서에도 보내지 않는다', async () => {
    const fake = fakeFirebase([{ id: 'old', token: 't', currency: 'USD', threshold: 1400, thresholdType: '상한선' }], ok);
    await run({ firebase: fake.firebase, serviceAccountJson: SERVICE_ACCOUNT, rates: ratesAt('1,450'), now: NOW });
    assert.equal(fake.sent.length, 0);
    assert.equal(fake.updates[0].data.conditionActive, true);
});

test('APNs 인증 오류는 구독을 지우지 않고 작업을 실패로 표시하며, 다음 회차에 재시도되게 둔다', async () => {
    const fake = fakeFirebase([{ ...baseAlert, conditionActive: false }], failWith('messaging/third-party-auth-error'));
    const healthy = await run({ firebase: fake.firebase, serviceAccountJson: SERVICE_ACCOUNT, rates: ratesAt('1,450'), now: NOW });
    assert.equal(healthy, false);
    assert.deepEqual(fake.deleted, []);
    assert.deepEqual(fake.updates, []);
});

test('만료 토큰은 삭제한다', async () => {
    const fake = fakeFirebase([{ ...baseAlert, conditionActive: false }], failWith('messaging/registration-token-not-registered'));
    const healthy = await run({ firebase: fake.firebase, serviceAccountJson: SERVICE_ACCOUNT, rates: ratesAt('1,450'), now: NOW });
    assert.equal(healthy, true);
    assert.deepEqual(fake.deleted, ['a']);
});

test('잘못된 문서가 있어도 정상 문서는 발송된다', async () => {
    const fake = fakeFirebase(
        [{ id: 'bad', token: 't0', currency: 'USD', thresholdType: '상한선' }, { ...baseAlert, conditionActive: false }],
        ok,
    );
    const healthy = await run({ firebase: fake.firebase, serviceAccountJson: SERVICE_ACCOUNT, rates: ratesAt('1,450'), now: NOW });
    assert.equal(healthy, true);
    assert.equal(fake.sent.length, 1);
});
