/**
 * FRED API 테스트 스크립트
 * 로컬에서 FRED API를 테스트할 수 있습니다
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRED_API_KEY = process.env.FRED_API_KEY;
// Trade Weighted U.S. Dollar Index: Broad, Goods (DTWEXBGS)
const API_URL = `https://api.stlouisfed.org/fred/series/observations?series_id=DTWEXBGS&api_key=${FRED_API_KEY}&file_type=json&limit=365&sort_order=desc`;

console.log('📊 FRED API에서 달러 지수(DTWEXBGS) 데이터 가져오기...');
console.log('API URL:', API_URL.replace(FRED_API_KEY, '***'));

https.get(API_URL, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);

      if (response.error_code) {
        console.error('❌ API 오류:', response.error_message);
        process.exit(1);
      }

      if (!response.observations || response.observations.length === 0) {
        console.error('❌ API 응답에 데이터가 없습니다.');
        console.log('응답:', JSON.stringify(response, null, 2));
        process.exit(1);
      }

      const observations = response.observations
        .filter(obs => obs.value !== '.')
        .map(obs => ({
          date: obs.date,
          value: parseFloat(obs.value)
        }))
        .reverse(); // 오래된 순으로 정렬

      const values = observations.map(obs => obs.value);
      const sorted = [...values].sort((a, b) => a - b);

      const dollarIndexData = {
        date: new Date().toISOString().split('T')[0],
        current: values[values.length - 1],
        history: observations,
        "52week": {
          low: sorted[0],
          high: sorted[sorted.length - 1],
          average: values.reduce((a, b) => a + b, 0) / values.length
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
      console.log('📅 데이터 개수:', observations.length);
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

