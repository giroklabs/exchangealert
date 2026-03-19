const https = require('https');
const fs = require('fs');

let env = fs.readFileSync('.env', 'utf8');
let keyMatch = env.match(/ECOS_API_KEY=([^\n\r]+)/);
let key = process.env.ECOS_API_KEY;

function fetchEcos(stateCode, cycle, start, end, item1) {
    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/${stateCode}/${cycle}/${start}/${end}/${item1}`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let urlSummary = `${stateCode}/${cycle}/${start}/${end}/${item1}`;
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row) {
                        console.log(`✅ ${urlSummary} | ${json.StatisticSearch.list_total_count} records. ${json.StatisticSearch.row[0].TIME} ~ ${json.StatisticSearch.row[json.StatisticSearch.row.length-1].TIME} | sample value: ${json.StatisticSearch.row[json.StatisticSearch.row.length-1].DATA_VALUE}`);
                    } else if (json.RESULT) {
                        console.log(`❌ ${urlSummary} | ${json.RESULT.MESSAGE}`);
                    } else {
                        console.log(`❌ ${urlSummary} | Failed payload`);
                    }
                } catch(e) {
                    console.log(`❌ Error parsing JSON for ${urlSummary}`);
                }
                resolve();
            });
        }).on('error', () => resolve());
    });
}

(async () => {
    console.log("Key length: ", key.length);
    // 1. 투자자예탁금 (318Y001 / 1000000) - D or M
    await fetchEcos('318Y001', 'D', '20260101', '20260318', '1000000');
    // Maybe 0001000
    await fetchEcos('318Y001', 'D', '20260101', '20260318', '0001000');

    // 2. 국고채 10년 (817Y002 / 010210000)
    await fetchEcos('817Y002', 'D', '20260201', '20260318', '010210000');
    await fetchEcos('817Y002', 'D', '20251201', '20260318', '010210000');

    // 3. CDS 프리미엄 (902Y006 / KR or 0000140 ?)
    await fetchEcos('902Y006', 'M', '202501', '202603', 'KR');
    await fetchEcos('902Y006', 'D', '20260101', '20260318', 'KR');
    await fetchEcos('902Y003', 'M', '202501', '202603', 'KR');
    
    // 4. 단기외채 비중
    await fetchEcos('731Y003', 'Q', '2024Q1', '2026Q4', '0000002');
})();
