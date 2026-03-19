const https = require('https');
const fs = require('fs');

let env = fs.readFileSync('.env', 'utf8');
let keyMatch = env.match(/ECOS_API_KEY=([^\n\r]+)/);
let key = keyMatch ? keyMatch[1].trim() : '';

function fetchEcos(url) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    let urlSummary = url.split('/').slice(-6, -1).join('/'); // statCode/cycle/start/end/item1
                    if (json.StatisticSearch && json.StatisticSearch.row) {
                        console.log('✅ ' + urlSummary + ' | ' + json.StatisticSearch.list_total_count + ' records. ' + json.StatisticSearch.row[0].TIME + ' ~ ' + json.StatisticSearch.row[json.StatisticSearch.row.length-1].TIME);
                    } else {
                        console.log('❌ ' + urlSummary + ' | ' + json.RESULT?.MESSAGE);
                    }
                } catch(e) {
                    console.log('❌ Error parsing JSON for ' + url);
                }
                resolve();
            });
        }).on('error', () => resolve());
    });
}

(async () => {
    console.log("Using API Key of length: ", key.length);
    console.log("Key starts with: ", key.substring(0, 4));

    // 1. 투자자예탁금 (064Y001 vs 802Y001 vs 901Y056)
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/064Y001/M/202501/202603/0001000`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/802Y001/D/20260201/20260318/0001000`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/901Y056/D/20260201/20260318/1040000`); 

    console.log("---");
    // 2. 국고채 10년 (817Y002) - item code is usually length 7~9
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/817Y002/D/20260201/20260318/010210000`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/817Y002/D/20260201/20260318/010200000`); 

    console.log("---");
    // 3. CDS (902Y003) - D vs M
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/902Y003/M/202501/202603/0000140`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/902Y003/D/20260201/20260318/0000140`); 

    console.log("---");
    // 4. 단기외채비중 (731Y003) - Q
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/731Y003/Q/2024Q1/2026Q4/0000002`); 
    await fetchEcos(`https://ecos.bok.or.kr/api/StatisticSearch/${key}/json/kr/1/10/731Y003/Q/20241/20264/0000002`); 
})();
