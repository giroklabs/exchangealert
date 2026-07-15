const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '../public/data/user-transactions.json');

/**
 * 전 내역을 기반으로 요약 정보 재계산
 */
function updateSummary(data) {
    let totalBuyUsd = 0;
    let totalBuyKrw = 0;
    let totalSellUsd = 0;
    let totalSellKrw = 0;

    data.transactions.forEach(t => {
        if (t.type === 'BUY') {
            totalBuyUsd += t.usd;
            totalBuyKrw += t.krw;
        } else if (t.type === 'SELL') {
            totalSellUsd += t.usd;
            totalSellKrw += t.krw;
        }
    });

    data.summary = {
        totalBuyUsd: parseFloat(totalBuyUsd.toFixed(2)),
        totalBuyKrw: Math.round(totalBuyKrw),
        avgBuyRate: totalBuyUsd > 0 ? parseFloat((totalBuyKrw / totalBuyUsd).toFixed(2)) : 0,
        totalSellUsd: parseFloat(totalSellUsd.toFixed(2)),
        totalSellKrw: Math.round(totalSellKrw),
        avgSellRate: totalSellUsd > 0 ? parseFloat((totalSellKrw / totalSellUsd).toFixed(2)) : 0,
        netUsdBalance: parseFloat((totalBuyUsd - totalSellUsd).toFixed(2))
    };
    data.lastUpdate = new Date().toISOString();
}

/**
 * 신규 거래 추가
 */
function addTransaction(type, usd, rate, date = new Date().toISOString().split('T')[0]) {
    if (!fs.existsSync(DATA_PATH)) {
        fs.writeFileSync(DATA_PATH, JSON.stringify({ summary: {}, transactions: [] }, null, 2));
    }

    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
    const krw = Math.round(usd * rate);

    const newTx = {
        date,
        type: type.toUpperCase(),
        usd: parseFloat(usd),
        rate: parseFloat(rate),
        krw: krw
    };

    data.transactions.unshift(newTx); // 최상단에 추가
    updateSummary(data);

    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');

    console.log(`\n✅ 성공적으로 등록되었습니다!`);
    console.log(`----------------------------------`);
    console.log(`유형: ${newTx.type} | 금액: $${newTx.usd} | 환율: ${newTx.rate}`);
    console.log(`----------------------------------`);
    console.log(`[현재 요약]`);
    console.log(`평균 매수가: ${data.summary.avgBuyRate}원 (총 $${data.summary.totalBuyUsd})`);
    console.log(`평균 매도가: ${data.summary.avgSellRate}원 (총 $${data.summary.totalSellUsd})`);
    console.log(`보유 잔액: $${data.summary.netUsdBalance}`);
    console.log(`----------------------------------\n`);
}

// CLI 실행 처리
const args = process.argv.slice(2);
if (args.length >= 3) {
    const [type, usd, rate, date] = args;
    addTransaction(type, usd, rate, date);
} else {
    // 인자 없이 실행 시 요약만 출력
    if (fs.existsSync(DATA_PATH)) {
        const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
        console.log(`📊 현재 누적 거래 요약 보고서`);
        console.log(JSON.stringify(data.summary, null, 2));
    } else {
        console.log("데이터 파일이 존재하지 않습니다.");
    }
}
