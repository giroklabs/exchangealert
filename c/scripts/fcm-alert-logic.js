// send-fcm-alerts.js의 판정 로직. Firebase 없이 테스트할 수 있도록 분리했다.

export const EXPECTED_PROJECT_ID = 'exchange-alert-91b92';
export const COOLDOWN_MINUTES = 60;
export const MAX_RATE_AGE_MINUTES = 30;

// 환율이 기준선 부근에서 흔들릴 때 알림이 반복되지 않도록, 기준선에서 이만큼 되돌아와야 다시 알림 가능 상태가 된다.
export const REARM_MARGIN = 0.002;

const BANDS = {
    '3% 변동': { pct: 0.03, up: ['🚀', '3% 상승'], down: ['⬇️', '3% 하락'] },
    '5% 변동': { pct: 0.05, up: ['🔥', '5% 상승'], down: ['❄️', '5% 하락'] },
};

/** 조건 충족(met)과 재무장 가능(cleared) 여부를 계산한다. 잘못된 입력이면 null. */
export function evaluateCondition(thresholdType, threshold, rate) {
    if (!Number.isFinite(threshold) || threshold <= 0 || !Number.isFinite(rate) || rate <= 0) return null;

    if (thresholdType === '상한선') {
        return { met: rate >= threshold, cleared: rate < threshold * (1 - REARM_MARGIN), emoji: '📈', direction: '상한선 돌파' };
    }
    if (thresholdType === '하한선') {
        return { met: rate <= threshold, cleared: rate > threshold * (1 + REARM_MARGIN), emoji: '📉', direction: '하한선 돌파' };
    }

    const band = BANDS[thresholdType];
    if (!band) return null;

    const upper = threshold * (1 + band.pct);
    const lower = threshold * (1 - band.pct);
    const isUp = rate >= upper;
    const isDown = rate <= lower;
    const [emoji, direction] = isDown ? band.down : band.up;
    return {
        met: isUp || isDown,
        cleared: rate < upper * (1 - REARM_MARGIN) && rate > lower * (1 + REARM_MARGIN),
        emoji,
        direction,
    };
}

/**
 * 알림 문서 하나에 대해 발송 여부와 저장할 상태를 결정한다.
 *
 * 상태가 없거나 기준값이 바뀐 문서는 현재 상태만 기록하고 보내지 않는다.
 * 서비스 재가동 시 이미 조건을 넘어 있는 사용자 전원에게 알림이 나가는 것을 막고,
 * 문서를 통째로 덮어쓰는 구버전 앱이 상태를 지워도 재발송되지 않게 하기 위함이다.
 */
export function decideAlert(alert, rate) {
    const evaluation = evaluateCondition(alert.thresholdType, alert.threshold, rate);
    if (!evaluation) return { notify: false, invalid: true, update: null };

    const armSignature = `${alert.thresholdType}|${alert.threshold}`;
    const hasState = alert.armSignature === armSignature && typeof alert.conditionActive === 'boolean';

    if (!hasState) {
        return { notify: false, update: { armSignature, conditionActive: evaluation.met } };
    }
    if (alert.conditionActive) {
        return { notify: false, update: evaluation.cleared ? { conditionActive: false } : null };
    }
    if (evaluation.met) {
        return { notify: true, emoji: evaluation.emoji, direction: evaluation.direction, update: { conditionActive: true } };
    }
    return { notify: false, update: null };
}

export function isWithinCooldown(lastPushedAt, now) {
    if (!lastPushedAt) return false;
    const last = lastPushedAt.toDate ? lastPushedAt.toDate() : new Date(lastPushedAt);
    return (now - last) / 60000 < COOLDOWN_MINUTES;
}

/** 환율 파일의 생성 시각. '+0900' 형식도 처리하며, 없거나 잘못되면 null. */
export function ratesFetchedAt(rates) {
    const meta = Array.isArray(rates) ? rates.find(r => r.cur_unit === 'META') : null;
    if (!meta || !meta.fetched_at) return null;
    const date = new Date(String(meta.fetched_at).replace(/([+-]\d{2})(\d{2})$/, '$1:$2'));
    return Number.isNaN(date.getTime()) ? null : date;
}

export function areRatesFresh(rates, now) {
    const fetchedAt = ratesFetchedAt(rates);
    return fetchedAt !== null && (now - fetchedAt) / 60000 <= MAX_RATE_AGE_MINUTES;
}

export function parseRate(rateInfo) {
    if (!rateInfo || rateInfo.deal_bas_r === undefined || rateInfo.deal_bas_r === null) return NaN;
    return parseFloat(String(rateInfo.deal_bas_r).replace(/,/g, ''));
}

// 토큰 자체가 무효임을 뜻하는 오류만 구독 삭제 대상이다.
// messaging/third-party-auth-error(APNs 키 문제)나 messaging/invalid-argument(요청 문제)로 삭제하면 정상 사용자가 사라진다.
const BAD_TOKEN_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
]);

export function isBadTokenError(code) {
    return BAD_TOKEN_CODES.has(code);
}

export function isConfigurationError(code) {
    return code === 'messaging/third-party-auth-error' || code === 'messaging/mismatched-credential';
}
