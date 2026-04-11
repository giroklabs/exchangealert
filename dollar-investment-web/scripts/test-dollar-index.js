/**
 * 달러 지수 API 테스트 스크립트
 * 로컬에서 Alpha Vantage API를 테스트할 수 있습니다
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const API_URL = `https://www.alphavantage.co/query?function=DX&interval=daily&apikey=${API_KEY}`;

console.log('📊 Alpha Vantage API에서 달러 지수(DX) 데이터 가져오기...');
console.log('API URL:', API_URL.replace(API_KEY, '***'));

https.get(API_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);

      // 오류 체크
      if (response['Error Message']) {
        console.error('❌ API 오류:', response['Error Message']);
        process.exit(1);
      }

      if (response['Note']) {
        console.error('❌ API 제한:', response['Note']);
        process.exit(1);
      }

      if (!response['Time Series (Daily)']) {
        console.error('❌ API 응답에 데이터가 없습니다.');
        console.log('응답:', JSON.stringify(response, null, 2));
        process.exit(1);
      }

      const timeSeries = response['Time Series (Daily)'];
      const dates = Object.keys(timeSeries).sort().reverse(); // 최신순
      const values = dates.map(date => parseFloat(timeSeries[date]['4. close']));

      // 최근 52주 데이터
      const recent52Weeks = values.slice(0, 52);
      const sorted = [...recent52Weeks].sort((a, b) => a - b);

      const dollarIndexData = {
        date: new Date().toISOString().split('T')[0],
        current: values[0],
        history: dates.slice(0, 52).map((date, i) => ({
          date: date,
          value: values[i]
        })),
        "52week": {
          low: sorted[0],
          high: sorted[sorted.length - 1],
          average: recent52Weeks.reduce((a, b) => a + b, 0) / recent52Weeks.length
        }
      };

      const outputPath = path.join(__dirname, '..', 'public', 'data', 'dollar-index.json');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify(dollarIndexData, null, 2));

      console.log('✅ 달러 지수 데이터 저장 완료!');
      console.log('📊 현재 달러 지수:', dollarIndexData.current);
      console.log('📈 52주 최저:', dollarIndexData['52week'].low);
      console.log('📈 52주 최고:', dollarIndexData['52week'].high);
      console.log('📈 52주 평균:', dollarIndexData['52week'].average.toFixed(2));
      console.log('📁 저장 위치:', outputPath);
    } catch (error) {
      console.error('❌ 데이터 파싱 오류:', error.message);
      console.log('응답 데이터:', data.substring(0, 500));
      process.exit(1);
    }
  });
}).on('error', (error) => {
  console.error('❌ 네트워크 오류:', error.message);
  process.exit(1);
});

