import fetch from 'node-fetch'; // Node 18 이상에서는 내장 fetch 사용 가능, 하위 호환을 위해 유지 고려 (이 프로젝트는 20 버전을 쓰는 것으로 보임)
import fs from 'fs';
import path from 'path';

// --- 통계 함수: 피어슨 상관계수(Pearson Correlation Coefficient) 계산 ---
function calculatePearsonCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    
    const sumX_sq = x.reduce((a, b) => a + b * b, 0);
    const sumY_sq = y.reduce((a, b) => a + b * b, 0);
    
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    
    const numerator = (n * sumXY) - (sumX * sumY);
    const denominator = Math.sqrt((n * sumX_sq - sumX * sumX) * (n * sumY_sq - sumY * sumY));
    
    if (denominator === 0) return 0;
    return numerator / denominator;
}

// --- Yahoo Finance 과거 데이터 조회 (최근 70영업일 확보를 위해 4개월치 로드) ---
async function fetchYahooHistory(symbol, range = '4mo') {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${range}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.chart.result) return [];
        
        const timestamps = data.chart.result[0].timestamp;
        const closes = data.chart.result[0].indicators.quote[0].close;
        
        const history = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (closes[i] !== null) {
                // YYYY-MM-DD 형식으로 변환 (시간 무시하여 날짜 매칭에 사용)
                const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
                history.push({ date, value: closes[i] });
            }
        }
        return history;
    } catch (e) {
        console.error(`❌ [${symbol}] 데이터 로드 실패:`, e.message);
        return [];
    }
}

