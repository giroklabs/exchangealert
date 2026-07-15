import { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface NewsItem {
    id: string;
    title: string;
    link: string;
    pubDate: string;
    source: string;
    sourceUrl: string;
    relatedLinks: { title: string; link: string; source: string }[];
}

const KEYWORD_PRESETS = [
    { label: '전체', query: '전체' },
    { label: '환율', query: '환율' },
    { label: '원/달러', query: '원+달러+환율' },
    { label: '달러 투자', query: '달러+투자+외화' },
    { label: '한국은행', query: '한국은행+금리+환율' },
    { label: '외환시장', query: '외환시장' },
    { label: '코스피', query: '코스피+증시' },
];

const PROXY = 'https://api.allorigins.win/raw?url=';

function timeAgo(dateStr: string): string {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diff < 60) return '방금 전';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        return `${Math.floor(diff / 86400)}일 전`;
    } catch {
        return dateStr;
    }
}

function parseRSS(xmlText: string): NewsItem[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    const items = doc.querySelectorAll('item');
    const results: NewsItem[] = [];

    items.forEach((item, idx) => {
        const title = item.querySelector('title')?.textContent?.trim() || '';
        const link = item.querySelector('link')?.textContent?.trim() || '';
        const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
        const sourceEl = item.querySelector('source');
        const source = sourceEl?.textContent?.trim() || '';
        const sourceUrl = sourceEl?.getAttribute('url') || '';

        // Parse related links from description (ol > li > a)
        const descRaw = item.querySelector('description')?.textContent || '';
        const descDoc = parser.parseFromString(descRaw, 'text/html');
        const anchors = descDoc.querySelectorAll('a');
        const relatedLinks: { title: string; link: string; source: string }[] = [];
        anchors.forEach((a) => {
            const t = a.textContent?.trim() || '';
            const l = a.getAttribute('href') || '';
            const nextFont = a.nextElementSibling;
            const src = nextFont?.textContent?.trim() || '';
            if (t && l && t !== title) relatedLinks.push({ title: t, link: l, source: src });
        });

        results.push({
            id: `news-${idx}-${link.slice(-10)}`,
            title,
            link,
            pubDate,
            source,
            sourceUrl,
            relatedLinks,
        });
    });

    // 최신순 정렬 (pubDate 기준 내림차순)
    results.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

    return results;
}

// 컴포넌트 외부 전역 캐시 (앱 로드 시 유지)
const newsCache: Record<string, { data: NewsItem[]; timestamp: Date; promise?: Promise<NewsItem[]> }> = {};
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5분 유효기간

