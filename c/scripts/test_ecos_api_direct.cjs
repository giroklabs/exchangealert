const https = require('https');
const KEY = '5RTMINGVGFOXMT0UHGJS';

function fetchEcosItemList(statCode) {
    const url = `https://ecos.bok.or.kr/api/StatisticItemList/${KEY}/json/kr/1/100/${statCode}`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticItemList && json.StatisticItemList.row) {
                        console.log(`\n=== Items for ${statCode} ===`);
                        json.StatisticItemList.row.forEach(r => {
                            console.log(`${r.ITEM_CODE} : ${r.ITEM_NAME} (Cycle: ${r.CYCLE}, Start: ${r.START_TIME}, End: ${r.END_TIME})`);
                        });
                    } else {
                        console.log(`\n❌ Failed list for ${statCode}: ${json.RESULT?.MESSAGE}`);
                    }
                } catch(e) { console.error('Error JSON for list', statCode); }
                resolve();
            });
        }).on('error', () => resolve());
    });
}

function fetchEcosData(statCode, cycle, start, end, itemCode) {
    const url = `https://ecos.bok.or.kr/api/StatisticSearch/${KEY}/json/kr/1/10/${statCode}/${cycle}/${start}/${end}/${itemCode}`;
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let urlSummary = `${statCode}/${cycle}/${start}/${end}/${itemCode}`;
                try {
                    const json = JSON.parse(data);
                    if (json.StatisticSearch && json.StatisticSearch.row) {
                         const row = json.StatisticSearch.row;
                         console.log(`✅ ${urlSummary}: ${row[0].TIME} ~ ${row[row.length-1].TIME} (${json.StatisticSearch.list_total_count} records) | Latest val: ${row[row.length-1].DATA_VALUE}`);
                    } else {
                         console.log(`❌ ${urlSummary}: ${json.RESULT?.MESSAGE}`);
                    }
                } catch(e) { console.error('Error JSON for data', statCode); }
                resolve();
            });
        });
    });
}

(async () => {
    console.log("Fetching item lists...");
    await fetchEcosItemList('318Y001'); // 증권투자자 예탁결제금 (일별)
    await fetchEcosItemList('902Y003'); 
    await fetchEcosItemList('731Y003');
    await fetchEcosItemList('802Y001'); // 주식시장(일별) -> 예탁금은 여기에 없었음
    
    // 외채 비중의 Q 포맷 (2024Q1 vs 20241)
    console.log("\nTesting data format...");
    await fetchEcosData('731Y003', 'Q', '2024Q1', '2026Q4', '0000002');
    await fetchEcosData('731Y003', 'Q', '20241', '20264', '0000002');
})();