// --- 메인 상관관계 분석 함수 ---
async function runCorrelationAnalysis() {
    console.log('🚀 대시보드 변수간 상관관계 분석 모델(70일) 구동 시작...\n');

    // 분석 대상 심볼 정의
    const targets = {
        usdkrw: { symbol: 'USDKRW=X', name: '원/달러 환율' },
        kospi: { symbol: '^KS11', name: '코스피 지수' }
    };

    const variables = {
        dxy: { symbol: 'DX-Y.NYB', name: '달러 인덱스 (DXY)' },
        tnx: { symbol: '^TNX', name: '미 10년물 국채금리' },
        vix: { symbol: '^VIX', name: 'VIX 공포지수' },
        sox: { symbol: '^SOX', name: '필라델피아 반도체지수' },
        wti: { symbol: 'CL=F', name: '국제 유가 (WTI)' }
    };

    const allData = {};

    // 1. 모든 데이터 병렬 Fetch
    console.log('📊 글로벌 금융 API 과거 데이터 수집 중 (최근 70일 매칭용)...');
    const allSymbols = [...Object.values(targets), ...Object.values(variables)];
    
    await Promise.all(allSymbols.map(async (item) => {
        allData[item.name] = await fetchYahooHistory(item.symbol);
    }));

    // 2. 정확히 70일 (최근 70개 교집합 영업일) 추출 및 날짜 정렬
    // 환율(USDKRW)을 기준으로 삼고, 다른 지표들의 날짜 교집합을 구합니다.
    const baseHistory = allData['원/달러 환율'];
    if (!baseHistory || baseHistory.length === 0) {
        console.error('환율 데이터를 가져오지 못해 분석을 종료합니다.');
        return;
    }

    // 뒤에서 70개의 타겟 일자만 슬라이싱
    let alignedDates = baseHistory.map(d => d.date);
    
    // 교집합 구축
    Object.keys(allData).forEach(name => {
        const availableDates = allData[name].map(d => d.date);
        alignedDates = alignedDates.filter(d => availableDates.includes(d));
    });

    // 최신 날짜 순으로 정렬 후 상위 70영업일(약 3.5개월)만 자름
    alignedDates.sort((a, b) => b.localeCompare(a));
    alignedDates = alignedDates.slice(0, 70).reverse(); // 계산을 위해 마지막엔 과거 -> 최신순으로 정렬

    console.log(`\n✅ 교집합 영업일 매칭 완료: 총 ${alignedDates.length}일 (기간: ${alignedDates[0]} ~ ${alignedDates[alignedDates.length - 1]})`);

    if (alignedDates.length < 30) {
        console.warn('⚠️ 정합성 있는 데이터 결측치가 많아 신뢰도가 낮습니다.');
    }

    // 3. 교집합 날짜를 기준으로 어레이 변환
    const alignedValues = {};
    Object.keys(allData).forEach(name => {
        const historyDict = {};
        allData[name].forEach(item => { historyDict[item.date] = item.value; });
        
        alignedValues[name] = alignedDates.map(date => historyDict[date]);
    });

    // 4. 상관관계 계산 및 출력
    console.log('\n======================================================');
    console.log('📈 [1] 원/달러 환율 (USD/KRW) 기준 상관관계 분석 결과');
    console.log('======================================================');
    console.log('※ 피어슨 상관계수 (1.0: 완벽한 정비례, -1.0: 완벽한 반비례, 0: 관계없음)');
    
    const usdkrwArr = alignedValues['원/달러 환율'];
    const kospiArr = alignedValues['코스피 지수'];

    Object.keys(variables).forEach(key => {
        const varName = variables[key].name;
        const varArr = alignedValues[varName];
        const corr = calculatePearsonCorrelation(usdkrwArr, varArr);
        
        let strength = "";
        if (Math.abs(corr) > 0.7) strength = corr > 0 ? "🔥 강한 양(+)의 상관관계" : "📉 강한 음(-)의 상관관계";
        else if (Math.abs(corr) > 0.4) strength = corr > 0 ? "📈 뚜렷한 양(+)의 상관관계" : "📉 뚜렷한 음(-)의 상관관계";
        else strength = "☁️ 약한 상관관계 (영향 미미)";

        console.log(`- vs ${varName.padEnd(16, ' ')} : ${(corr).toFixed(4).padStart(8, ' ')}  (${strength})`);
    });

    console.log('\n======================================================');
    console.log('📊 [2] 코스피 지수 (KOSPI) 기준 상관관계 분석 결과');
    console.log('======================================================');
    
    Object.keys(variables).forEach(key => {
        const varName = variables[key].name;
        const varArr = alignedValues[varName];
        const corr = calculatePearsonCorrelation(kospiArr, varArr);
        
        let strength = "";
        if (Math.abs(corr) > 0.7) strength = corr > 0 ? "🔥 강한 양(+)의 상관관계" : "📉 강한 음(-)의 상관관계";
        else if (Math.abs(corr) > 0.4) strength = corr > 0 ? "📈 뚜렷한 양(+)의 상관관계" : "📉 뚜렷한 음(-)의 상관관계";
        else strength = "☁️ 약한 상관관계 (영향 미미)";

        console.log(`- vs ${varName.padEnd(16, ' ')} : ${(corr).toFixed(4).padStart(8, ' ')}  (${strength})`);
    });

    const exchKospiCorr = calculatePearsonCorrelation(usdkrwArr, kospiArr);
    console.log('\n======================================================');
    console.log(`🔗 [번외] 환율과 코스피의 상관계수: ${(exchKospiCorr).toFixed(4)}`);
    console.log('======================================================\n');
    console.log('💡 분석 결과 해석 팁:');
    console.log('1. 환율과 높은 양(+)의 상관관계를 가진 변수는 "환율 상승의 선행/동행 지표"로 활용 가능합니다.');
    console.log('2. 이 상관계수를 기반으로 기존 대시보드 예측 모델의 가중치 배분(Score ±)을 최적화할 수 있습니다.');
    console.log('3. 코스피와 반비례(-) 관계가 심한 지표는 리스크 오프(Risk-Off) 지표로 편입을 고려하세요.');

    // 5. JSON 파일로 저장 (Dynamic Scoring 모델 연동용)
    const correlationData = {
        updatedAt: new Date().toISOString(),
        periodDays: 70,
        dateRange: { start: alignedDates[0], end: alignedDates[alignedDates.length - 1] },
        usdkrw: {},
        kospi: {}
    };

    Object.keys(variables).forEach(key => {
        const varName = variables[key].name;
        correlationData.usdkrw[key] = parseFloat(calculatePearsonCorrelation(usdkrwArr, alignedValues[varName]).toFixed(4));
        correlationData.kospi[key] = parseFloat(calculatePearsonCorrelation(kospiArr, alignedValues[varName]).toFixed(4));
    });
    
    correlationData.usdkrw.kospi = parseFloat(exchKospiCorr.toFixed(4));
    correlationData.kospi.usdkrw = parseFloat(exchKospiCorr.toFixed(4));

    const outputPath = path.join(process.cwd(), 'public', 'data', 'correlations.json');
    try {
        fs.writeFileSync(outputPath, JSON.stringify(correlationData, null, 2));
        console.log(`\n✅ 상관계수 데이터 JSON 생성 완료: ${outputPath}`);
    } catch (err) {
        console.error(`❌ JSON 파일 저장 실패:`, err.message);
    }
}

runCorrelationAnalysis();
