// UniRateAPI 시장 환율을 받아 Firestore rates/live 문서에 둔다.
//
// - 약관상 재배포 금지라 공개 GitHub 파일에는 쓰지 않는다. 앱(로그인 사용자)과 서버만 읽는다.
// - 무료 한도(하루 200회) 안에서 쓰도록 15분에 한 번만 부르고, 외환시장이 닫힌 주말에는 부르지 않는다.
// - API 키는 서버(GitHub Secrets)에만 있다. 키 값은 로그에 남기지 않는다.

export const MARKET_DOC_PATH = ['rates', 'live'];
export const ATTRIBUTION = 'Exchange Rates By UniRateAPI';

// 실행 간격(약 5분)을 감안해 15분보다 1분 짧게 잡는다.
export const MIN_FETCH_INTERVAL_MINUTES = 14;
// 장중에 이보다 오래된 시장 환율은 쓰지 않고 수출입은행 고시로 대신한다.
export const MAX_MARKET_AGE_MINUTES = 30;
// 주말에는 금요일 마감 값을 쓴다. 금요일 밤 마지막 수집부터 월요일 개장까지(약 56시간)를 덮는다.
export const MAX_CLOSED_MARKET_AGE_HOURS = 72;

// 데이터 파일과 같은 통화 표기. 엔화·루피아는 100단위로 고시된다.
export const MARKET_CURRENCIES = [
    'USD', 'JPY', 'EUR', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'THB', 'SGD',
    'NZD', 'SEK', 'NOK', 'DKK', 'MYR', 'SAR', 'AED', 'KWD', 'BHD', 'IDR', 'BND',
];
export const PER_100 = new Set(['JPY', 'IDR']);

/**
 * 국제 외환시장 개장 여부 (UTC 기준). 일요일 21:00 개장 ~ 금요일 22:00 마감.
 * 한국 시각으로 월요일 06:00 ~ 토요일 07:00. 서머타임 차이는 1시간 여유로 덮는다.
 */
export function isFxMarketOpen(now) {
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    if (day === 6) return false;
    if (day === 0) return hour >= 21;
    if (day === 5) return hour < 22;
    return true;
}

/** UniRate 응답(1달러 기준)을 통화별 원화 환율로 바꾼다. 원화가 없으면 null. */
export function toKrwRates(payload) {
    const rates = payload && payload.rates;
    const usdKrw = rates ? Number(rates.KRW) : NaN;
    if (!(usdKrw > 0)) return null;

    const result = {};
    for (const code of MARKET_CURRENCIES) {
        const perUsd = code === 'USD' ? 1 : Number(rates[code]);
        if (!(perUsd > 0)) continue;
        const krw = (usdKrw / perUsd) * (PER_100.has(code) ? 100 : 1);
        result[code] = Math.round(krw * 100) / 100;
    }
    return result;
}

function toDate(value) {
    if (!value) return null;
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** 저장된 시장 환율을 알림·화면에 써도 되는지. 장중에는 30분, 주말에는 72시간 이내. */
export function isMarketSnapshotUsable(snapshot, now) {
    if (!snapshot || !snapshot.rates || !snapshot.rates.USD) return false;
    const fetchedAt = toDate(snapshot.fetchedAt);
    if (!fetchedAt) return false;
    const minutes = (now - fetchedAt) / 60000;
    if (minutes < -5) return false;
    if (isFxMarketOpen(now)) return minutes <= MAX_MARKET_AGE_MINUTES;
    return minutes <= MAX_CLOSED_MARKET_AGE_HOURS * 60;
}

/** 지금 UniRate를 불러야 하는지. 시장이 닫혔거나 최근에 받았으면 부르지 않는다. */
export function shouldFetchMarket(snapshot, now) {
    if (!isFxMarketOpen(now)) return false;
    const fetchedAt = toDate(snapshot && snapshot.fetchedAt);
    if (!fetchedAt) return true;
    return (now - fetchedAt) / 60000 >= MIN_FETCH_INTERVAL_MINUTES;
}

/** 알림 판정 코드가 읽는 환율 파일과 같은 모양으로 바꾼다. */
export function toRatesArray(snapshot) {
    const fetchedAt = toDate(snapshot.fetchedAt);
    const items = [{ result: 1, cur_unit: 'META', source: 'unirate', fetched_at: fetchedAt ? fetchedAt.toISOString() : null }];
    for (const [code, value] of Object.entries(snapshot.rates || {})) {
        items.push({ result: 1, cur_unit: code, deal_bas_r: value.toFixed(2) });
    }
    return items;
}

async function requestUniRate(apiKey, fetchImpl) {
    const url = `https://api.unirateapi.com/api/rates?api_key=${encodeURIComponent(apiKey)}&from=USD`;
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`UniRate HTTP ${response.status}`);
    return response.json();
}

/**
 * 필요하면 UniRate를 불러 rates/live를 갱신하고, 지금 쓸 수 있는 시장 환율을 돌려준다.
 * 실패해도 예외를 던지지 않는다. 쓸 수 있는 값이 없으면 null (호출한 쪽이 고시 환율로 대신한다).
 */
export async function refreshMarketRates({ db, firestore, apiKey, now = new Date(), fetchImpl = fetch, log = console }) {
    const ref = db.collection(MARKET_DOC_PATH[0]).doc(MARKET_DOC_PATH[1]);
    let snapshot = null;
    try {
        const doc = await ref.get();
        snapshot = doc.exists ? doc.data() : null;
    } catch (error) {
        log.error('⚠️ 시장 환율 문서 읽기 실패:', error.message);
    }

    if (!apiKey) {
        log.warn('⚠️ UNIRATE_API_KEY가 없어 시장 환율을 새로 받지 않습니다.');
    } else if (shouldFetchMarket(snapshot, now)) {
        try {
            const krw = toKrwRates(await requestUniRate(apiKey, fetchImpl));
            if (!krw || !krw.USD) throw new Error('응답에 원화 환율이 없습니다');

            const changed = !snapshot || !snapshot.rates || snapshot.rates.USD !== krw.USD || snapshot.rates.EUR !== krw.EUR;
            const next = {
                source: 'unirate',
                attribution: ATTRIBUTION,
                rates: krw,
                fetchedAt: firestore.Timestamp.fromDate(now),
                // 값이 실제로 바뀐 시각. 제공처의 갱신 주기를 확인하는 데 쓴다.
                valueChangedAt: changed ? firestore.Timestamp.fromDate(now) : snapshot.valueChangedAt || firestore.Timestamp.fromDate(now),
            };
            await ref.set(next);
            snapshot = next;
            log.log(`💱 시장 환율 갱신: USD ${krw.USD}원, ${Object.keys(krw).length}개 통화${changed ? '' : ' (값 변화 없음)'}`);
        } catch (error) {
            log.error('⚠️ 시장 환율 받기 실패:', String(error.message || error).replace(apiKey, '***'));
        }
    }

    return isMarketSnapshotUsable(snapshot, now) ? snapshot : null;
}
