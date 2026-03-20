/**
 * 환율 뉴스 텔레그램 브리핑 스크립트
 * fetch-news.js 가 생성한 news.json 을 읽어 핵심 기사를 텔레그램으로 전송
 *
 * 사용법:
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy node scripts/send-news-telegram.js
 *
 * 환경변수:
 *   TELEGRAM_BOT_TOKEN  — 텔레그램 봇 토큰
 *   TELEGRAM_CHAT_ID    — 텔레그램 채팅 ID
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────── 설정 ───────────────
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/** 키워드별 노출할 최대 기사 수 */
const MAX_PER_KEYWORD = 3;

/** 24시간 이내 기사만 포함 (ms) */
const FRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** news.json 경로 */
const NEWS_FILE = path.join(__dirname, '..', 'public', 'data', 'news.json');

/** 섹션 이름 매핑 (fetch-news.js 의 키워드 id → 표시명) */
const SECTION_LABELS = {
    '환율': '📊 환율 동향',
    '원/달러': '💱 원/달러',
    '달러 투자': '💰 달러 투자',
    '한국은행': '🏦 한국은행',
    '외환시장': '🌐 외환시장'
};

// ─────────────── 유틸 ───────────────

/** RFC 2822 또는 ISO 날짜 문자열을 Date 로 파싱 */
function parseDate(dateStr) {
    if (!dateStr) return null;
    try {
        return new Date(dateStr);
    } catch {
        return null;
    }
}

/** Telegram Markdown 에서 특수문자 이스케이프 (MarkdownV1 기준) */
function escapeMd(text) {
    return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/** 텍스트를 4096자 이하 청크로 분할 */
function splitMessage(text, maxLen = 4096) {
    if (text.length <= maxLen) return [text];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = start + maxLen;
        if (end < text.length) {
            // 줄바꿈 기준으로 분할
            const lastNewline = text.lastIndexOf('\n', end);
            if (lastNewline > start) end = lastNewline;
        }
        chunks.push(text.slice(start, end));
        start = end;
    }
    return chunks;
}

// ─────────────── 뉴스 파싱 ───────────────

/**
 * news.json 을 읽어 각 키워드별 최신 기사를 필터링/중복 제거 후 반환
 * @returns {{ keyword: string, label: string, articles: Array }[]}
 */
function loadAndFilterNews() {
    if (!fs.existsSync(NEWS_FILE)) {
        console.error('❌ news.json 파일이 없습니다. 먼저 fetch-news.js 를 실행해 주세요.');
        return [];
    }

    const raw = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf8'));
    const now = Date.now();
    const seenLinks = new Set();

    const sections = [];

    for (const [keyword, articles] of Object.entries(raw.news || {})) {
        const label = SECTION_LABELS[keyword] || `📌 ${keyword}`;

        // 24시간 이내 기사 필터링 + 중복 제거
        const fresh = articles.filter(article => {
            if (seenLinks.has(article.link)) return false;
            const pubDate = parseDate(article.pubDate);
            if (pubDate && (now - pubDate.getTime()) > FRESH_THRESHOLD_MS) return false;
            seenLinks.add(article.link);
            return true;
        }).slice(0, MAX_PER_KEYWORD);

        if (fresh.length > 0) {
            sections.push({ keyword, label, articles: fresh });
        }
    }

    console.log(`📰 총 ${sections.reduce((s, sec) => s + sec.articles.length, 0)}개 기사 추출 (${sections.length}개 섹션)`);
    return sections;
}

// ─────────────── 메시지 포맷 ───────────────

function buildNewsMessage(sections, lastUpdate) {
    const now = new Date();
    const kstDate = now.toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).replace(/\. /g, '.').replace(/\.$/g, '');

    let msg = `📰 *환율 뉴스 브리핑*\n`;
    msg += `⏰ ${kstDate} KST\n`;
    msg += `━━━━━━━━━━━━━━━━\n\n`;

    for (const section of sections) {
        msg += `*${section.label}*\n`;
        for (const article of section.articles) {
            // 제목 내 대괄호가 링크 문법을 깨뜨리는 것 방지 (소괄호로 교체)
            let title = article.title.replace(/\[/g, '(').replace(/\]/g, ')');

            // 제목이 너무 길면 60자 자르기
            if (title.length > 60) {
                title = title.slice(0, 58) + '…';
            }
            const source = article.source ? ` — ${article.source}` : '';
            msg += `• [${title}](${article.link})${source}\n`;
        }
        msg += '\n';
    }

    msg += `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n`;
    msg += `🌐 [대시보드 바로가기](https://giroklabs.github.io/exchangealert/)`;

    return msg;
}

// ─────────────── 텔레그램 전송 ───────────────

async function sendTelegramMessage(text) {
    if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
        console.error('❌ TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다.');
        return false;
    }

    const data = JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    });

    return new Promise((resolve) => {
        const options = {
            hostname: 'api.telegram.org',
            port: 443,
            path: `/bot${TELEGRAM_TOKEN}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log('✅ [Telegram] 메시지 전송 완료');
                    resolve(true);
                } else {
                    console.error(`❌ [Telegram] 전송 실패 (${res.statusCode}):`, body.substring(0, 300));
                    resolve(false);
                }
            });
        });

        req.on('error', (e) => {
            console.error('❌ [Telegram] 네트워크 에러:', e.message);
            resolve(false);
        });

        req.write(data);
        req.end();
    });
}

// ─────────────── 메인 ───────────────

async function main() {
    console.log('🚀 환율 뉴스 브리핑 스크립트 시작...');
    console.log(`- Telegram 봇: ${TELEGRAM_TOKEN ? '✅' : '❌ 미설정'}`);
    console.log(`- Chat ID: ${TELEGRAM_CHAT_ID ? '✅' : '❌ 미설정'}`);

    // 1. 뉴스 파일 로드 및 필터링
    const sections = loadAndFilterNews();

    if (sections.length === 0) {
        console.log('⚠️ 발송할 뉴스가 없습니다 (24시간 이내 신규 기사 없음 또는 파일 없음). 종료합니다.');
        return;
    }

    // 2. 메시지 생성
    const message = buildNewsMessage(sections);
    console.log(`📝 생성된 메시지 길이: ${message.length}자`);

    // 3. 4096자 초과 시 분할 발송
    const chunks = splitMessage(message, 4096);
    console.log(`📨 총 ${chunks.length}개 파트로 발송`);

    let allSuccess = true;
    for (let i = 0; i < chunks.length; i++) {
        console.log(`📤 파트 ${i + 1}/${chunks.length} 발송 중...`);
        const ok = await sendTelegramMessage(chunks[i]);
        if (!ok) allSuccess = false;
        if (i < chunks.length - 1) {
            // 연속 요청 시 Telegram rate limit 방지 (0.5초 대기)
            await new Promise(r => setTimeout(r, 500));
        }
    }

    if (allSuccess) {
        console.log('🏁 뉴스 브리핑 전송 완료!');
    } else {
        console.warn('⚠️ 일부 메시지 전송 실패');
    }
}

main().catch(e => {
    console.error('❌ 스크립트 실행 에러:', e.message);
    process.exit(0); // 워크플로 에러로 중단되지 않도록
});
