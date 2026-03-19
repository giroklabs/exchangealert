export $(cat .env | xargs) && node -e "
const https = require('https');
let key = process.env.ECOS_API_KEY;

function fetchEcos(url) {
    return new Promise((resolve) => {
        console.log('Requesting: ', url.replace(key, '{KEY}'));
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const json = JSON.parse(data);
                if (json.StatisticSearch && json.StatisticSearch.row) {
                    console.log('✅ Success: ' + json.StatisticSearch.list_total_count + ' records. Range: ' + json.StatisticSearch.row[0].TIME + ' ~ ' + json.StatisticSearch.row[json.StatisticSearch.row.length-1].TIME);
                } else {
                    console.log('❌ Failed: ' + json.RESULT?.MESSAGE);
                }
                resolve();
            });
        });
    });
}

(async () => {
    await fetchEcos(\`https://ecos.bok.or.kr/api/StatisticSearch/\${key}/json/kr/1/10/802Y001/D/20260201/20260318/0001000\`);
    await fetchEcos(\`https://ecos.bok.or.kr/api/StatisticSearch/\${key}/json/kr/1/10/901Y056/D/20260201/20260318/1040000\`);
    await fetchEcos(\`https://ecos.bok.or.kr/api/StatisticSearch/\${key}/json/kr/1/10/817Y002/D/20260201/20260318/010210000\`);
    await fetchEcos(\`https://ecos.bok.or.kr/api/StatisticSearch/\${key}/json/kr/1/10/817Y002/D/20260201/20260318/010200000\`);
    await fetchEcos(\`https://ecos.bok.or.kr/api/StatisticSearch/\${key}/json/kr/1/10/902Y003/M/202501/202603/0000140\`);
    await fetchEcos(\`https://ecos.bok.or.kr/api/StatisticSearch/\${key}/json/kr/1/10/731Y003/Q/20241/20264/0000002\`);
})();"
