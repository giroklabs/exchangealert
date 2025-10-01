#!/usr/bin/env node

/**
 * ExchangeRate-API 데이터 수집 스크립트
 * 2분마다 ExchangeRate-API에서 실시간 환율 데이터를 가져와서 처리
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 설정
const EXCHANGERATE_API_URL = 'https://api.exchangerate-api.com/v4/latest/KRW';
const DATA_DIR = path.join(__dirname, '../data');
const OUTPUT_FILE = path.join(DATA_DIR, 'exchangerate-api.json');
const TIMESTAMP_FILE = path.join(DATA_DIR, 'exchangerate-api-last-update.txt');

// 백업 디렉토리 생성
const BACKUP_DIR = path.join(DATA_DIR, 'backup');
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * HTTP 요청 함수
 */
function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve(jsonData);
                } catch (error) {
                    reject(new Error(`JSON 파싱 오류: ${error.message}`));
                }
            });
        }).on('error', (error) => {
            reject(new Error(`HTTP 요청 오류: ${error.message}`));
        });
    });
}

/**
 * KRW 기준 환율을 각 통화 기준으로 변환
 */
function convertToCurrencyRates(rates) {
    const convertedRates = {};
    
    for (const [currency, krwRate] of Object.entries(rates)) {
        if (currency === 'KRW') {
            convertedRates[currency] = 1;
        } else {
            // KRW 기준 환율을 각 통화 기준으로 변환 (1/rate)
            convertedRates[currency] = 1 / krwRate;
        }
    }
    
    return convertedRates;
}

/**
 * 주요 통화 정보 추출
 */
function extractMajorCurrencies(data) {
    const majorCurrencies = ['USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AUD', 'CAD', 'CHF', 'HKD', 'THB', 'SGD'];
    const majorRates = {};
    
    for (const currency of majorCurrencies) {
        if (data.rates[currency]) {
            majorRates[currency] = {
                krwRate: data.rates[currency],
                currencyRate: 1 / data.rates[currency]
            };
        }
    }
    
    return majorRates;
}

/**
 * 데이터 저장
 */
function saveData(data) {
    const timestamp = new Date().toISOString();
    
    // 메인 데이터 저장
    const outputData = {
        ...data,
        convertedRates: convertToCurrencyRates(data.rates),
        majorCurrencies: extractMajorCurrencies(data),
        fetchedAt: timestamp
    };
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));
    fs.writeFileSync(TIMESTAMP_FILE, timestamp);
    
    // 백업 생성
    const backupTimestamp = timestamp.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '');
    const backupFile = path.join(BACKUP_DIR, `exchangerate-api-backup-${backupTimestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(outputData, null, 2));
    
    console.log(`✅ 데이터 저장 완료: ${OUTPUT_FILE}`);
    console.log(`📁 백업 생성: ${backupFile}`);
    
    return outputData;
}

/**
 * 로그 출력
 */
function logResults(data) {
    console.log('🌐 ExchangeRate-API 데이터 수집 완료');
    console.log(`📅 수집 시간: ${data.fetchedAt}`);
    console.log(`📊 총 통화 수: ${Object.keys(data.rates).length}개`);
    
    console.log('\n💱 주요 통화 환율 (1 KRW = X 통화):');
    Object.entries(data.majorCurrencies).forEach(([currency, rate]) => {
        console.log(`${currency}: ${rate.krwRate.toFixed(6)} (1 ${currency} = ${rate.currencyRate.toFixed(2)}원)`);
    });
}

/**
 * 메인 실행 함수
 */
async function main() {
    try {
        console.log('🚀 ExchangeRate-API 데이터 수집 시작...');
        
        // 데이터 수집
        const data = await fetchData(EXCHANGERATE_API_URL);
        
        // 데이터 저장
        const savedData = saveData(data);
        
        // 결과 출력
        logResults(savedData);
        
        console.log('✅ 작업 완료!');
        
    } catch (error) {
        console.error('❌ 오류 발생:', error.message);
        process.exit(1);
    }
}

// 스크립트 직접 실행 시
if (require.main === module) {
    main();
}

module.exports = {
    fetchData,
    convertToCurrencyRates,
    extractMajorCurrencies,
    saveData
};
