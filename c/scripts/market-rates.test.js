import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    isFxMarketOpen,
    isMarketSnapshotUsable,
    refreshMarketRates,
    shouldFetchMarket,
    toKrwRates,
    toRatesArray,
} from './market-rates.js';
import { areRatesFresh } from './fcm-alert-logic.js';
import { run } from './send-fcm-alerts.js';

// 2026-11-17(화) 12:00 KST
const TUESDAY = new Date('2026-11-17T03:00:00Z');
const minutesBefore = (date, m) => new Date(date.getTime() - m * 60000);
const SAMPLE = { base: 'USD', rates: { KRW: 1335.46, JPY: 159.57, EUR: 0.9077, CNY: 6.669, IDR: 18245, XYZ: 0 } };

test('원화 환산: 엔화·루피아는 100단위, 없는 통화는 뺀다', () => {
    const krw = toKrwRates(SAMPLE);
    assert.equal(krw.USD, 1335.46);
    assert.equal(krw.JPY, 836.91);
    assert.equal(krw.EUR, 1471.26);
    assert.equal(krw.CNY, 200.25);
    assert.equal(krw.IDR, 7.32);
    assert.equal(krw.GBP, undefined);
    assert.equal(toKrwRates({ rates: { USD: 1 } }), null);
});

test('외환시장은 한국 시각 월요일 06시 ~ 토요일 07시에 열려 있다', () => {
    assert.equal(isFxMarketOpen(new Date('2026-11-21T03:00:00Z')), false); // 토 12시 KST
    assert.equal(isFxMarketOpen(new Date('2026-11-22T20:59:00Z')), false); // 월 05:59 KST
    assert.equal(isFxMarketOpen(new Date('2026-11-22T21:00:00Z')), true); // 월 06:00 KST
    assert.equal(isFxMarketOpen(new Date('2026-11-20T21:59:00Z')), true); // 토 06:59 KST
    assert.equal(isFxMarketOpen(new Date('2026-11-20T22:00:00Z')), false); // 토 07:00 KST
    assert.equal(isFxMarketOpen(TUESDAY), true);
});

test('장중 15분 간격으로만 받고, 주말에는 받지 않는다', () => {
    assert.equal(shouldFetchMarket(null, TUESDAY), true);
    assert.equal(shouldFetchMarket({ fetchedAt: minutesBefore(TUESDAY, 10) }, TUESDAY), false);
    assert.equal(shouldFetchMarket({ fetchedAt: minutesBefore(TUESDAY, 14) }, TUESDAY), true);
    assert.equal(shouldFetchMarket(null, new Date('2026-11-21T03:00:00Z')), false);
});

test('장중에는 30분, 주말에는 72시간 이내 값만 쓴다', () => {
    const snap = at => ({ rates: { USD: 1335 }, fetchedAt: at });
    assert.equal(isMarketSnapshotUsable(snap(minutesBefore(TUESDAY, 30)), TUESDAY), true);
    assert.equal(isMarketSnapshotUsable(snap(minutesBefore(TUESDAY, 31)), TUESDAY), false);
    const saturday = new Date('2026-11-21T03:00:00Z');
    assert.equal(isMarketSnapshotUsable(snap(new Date('2026-11-20T21:50:00Z')), saturday), true);
    assert.equal(isMarketSnapshotUsable(snap(new Date('2026-11-17T21:50:00Z')), saturday), false);
    assert.equal(isMarketSnapshotUsable(null, TUESDAY), false);
});

test('시장 환율 배열은 알림 판정에서 신선하다고 본다', () => {
    const rates = toRatesArray({ rates: { USD: 1335.46, JPY: 836.91 }, fetchedAt: minutesBefore(TUESDAY, 5) });
    assert.deepEqual(rates[1], { result: 1, cur_unit: 'USD', deal_bas_r: '1335.46' });
    assert.equal(areRatesFresh(rates, TUESDAY), true);
    const stale = toRatesArray({ rates: { USD: 1335.46 }, fetchedAt: minutesBefore(TUESDAY, 45) });
    assert.equal(areRatesFresh(stale, TUESDAY), false);
});

function fakeDoc(initial) {
    const state = { data: initial, writes: 0 };
    const ref = {
        get: async () => ({ exists: !!state.data, data: () => state.data }),
        set: async data => { state.data = data; state.writes += 1; },
    };
    return { state, db: { collection: () => ({ doc: () => ref }) } };
}
const firestore = { Timestamp: { fromDate: d => d } };
const quiet = { log() {}, warn() {}, error() {} };

