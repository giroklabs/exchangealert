const https = require('https');
const fs = require('fs');
let env = fs.readFileSync('.env', 'utf8');
let keyMatch = env.match(/ECOS_API_KEY=([^\n\r]+)/);
let key = keyMatch ? keyMatch[1].trim() : '';

const url = `https://ecos.bok.or.kr/api/StatisticTableList/${key}/json/kr/1/10000`;
https.get(url, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        fs.writeFileSync('ecos_tables.json', data);
        console.log('Saved to ecos_tables.json');
    });
});
