/**
 * 구글 뉴스 RSS 수집 및 정적 JSON 저장 스크립트
 * GitHub Actions에서 실행되어 환율 관련 뉴스를 미리 가져옵니다.
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 수집할 키워드 설정
const KEYWORDS = [
    { id: '환율', query: '환율' },
    { id: '원/달러', query: '원+달러+환율' },
    { id: '달러 투자', query: '달러+투자+외화' },
    { id: '한국은행', query: '한국은행+금리+환율' },
    { id: '외환시장', query: '외환시장' },
    { id: '코스피', query: '코스피+증시' }
];

async function fetchNews(query) {
    return new Promise((resolve) => {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const items = parseRSS(data);
                resolve(items);
            });
        }).on('error', (e) => {
            console.error(`❌ News Fetch Error (${query}):`, e.message);
            resolve([]);
        });
    });
}

function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const content = match[1];
        
        const title = (content.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
        const link = (content.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
        const pubDate = (content.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
        const source = (content.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/) || [])[1] || '';
        const sourceUrl = (content.match(/<source[\s\S]*?url="([\s\S]*?)"/) || [])[1] || '';

        // 간결한 데이터 구조 생성
        items.push({
            id: `news-${items.length}-${link.slice(-10)}`,
            title: decodeHtmlEntities(title),
            link,
            pubDate,
            source: decodeHtmlEntities(source),
            sourceUrl,
            relatedLinks: [] // 빈 배열 추가로 프론트엔드 오류 방지
        });

        if (items.length >= 15) break; // 키워드당 최대 15개
    }
    return items;
}

function decodeHtmlEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

async function main() {
    console.log('🚀 뉴스 수집 시작...');
    const newsData = {};

    for (const kw of KEYWORDS) {
        console.log(`📡 [${kw.id}] 뉴스 가져오는 중...`);
        const items = await fetchNews(kw.query);
        newsData[kw.id] = items;
        // 요청 간격 조절
        await new Promise(r => setTimeout(r, 200));
    }

    const output = {
        lastUpdate: new Date().toISOString(),
        news: newsData
    };

    // 저장 경로 설정 (public/data/news.json)
    const outputPath = path.join(__dirname, '..', 'public', 'data', 'news.json');
    const rootPath = path.join(__dirname, '../../data/news.json'); // 루트 data 폴더 백업용

    try {
        // 폴더 생성 확인
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        
        // 프로젝트 루트의 data 폴더도 확인 후 저장
        const rootDir = path.dirname(rootPath);
        if (fs.existsSync(rootDir)) {
            fs.writeFileSync(rootPath, JSON.stringify(output, null, 2));
        }

        console.log(`✨ 뉴스 데이터 저장 완료! (${outputPath})`);
    } catch (err) {
        console.error('❌ 뉴스 저장 실패:', err.message);
    }
}

main();