test('받을 때가 되면 UniRate를 불러 문서를 갱신하고, 키는 로그에 남기지 않는다', async () => {
    const { state, db } = fakeDoc(null);
    let calledUrl = '';
    const result = await refreshMarketRates({
        db, firestore, apiKey: 'SECRET', now: TUESDAY, log: quiet,
        fetchImpl: async url => { calledUrl = url; return { ok: true, json: async () => SAMPLE }; },
    });
    assert.match(calledUrl, /api_key=SECRET&from=USD/);
    assert.equal(state.writes, 1);
    assert.equal(result.rates.USD, 1335.46);
    assert.equal(result.attribution, 'Exchange Rates By UniRateAPI');

    const errors = [];
    const failed = await refreshMarketRates({
        db: fakeDoc(null).db, firestore, apiKey: 'SECRET', now: TUESDAY,
        log: { ...quiet, error: (...a) => errors.push(a.join(' ')) },
        fetchImpl: async () => { throw new Error('bad url ...api_key=SECRET'); },
    });
    assert.equal(failed, null);
    assert.ok(errors.every(e => !e.includes('SECRET')));
});

test('최근에 받았으면 부르지 않고 저장된 값을 쓴다', async () => {
    const { state, db } = fakeDoc({ rates: { USD: 1330 }, fetchedAt: minutesBefore(TUESDAY, 5) });
    const result = await refreshMarketRates({
        db, firestore, apiKey: 'K', now: TUESDAY, log: quiet,
        fetchImpl: async () => assert.fail('부르면 안 된다'),
    });
    assert.equal(state.writes, 0);
    assert.equal(result.rates.USD, 1330);
});

test('시장 환율로 판정하면 푸시에 "시장 환율"이라고 쓴다', async () => {
    const sent = [];
    const docs = [{ id: 'a', ref: { id: 'a' }, data: () => ({ token: 't', currency: 'USD', threshold: 1335, thresholdType: '상한선', armSignature: '상한선|1335', conditionActive: false }) }];
    const db = {
        collection: () => ({ where: () => ({ get: async () => ({ empty: false, size: 1, docs }) }) }),
        bulkWriter: () => ({ onWriteError() {}, update: async () => {}, close: async () => {} }),
    };
    const fs = () => db;
    fs.FieldValue = { serverTimestamp: () => 'T' };
    const firebase = { apps: [{}], firestore: fs, messaging: () => ({ sendEach: async m => { sent.push(...m); return { responses: m.map(() => ({ success: true })) }; } }) };
    const healthy = await run({
        firebase,
        serviceAccountJson: JSON.stringify({ project_id: 'exchange-alert-91b92' }),
        rates: [{ cur_unit: 'META', source: 'koreaexim', rate_date: '2026-11-17' }, { cur_unit: 'USD', deal_bas_r: '1,330' }],
        getMarketRates: async () => ({ rates: { USD: 1335.46 }, fetchedAt: minutesBefore(TUESDAY, 3) }),
        now: TUESDAY,
    });
    assert.equal(healthy, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].notification.body, '현재 시장 환율이 1,335.46원입니다.');
    assert.equal(sent[0].data.source, 'market');
});

test('시장 환율이 없으면 고시 환율로 판정한다', async () => {
    const sent = [];
    const docs = [{ id: 'a', ref: { id: 'a' }, data: () => ({ token: 't', currency: 'USD', threshold: 1335, thresholdType: '상한선', armSignature: '상한선|1335', conditionActive: false }) }];
    const db = {
        collection: () => ({ where: () => ({ get: async () => ({ empty: false, size: 1, docs }) }) }),
        bulkWriter: () => ({ onWriteError() {}, update: async () => {}, close: async () => {} }),
    };
    const fs = () => db;
    fs.FieldValue = { serverTimestamp: () => 'T' };
    const firebase = { apps: [{}], firestore: fs, messaging: () => ({ sendEach: async m => { sent.push(...m); return { responses: m.map(() => ({ success: true })) }; } }) };
    await run({
        firebase,
        serviceAccountJson: JSON.stringify({ project_id: 'exchange-alert-91b92' }),
        rates: [{ cur_unit: 'META', source: 'koreaexim', rate_date: '2026-11-17' }, { cur_unit: 'USD', deal_bas_r: '1,340' }],
        getMarketRates: async () => null,
        now: TUESDAY,
    });
    assert.equal(sent[0].notification.body, '현재 환율이 1,340원입니다.');
});
