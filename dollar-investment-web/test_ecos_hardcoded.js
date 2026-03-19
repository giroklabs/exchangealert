const https = require('https');
const fs = require('fs');
let key = fs.readFileSync('.env', 'utf8').split('\n').find(l => l.startsWith('ECOS_API_KEY=')).split('=')[1].trim();

function fetchEcos(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row) {
                        console.log('✅ ' + url.split('/').slice(-6,-2).join('/') + ': ' + json.StatisticSearch.list_total_count + ' records. ' + json.StatisticSearch.row[0].TIME + ' ~ ' + json.StatisticSearch.row[json.StatisticSearch.row.length-1].TIME);
                    } else {
                        console.log('❌ ' + url.split('/').slice(-6,-2).join('/') + ': ' + json.RESULT?.MESSAGE);
                    }
                } catch(e) {
                    console.log('❌ Error');
                }
                resolve();
            });
        });
    });
}
(async () => {
    // 1. 투자자예탁금 (기존 064Y001 vs 802Y001 vs 신규 901Y056)
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/064Y001/M/202601/202603/0001000`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/802Y001/D/20260201/20260318/0001000`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/901Y056/D/20260201/20260318/1040000`); 

    // 2. 국고채 10년 (817Y002)
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/817Y002/D/20260201/20260318/010210000`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/817Y002/D/20260201/20260318/010200000`); 

    // 3. CDS
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/902Y003/M/202401/202603/0000140`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/902Y003/D/20260201/20260318/0000140`); 

    // 4. 단기외채
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/731Y003/Q/2024Q1/2026Q4/0000002`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/731Y003/Q/20241/20264/0000002`); 
})();
