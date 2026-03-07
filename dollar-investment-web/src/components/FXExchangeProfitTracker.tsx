import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getCurrentRateValue } from '../services/exchangeRateService';
import { useInvestmentAnalysis } from '../hooks/useInvestmentAnalysis';
import type { FXInvestment } from '../types';

export function FXExchangeProfitTracker() {
    const { theme } = useTheme();
    const { exchangeRate } = useInvestmentAnalysis();
    const currentRate = exchangeRate ? getCurrentRateValue(exchangeRate) : 0;

    const [investments, setInvestments] = useState<FXInvestment[]>(() => {
        const saved = localStorage.getItem('fx-investments');
        return saved ? JSON.parse(saved) : [];
    });

    const [isAdding, setIsAdding] = useState(false);
    const [newInvestment, setNewInvestment] = useState<Partial<FXInvestment>>({
        date: new Date().toISOString().split('T')[0],
        usdAmount: 1000,
        buyRate: currentRate || 0,
        memo: '',
        status: 'holding'
    });

    // 현재 환율이 로드되면 기본 매수 환율 업데이트 (새 투자 추가 시에만)
    useEffect(() => {
        if (currentRate && newInvestment.buyRate === 0) {
            setNewInvestment(prev => ({ ...prev, buyRate: currentRate }));
        }
    }, [currentRate]);

    useEffect(() => {
        localStorage.setItem('fx-investments', JSON.stringify(investments));
    }, [investments]);

    const handleAddInvestment = () => {
        if (!newInvestment.date || !newInvestment.usdAmount || !newInvestment.buyRate) {
            alert('날짜, 금액, 매수 환율을 입력해주세요.');
            return;
        }

        const investment: FXInvestment = {
            id: crypto.randomUUID(),
            date: newInvestment.date!,
            usdAmount: Number(newInvestment.usdAmount),
            buyRate: Number(newInvestment.buyRate),
            sellRate: null,
            sellDate: null,
            status: 'holding',
            memo: newInvestment.memo || ''
        };

        setInvestments([investment, ...investments]);
        setIsAdding(false);
        setNewInvestment({
            date: new Date().toISOString().split('T')[0],
            usdAmount: 1000,
            buyRate: currentRate || 0,
            memo: '',
            status: 'holding'
        });
    };

    const handleDeleteInvestment = (id: string) => {
        if (window.confirm('이 기록을 삭제하시겠습니까?')) {
            setInvestments(investments.filter(inv => inv.id !== id));
        }
    };

    const handleSettleInvestment = (id: string, sellRate: number) => {
        setInvestments(investments.map(inv => {
            if (inv.id === id) {
                return {
                    ...inv,
                    status: 'sold',
                    sellRate,
                    sellDate: new Date().toISOString().split('T')[0]
                };
            }
            return inv;
        }));
    };

    const handleRevertToHolding = (id: string) => {
        setInvestments(investments.map(inv => {
            if (inv.id === id) {
                return {
                    ...inv,
                    status: 'holding',
                    sellRate: null,
                    sellDate: null
                };
            }
            return inv;
        }));
    };

    // 요약 정보 계산
    const totalHoldingUsd = investments
        .filter(inv => inv.status === 'holding')
        .reduce((sum, inv) => sum + inv.usdAmount, 0);

    const totalHoldingKrw = investments
        .filter(inv => inv.status === 'holding')
        .reduce((sum, inv) => sum + (inv.usdAmount * inv.buyRate), 0);

    const currentHoldingsValue = totalHoldingUsd * currentRate;
    const unrealizedProfit = currentHoldingsValue - totalHoldingKrw;
    const unrealizedRoi = totalHoldingKrw > 0 ? (unrealizedProfit / totalHoldingKrw) * 100 : 0;

    const realizedProfit = investments
        .filter(inv => inv.status === 'sold')
        .reduce((sum, inv) => sum + (inv.usdAmount * (inv.sellRate! - inv.buyRate)), 0);

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            {/* 타이틀 섹션 */}
            <div className="text-center mb-8">
                <h1 className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    환차익 계산기
                </h1>
                <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    구매 시점별 달러 투자 수익 현황을 관리하세요
                </p>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>보유 중인 달러</h3>
                    <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        ${totalHoldingUsd.toLocaleString()}
                    </p>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        원금: {Math.round(totalHoldingKrw).toLocaleString()}원
                    </p>
                </div>
                <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>평가 손익 (미실현)</h3>
                    <p className={`text-2xl font-bold ${unrealizedProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {unrealizedProfit >= 0 ? '+' : ''}{Math.round(unrealizedProfit).toLocaleString()}원
                    </p>
                    <p className={`text-sm mt-1 ${unrealizedProfit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {unrealizedRoi.toFixed(2)}%
                    </p>
                </div>
                <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>실현 손익 (누적)</h3>
                    <p className={`text-2xl font-bold ${realizedProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {realizedProfit >= 0 ? '+' : ''}{Math.round(realizedProfit).toLocaleString()}원
                    </p>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        기록 내 확정된 수익
                    </p>
                </div>
            </div>

            {/* 현재 환율 정보 바 */}
            <div className={`p-4 rounded-xl flex justify-between items-center ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                <span className={`font-medium ${theme === 'dark' ? 'text-blue-200' : 'text-blue-800'}`}>
                    현재 실시간 환율: <span className="text-xl font-bold">{currentRate.toLocaleString()}원</span>
                </span>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                >
                    {isAdding ? '취소' : '➕ 새 투자 기록'}
                </button>
            </div>

            {/* 입력 폼 */}
            {isAdding && (
                <div className={`p-6 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-300 ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <h2 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        📝 새로운 달러 매수 기록
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>매수 날짜</label>
                            <input
                                type="date"
                                value={newInvestment.date}
                                onChange={(e) => setNewInvestment({ ...newInvestment, date: e.target.value })}
                                className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>매수 금액 (USD)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400">$</span>
                                <input
                                    type="number"
                                    value={newInvestment.usdAmount}
                                    onChange={(e) => setNewInvestment({ ...newInvestment, usdAmount: Number(e.target.value) })}
                                    className={`w-full p-3 pl-8 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>매수 환율 (원)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={newInvestment.buyRate}
                                onChange={(e) => setNewInvestment({ ...newInvestment, buyRate: Number(e.target.value) })}
                                className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>메모</label>
                            <input
                                type="text"
                                placeholder="거래 목적 등"
                                value={newInvestment.memo}
                                onChange={(e) => setNewInvestment({ ...newInvestment, memo: e.target.value })}
                                className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={handleAddInvestment}
                            className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-500/20"
                        >
                            기록 저장하기
                        </button>
                    </div>
                </div>
            )}

            {/* 기록 리스트 */}
            <div className={`overflow-hidden rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}>
                            <tr>
                                <th className={`p-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>상태</th>
                                <th className={`p-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>날짜</th>
                                <th className={`p-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>매수 금액</th>
                                <th className={`p-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>매수 환율</th>
                                <th className={`p-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>현재/매도 환율</th>
                                <th className={`p-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>수익률 (수익금)</th>
                                <th className={`p-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>관리</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-100'}`}>
                            {investments.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-10 text-center text-gray-500">
                                        기록된 투자 내역이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                investments.map(inv => {
                                    const isHolding = inv.status === 'holding';
                                    const targetRate = isHolding ? currentRate : inv.sellRate!;
                                    const profit = inv.usdAmount * (targetRate - inv.buyRate);
                                    const roi = (targetRate / inv.buyRate - 1) * 100;

                                    return (
                                        <tr key={inv.id} className={`${theme === 'dark' ? 'hover:bg-gray-750' : 'hover:bg-gray-50'} transition-colors`}>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${isHolding
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {isHolding ? '보유 중' : '매도 완료'}
                                                </span>
                                            </td>
                                            <td className={`p-4 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {inv.date}
                                                {inv.memo && <div className="text-xs text-gray-500 mt-1">{inv.memo}</div>}
                                            </td>
                                            <td className={`p-4 font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                                ${inv.usdAmount.toLocaleString()}
                                            </td>
                                            <td className={`p-4 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                                {inv.buyRate.toLocaleString()}원
                                            </td>
                                            <td className="p-4">
                                                <div className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                                    {targetRate.toLocaleString()}원
                                                </div>
                                                {!isHolding && <div className="text-xs text-gray-500">{inv.sellDate}</div>}
                                            </td>
                                            <td className="p-4">
                                                <div className={`font-bold ${roi >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                    {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                                                </div>
                                                <div className={`text-xs ${roi >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                                    {roi >= 0 ? '+' : ''}{Math.round(profit).toLocaleString()}원
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    {isHolding ? (
                                                        <button
                                                            onClick={() => {
                                                                const rate = prompt('매도 환율을 입력하세요:', currentRate.toString());
                                                                if (rate && !isNaN(Number(rate))) {
                                                                    handleSettleInvestment(inv.id, Number(rate));
                                                                }
                                                            }}
                                                            className="px-2 py-1 bg-green-100 text-green-600 rounded text-xs hover:bg-green-200"
                                                        >
                                                            매도 처리
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleRevertToHolding(inv.id)}
                                                            className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs hover:bg-blue-200"
                                                        >
                                                            보유 전환
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteInvestment(inv.id)}
                                                        className="px-2 py-1 bg-red-100 text-red-600 rounded text-xs hover:bg-red-200"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 안내 문구 */}
            <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    💡 환차익 계산기 도움말
                </h3>
                <ul className={`space-y-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    <li>• <strong>미실현 손익</strong>: 현재 보유 중인 달러를 현재 환율로 매도했을 때의 예상 수익입니다.</li>
                    <li>• <strong>실현 손익</strong>: 이미 매도 처리를 완료하여 확정된 수익의 합계입니다.</li>
                    <li>• <strong>로컬 저장</strong>: 입력하신 데이터는 브라우저의 로컬 스토리지에만 저장되며 서버로 전송되지 않습니다.</li>
                </ul>
            </div>
        </div>
    );
}
