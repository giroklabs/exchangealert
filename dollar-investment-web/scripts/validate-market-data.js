import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_PATH = path.join(__dirname, '../public/data/market-dashboard.json');

/**
 * 데이터 정합성 및 무결성 검증기 (Data Integrity Validator)
 */
async function validateMarketData() {
    console.log('🔍 [Validator] 데이터 무결성 검증 시작...');
    
    if (!fs.existsSync(DATA_PATH)) {
        console.error('❌ [Validator] 데이터 파일이 존재하지 않습니다.');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const indicators = data.indicators;
    const errors = [];
    const warnings = [];

    // 1. 기본적인 정보 확인
    console.log(`📊 분석 대상 지표: ${indicators.length}개`);

    // 2. 지표별 정밀 검증
    for (const item of indicators) {
        if (!item.history || item.history.length === 0) {
            warnings.push(`[${item.id}] 히스토리 데이터가 텅 비어 있습니다.`);
            continue;
        }

        const latest = item.history[0];
        const prev = item.history[1];
        const oldest = item.history[item.history.length - 1];

        // 2.1. 데이터 정체(Stale) 감지 (일간 지표 기준)
        // 국채금리나 주요 지표가 5거래일 연속 완벽히 일치하면 수집 오류 의심
        if (item.history.length >= 5) {
            const values = item.history.slice(0, 5).map(h => h.value);
            const allSame = values.every(v => v === values[0]);
            if (allSame && !['bok-rate', 'fed-rate'].includes(item.id)) {
                warnings.push(`[${item.id}] 데이터 정체 의심 (최근 5개 데이터가 모두 ${values[0]}로 동일함)`);
            }
        }

        // 2.2. 이상치(Outlier) 감지
        if (prev) {
            const changeRate = Math.abs((latest.value - prev.value) / prev.value);
            // 일반적인 지표가 하루 만에 30% 이상 변동하면 이상치로 간주 (VIX 등 변동성 지표 제외)
            if (changeRate > 0.3 && !['vix', 'foreigner-net-buy'].includes(item.id)) {
                warnings.push(`[${item.id}] 비정상적 변동 감지 (직전 대비 ${ (changeRate * 100).toFixed(1) }% 변화)`);
            }
        }
    }

    // 3. 복합 지표(Spread) 및 주석 정합성 검증
    const gs1 = indicators.find(i => i.id === 'gs1');
    const effr = indicators.find(i => i.id === 'effr');
    const rateCut = indicators.find(i => i.id === 'rate-cut-expectation');

    if (gs1 && effr && rateCut) {
        // 현재값 검산: GS1 - EFFR
        const expected = parseFloat((parseFloat(gs1.value) - parseFloat(effr.value)).toFixed(3));
        const actual = parseFloat(rateCut.value);
        if (Math.abs(expected - actual) > 0.001) {
            errors.push(`[rate-cut-expectation] 계산 불일치 (기대값: ${expected}, 실제값: ${actual})`);
        }

        // 히스토리 날짜 일치 여부 확인 (최근 3개 샘플링)
        for (let i = 0; i < Math.min(3, rateCut.history.length); i++) {
            const h = rateCut.history[i];
            const gh = [...gs1.history].reverse().find(g => g.date <= h.date) || gs1.history[0];
            const eh = [...effr.history].reverse().find(e => e.date <= h.date) || effr.history[0];
            const calc = parseFloat((gh.value - eh.value).toFixed(3));
            if (Math.abs(calc - h.value) > 0.01) {
                errors.push(`[rate-cut-expectation] 히스토리 매칭 오류 (${h.date} 시점)`);
            }
        }
    }

    // 4. 결과 보고
    console.log('\n--- [Validator] 검증 결과 리포트 ---');
    if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ 모든 데이터가 정상입니다.');
    } else {
        if (errors.length > 0) {
            console.log('❌ CRITICAL ERRORS:');
            errors.forEach(e => console.log(`   - ${e}`));
        }
        if (warnings.length > 0) {
            console.log('⚠️ WARNINGS:');
            warnings.forEach(w => console.log(`   - ${w}`));
        }
    }
    console.log('------------------------------------');

    // 에러 발생 시 외부 도구가 감지할 수 있도록 종료 코드 반환 (CI용)
    if (errors.length > 0) {
        process.exit(1);
    }
}

validateMarketData().catch(err => {
    console.error('💥 검증기 실행 중 치명적 오류:', err);
    process.exit(1);
});
