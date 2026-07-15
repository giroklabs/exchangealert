/**
 * KIS 선물 데이터 수집 서비스 유틸리티
 */

import https from 'https';

const KIS_BASE_URL = "https://openapi.koreainvestment.com:443";

/**
 * 국내선물옵션 현재가/시세 통합 수집 함수
 * @param {string} iscd 종목코드 (10100: 정규, 101N3: 야간)
 * @param {string} token KIS Access Token
 * @param {Object} keys { appKey, appSecret }
 * @returns {Promise<Object>} 선물 시세 객체 (Output 기준)
 */
export async function fetchFuturesPrice(iscd, token, { appKey, appSecret }) {
    return new Promise((resolve, reject) => {
        // TR: 국내선물옵션 현재가 조회
        // 시장 구분 코드: 실전투자 선물은 J(KOSPI)를 통해 조회가 활발함
        const mkDivCode = 'J'; 
        const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=${mkDivCode}&fid_input_iscd=${iscd}`;
        
        const options = {
            headers: {
                "content-type": "application/json; charset=utf-8",
                "authorization": `Bearer ${token}`,
                "appkey": appKey,
                "appsecret": appSecret,
                "tr_id": "FHKST01010100", // 국내선물 현재가 전용 TR
                "custtype": "P",
                "User-Agent": "Mozilla/5.0"
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.output) {
                        resolve(json.output);
                    } else {
                        reject(new Error(`[KIS] [${iscd}] 데이터 획득 실패: ${json.msg1}`));
                    }
                } catch (e) {
                    reject(new Error(`[KIS] [${iscd}] JSON 파싱 에러: ${e.message}`));
                }
            });
        }).on('error', (e) => reject(new Error(`[KIS] [${iscd}] 네트워크 에러: ${e.message}`)));
    });
}

/**
 * 특정 일자의 일봉 데이터 조회 (Historical 테스트용)
 * @param {string} iscd 
 * @param {string} date YYYYMMDD
 * @param {string} token 
 * @param {Object} keys
 */
export async function fetchFuturesDailyChart(iscd, date, token, { appKey, appSecret }) {
    // tr_id: FHKST01010200 (국내선물옵션 일자별 시세)
    // 수집 로직은 inquire-price와 유사하되, 차트 데이터 배열 리턴 필요
    return new Promise((resolve, reject) => {
        const mkDivCode = 'J';
        const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-indexchartprice?fid_cond_mrkt_div_code=U&fid_input_iscd=0001&fid_input_date_1=${date}&fid_input_date_2=${date}&fid_period_div_code=D`;
        
        const options = {
            headers: {
                "content-type": "application/json; charset=utf-8",
                "authorization": `Bearer ${token}`,
                "appkey": appKey,
                "appsecret": appSecret,
                "tr_id": "FHKST01010200", 
                "custtype": "P",
                "User-Agent": "Mozilla/5.0"
            }
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (!data || data.trim() === '') {
                    reject(new Error(`[KIS] [${iscd}] 응답 본문이 비어 있습니다. (Status: ${res.statusCode})`));
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    if (json.output && json.output.length > 0) {
                        resolve(json.output[0]); // 선택 일자 데이터 반환
                    } else {
                        reject(new Error(`[KIS] [${iscd}] 히스토리 데이터 획득 실패: ${json.msg1 || '데이터 없음'}`));
                    }
                } catch (e) {
                    reject(new Error(`[KIS] [${iscd}] JSON 파싱 에러: ${e.message} (Raw: ${data.substring(0, 100)}...)`));
                }
            });
        }).on('error', (e) => reject(new Error(`[KIS] [${iscd}] 네트워크 에러: ${e.message}`)));
    });
}
