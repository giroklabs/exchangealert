/**
 * 텔레그램 연동 테스트 스크립트
 * 사용법: TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy node scripts/test-telegram.js
 */

import https from 'https';

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

console.log('🔍 텔레그램 설정 확인 중...');
console.log(`- Token: ${token ? '✅ 설정됨' : '❌ 미설정'}`);
console.log(`- Chat ID: ${chatId ? '✅ 설정됨' : '❌ 미설정'}`);

if (!token || !chatId) {
    console.error('\n❌ 필수 환경 변수가 누락되었습니다.');
    console.log('GitHub Secrets에 TELEGRAM_BOT_TOKEN과 TELEGRAM_CHAT_ID를 등록해야 합니다.');
    process.exit(1);
}

const message = `
🔔 *달러 인베스트 연동 테스트*
━━━━━━━━━━━━━━━━━━
본 메시지는 텔레그램 봇 연동 테스트용입니다.
이 메시지가 보인다면 모든 설정이 정상입니다!

🚀 *현재 상태:* 정상 작동 중
⏰ *테스트 시각:* ${new Date().toLocaleString('ko-KR')}
━━━━━━━━━━━━━━━━━━
`;

const data = JSON.stringify({
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown'
});

const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

console.log('\n🚀 테스트 메시지 발송 중...');

const req = https.request(options, (res) => {
    let responseBody = '';
    res.on('data', chunk => responseBody += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            console.log('✅ 테스트 메시지 발송 성공!');
            console.log('텔레그램 앱에서 메시지를 확인해 주세요.');
        } else {
            console.error(`❌ 발송 실패 (상태 코드: ${res.statusCode})`);
            console.error('응답 내용:', responseBody);
        }
    });
});

req.on('error', (e) => {
    console.error('❌ 에러 발생:', e.message);
});

req.write(data);
req.end();
