const https = require('https');
const ECOS_API_KEY = process.env.ECOS_API_KEY || 'sample';

function fetchEcos(url) {
    return new Promise((resolve) => {
        console.log(`Requesting: ${url.replace(ECOS_API_KEY, '{KEY}')}`);
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row) {
                        const count = json.StatisticSearch.list_total_count;
                        console.log(`✅ Success: ${count} records. Dates: ${json.StatisticSearch.row[0].TIME} ~ ${json.StatisticSearch.row[json.StatisticSearch.row.length-1].TIME}`);
                    } else {
                        console.log(`❌ Failed: ${json.RESULT?.MESSAGE}`);
                    }
                } catch (e) { console.error("Error", e.message); }
                resolve();
            });
        }).on('error', () => resolve());
    });
}
async function test() {
    const key = process.env.ECOS_API_KEY;
    if(!key) { console.log('No key, set ECOS_API_KEY'); return; }
    // 1. 투자자예탁금 (기존 802Y001) -> 901Y056 으로 테스트
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/901Y056/D/20260201/20260318/1040000`);
    // 2. 국고채 10년 (817Y002 vs 817Y002 with different items)
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/817Y002/D/20260201/20260318/010210000`);
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/817Y002/D/20260201/20260318/010200000`);
    // 3. CDS 프리미엄
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/902Y003/M/202501/202603/0000140`);
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/902Y003/D/20260201/20260318/0000140`);
    // 4. 외평채 가산금리
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/902Y003/M/202501/202603/0000147`);
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/902Y003/D/20260201/20260318/0000147`);
    // 5. 단기외채비중 (731Y003 vs 731Y001)
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/731Y003/Q/2024Q1/2026Q4/0000002`);
}
test();