// 앱이 렌더링되자마자 백그라운드에서 첫 번째 데이터(기본값) 미리 가져오기 (Pre-fetch)
const defaultQuery = KEYWORD_PRESETS[0].query;
const defaultRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(defaultQuery)}&hl=ko&gl=KR&ceid=KR:ko`;
newsCache[defaultQuery] = {
    data: [],
    timestamp: new Date(),
    promise: fetch(`${PROXY}${encodeURIComponent(defaultRssUrl)}`)
        .then(res => {
            if (!res.ok) throw new Error('Prefetch failed');
            return res.text();
        })
        .then(text => {
            const parsed = parseRSS(text);
            newsCache[defaultQuery] = { data: parsed, timestamp: new Date() };
            return parsed;
        })
        .catch(e => {
            console.warn('News prefetch error:', e);
            delete newsCache[defaultQuery]; // 실패 시 초기화하여 나중에 재시도하게 함
            return [];
        })
};

export function ExchangeRateNews() {
    const { theme } = useTheme();
    const [news, setNews] = useState<NewsItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeKeyword, setActiveKeyword] = useState(KEYWORD_PRESETS[0].query);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchNews = useCallback(async (query: string, forceRefresh: boolean = false) => {
        // 1. 캐시 확인 (메모리)
        if (!forceRefresh) {
            const cached = newsCache[query];
            if (cached && cached.data.length > 0 && (new Date().getTime() - cached.timestamp.getTime() < CACHE_EXPIRY_MS)) {
                setNews(cached.data);
                setLastUpdated(cached.timestamp);
                return;
            }
        }

        setIsLoading(true);
        setError(null);

        try {
            // [최적화] 1순위: GitHub Actions로 수집된 정적 JSON 파일 확인 (매우 빠름)
            const staticUrl = `${import.meta.env.BASE_URL || '/'}data/news.json?t=${Date.now()}`;
            const staticRes = await fetch(staticUrl);
            
            if (staticRes.ok) {
                const staticData = await staticRes.json();
                if (staticData && staticData.news) {
                    let newsList: any[] = [];
                    // [Feature] '전체' 탭 클릭 시 모든 카테고리 기사를 모아 중복 제거
                    if (query === '전체') {
                        const allItems = Object.values(staticData.news).flat() as any[];
                        const uniqueMap = new Map();
                        allItems.forEach(item => {
                            if (!uniqueMap.has(item.link)) {
                                uniqueMap.set(item.link, item);
                            }
                        });
                        newsList = Array.from(uniqueMap.values());
                    } else {
                        // [Fix] 키워드 매칭 로직 강화: label(ID) 또는 query 둘 다 대응
                        const preset = KEYWORD_PRESETS.find(p => p.query === query);
                        newsList = staticData.news[preset?.label || ''] || staticData.news[query] || [];
                    }
                    
                    if (newsList && newsList.length > 0) {
                        // 데이터 안전성 확보 및 최신순 정렬 강제 (pubDate 기준 내림차순)
                        const safeNews = newsList.map((n: any) => ({
                            ...n,
                            relatedLinks: n.relatedLinks || []
                        })).sort((a: any, b: any) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
                        
                        setNews(safeNews);
                        setLastUpdated(new Date(staticData.lastUpdate));
                        
                        // 메모리 캐시 업데이트
                        newsCache[query] = { data: safeNews, timestamp: new Date(staticData.lastUpdate) };
                        setIsLoading(false);
                        return;
                    }
                }
            }

            // 2순위: 정적 파일이 없거나 해당 키워드 데이터가 없는 경우 기존 실시간 RSS 방식 사용 (Fallback)
            console.log(`📡 [Fallback] 실시간 RSS 수집 중... (${query})`);
            const rssSearchQuery = query === '전체' ? '환율 OR 코스피 OR 증시' : query;
            const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(rssSearchQuery)}&hl=ko&gl=KR&ceid=KR:ko`;
            const response = await fetch(`${PROXY}${encodeURIComponent(rssUrl)}`);
            if (!response.ok) throw new Error('뉴스를 불러오지 못했습니다.');
            
            const text = await response.text();
            const parsed = parseRSS(text);
            
            setNews(parsed);
            setLastUpdated(new Date());
            newsCache[query] = { data: parsed, timestamp: new Date() };
        } catch (e) {
            setError('뉴스를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews(activeKeyword);
    }, [activeKeyword, fetchNews]);


    return (
        <div className="space-y-6">

            {/* 검색어 프리셋 + 새로고침 */}
            <div className={`p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4 ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
                <div className="flex flex-wrap gap-2">
                    {KEYWORD_PRESETS.map((kw) => (
                        <button
                            key={kw.query}
                            onClick={() => setActiveKeyword(kw.query)}
                            className={`px-4 py-2 text-sm font-bold rounded-xl transition-colors ${activeKeyword === kw.query
                                ? 'bg-yellow-400 text-gray-900'
                                : (theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200')
                                }`}
                        >
                            {kw.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className={`text-xs ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            업데이트: {lastUpdated.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    )}
                    <button
                        onClick={() => fetchNews(activeKeyword, true)}
                        disabled={isLoading}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold transition-all duration-300 shadow-sm hover:shadow-md disabled:opacity-50 ${theme === 'dark'
                            ? 'bg-gray-800 text-yellow-400 border border-gray-700 hover:bg-gray-700'
                            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                            }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={isLoading ? 'animate-spin' : ''}
                        >
                            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                            <polyline points="21 3 21 8 16 8" />
                        </svg>
                        <span>{isLoading ? '불러오는 중...' : '새로고침'}</span>
                    </button>
                </div>
            </div>

            {/* 오류 상태 */}
            {error && (
                <div className={`p-6 rounded-2xl shadow-xl border text-center ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <p className="text-red-500 font-bold mb-2">⚠️ {error}</p>
                    <button onClick={() => fetchNews(activeKeyword, true)} className="px-5 py-2.5 bg-yellow-400 text-gray-900 rounded-xl text-sm font-bold hover:bg-yellow-500">
                        다시 시도
                    </button>
                </div>
            )}

            {/* 로딩 스켈레톤 */}
            {isLoading && !error && (
                <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className={`p-6 rounded-2xl shadow-xl border animate-pulse ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                            <div className={`h-5 rounded-lg w-3/4 mb-3 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
                            <div className={`h-4 rounded-lg w-1/4 ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'}`} />
                        </div>
                    ))}
                </div>
            )}

            {/* 뉴스 목록 */}
            {!isLoading && !error && news.length > 0 && (
                <div className="space-y-4">
                    <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        총 <strong className="text-yellow-500">{news.length}개</strong>의 기사
                    </p>
                    {news.map((item) => {
                        const isExpanded = expandedId === item.id;
                        return (
                            <div
                                key={item.id}
                                className={`p-6 rounded-2xl shadow-xl border transition-all duration-200 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'} ${isExpanded ? 'ring-2 ring-yellow-400' : ''}`}
                            >
                                {/* 메인 기사 */}
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <a
                                            href={item.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`font-bold text-base leading-snug hover:text-yellow-500 transition-colors ${theme === 'dark' ? 'text-white' : 'text-gray-900'
                                                }`}
                                        >
                                            {item.title}
                                        </a>
                                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {item.source || '미디어'}
                                            </span>
                                            <span className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {timeAgo(item.pubDate)}
                                            </span>
                                        </div>
                                    </div>
                                    {item.relatedLinks.length > 0 && (
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${isExpanded
                                                ? 'bg-yellow-400 text-gray-900'
                                                : (theme === 'dark' ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                                                }`}
                                        >
                                            관련 {item.relatedLinks.length}건 {isExpanded ? '▲' : '▼'}
                                        </button>
                                    )}
                                </div>

                                {/* 관련 기사 펼치기 */}
                                {isExpanded && item.relatedLinks.length > 0 && (
                                    <div className={`mt-4 pt-4 border-t border-dashed space-y-3 ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
                                        {item.relatedLinks.map((rel, idx) => (
                                            <div key={idx} className="flex items-start gap-3">
                                                <span className="text-yellow-400 font-bold text-sm flex-shrink-0">↳</span>
                                                <div>
                                                    <a
                                                        href={rel.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`text-sm hover:text-yellow-500 transition-colors ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
                                                            }`}
                                                    >
                                                        {rel.title}
                                                    </a>
                                                    {rel.source && (
                                                        <span className={`text-xs ml-2 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                                            — {rel.source}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 빈 상태 */}
            {!isLoading && !error && news.length === 0 && (
                <div className={`p-12 rounded-2xl shadow-xl border text-center ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <p className={`text-lg font-bold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        관련 뉴스가 없습니다.
                    </p>
                </div>
            )}

            {/* 출처 안내 */}
            <div className={`p-4 rounded-xl text-xs ${theme === 'dark' ? 'bg-gray-800/50 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                📰 뉴스는 Google 뉴스 RSS 피드에서 실시간으로 수집됩니다. 기사 클릭 시 원문 페이지로 이동합니다.
            </div>
        </div>
    );
}
