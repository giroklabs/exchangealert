import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useInvestmentAnalysis } from '../hooks/useInvestmentAnalysis';
import type { FXInvestment } from '../types';
import { useSyncState } from '../hooks/useSyncState';

export function FXExchangeProfitTracker() {
    const { theme } = useTheme();
    const { currentRate: apiRate } = useInvestmentAnalysis();
    const [manualRate, setManualRate] = useState<number | null>(null);
    const currentRate = manualRate !== null ? manualRate : apiRate;

    const [isEditingRate, setIsEditingRate] = useState(false);
    const [tempRate, setTempRate] = useState<string>('');

    const [investments, setInvestments] = useSyncState<FXInvestment[]>('fx-investments', []);

    const [newInvestment, setNewInvestment] = useState<Partial<FXInvestment>>({
        date: new Date().toISOString().split('T')[0],
        usdAmount: 1000,
        buyRate: currentRate || 0,
        memo: '',
        status: 'holding'
    });
    const [isAdding, setIsAdding] = useState(false);
    const [partialSellId, setPartialSellId] = useState<string | null>(null);
    const [partialSellAmount, setPartialSellAmount] = useState<number>(0);
    const [partialSellRate, setPartialSellRate] = useState<number>(currentRate);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 50;
    const [showDailyLog, setShowDailyLog] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ field: keyof FXInvestment | 'profit'; order: 'asc' | 'desc' }>({
        field: 'date',
        order: 'desc'
    });

    const handleSort = (field: keyof FXInvestment | 'profit') => {
        setSortConfig(current => ({
            field,
            order: current.field === field && current.order === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getSortIcon = (field: string) => {
        if (sortConfig.field !== field) return '↕️';
        return sortConfig.order === 'desc' ? '⬇️' : '⬆️';
    };

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

    const handlePartialSell = (id: string, amountToSell: number, sellRate: number) => {
        const inv = investments.find(i => i.id === id);
        if (!inv || amountToSell <= 0 || amountToSell > inv.usdAmount) {
            alert('유효하지 않은 매도 금액입니다.');
            return;
        }

        const sellDate = new Date().toISOString().split('T')[0];
        const newSoldRecord: FXInvestment = {
            id: crypto.randomUUID(),
            date: inv.date,
            usdAmount: amountToSell,
            buyRate: inv.buyRate,
            sellRate,
            sellDate,
            status: 'sold',
            memo: `${inv.memo ? inv.memo + ' ' : ''}(분할매도)`
        };

        const updatedInvestments = investments.map(item => {
            if (item.id === id) {
                return {
                    ...item,
                    usdAmount: item.usdAmount - amountToSell
                };
            }
            return item;
        }).filter(item => item.usdAmount > 0);

        setInvestments([newSoldRecord, ...updatedInvestments]);
        setPartialSellId(null);
        setPartialSellAmount(0);
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
    const avgBuyRate = totalHoldingUsd > 0 ? totalHoldingKrw / totalHoldingUsd : 0;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const thisMonthStr = now.toISOString().slice(0, 7); // YYYY-MM
    const thisYearStr = now.getFullYear().toString();

    // 기간별 실현 손익
    const realizedToday = investments
        .filter(inv => inv.status === 'sold' && inv.sellDate === todayStr)
        .reduce((sum, inv) => sum + (inv.usdAmount * (inv.sellRate! - inv.buyRate)), 0);

    const realizedMonth = investments
        .filter(inv => inv.status === 'sold' && inv.sellDate?.startsWith(thisMonthStr))
        .reduce((sum, inv) => sum + (inv.usdAmount * (inv.sellRate! - inv.buyRate)), 0);

    const realizedYear = investments
        .filter(inv => inv.status === 'sold' && inv.sellDate?.startsWith(thisYearStr))
        .reduce((sum, inv) => sum + (inv.usdAmount * (inv.sellRate! - inv.buyRate)), 0);

    // 기간별 평가 손익 (미실현 - 보유중인 항목의 매수일 기준)
    const unrealizedToday = investments
        .filter(inv => inv.status === 'holding' && inv.date === todayStr)
        .reduce((sum, inv) => sum + (inv.usdAmount * (currentRate - inv.buyRate)), 0);

    const unrealizedMonth = investments
        .filter(inv => inv.status === 'holding' && inv.date?.startsWith(thisMonthStr))
        .reduce((sum, inv) => sum + (inv.usdAmount * (currentRate - inv.buyRate)), 0);

    // 기간별 거래 총액 (매수 원금 @ buyDate + 매도 원금 @ sellDate)
    const volumeToday =
        investments.filter(inv => inv.date === todayStr).reduce((sum, inv) => sum + (inv.usdAmount * inv.buyRate), 0) +
        investments.filter(inv => inv.status === 'sold' && inv.sellDate === todayStr).reduce((sum, inv) => sum + (inv.usdAmount * inv.sellRate!), 0);

    const volumeMonth =
        investments.filter(inv => inv.date?.startsWith(thisMonthStr)).reduce((sum, inv) => sum + (inv.usdAmount * inv.buyRate), 0) +
        investments.filter(inv => inv.status === 'sold' && inv.sellDate?.startsWith(thisMonthStr)).reduce((sum, inv) => sum + (inv.usdAmount * inv.sellRate!), 0);

    const volumeYear =
        investments.filter(inv => inv.date?.startsWith(thisYearStr)).reduce((sum, inv) => sum + (inv.usdAmount * inv.buyRate), 0) +
        investments.filter(inv => inv.status === 'sold' && inv.sellDate?.startsWith(thisYearStr)).reduce((sum, inv) => sum + (inv.usdAmount * inv.sellRate!), 0);

    // 일별 일지 데이터 계산
    const dailyLogs = investments
        .filter(inv => inv.status === 'sold')
        .reduce((acc: Record<string, { profit: number; count: number; volume: number }>, inv) => {
            const date = inv.sellDate || 'unknown';
            if (!acc[date]) acc[date] = { profit: 0, count: 0, volume: 0 };
            acc[date].profit += inv.usdAmount * (inv.sellRate! - inv.buyRate);
            acc[date].count += 1;
            acc[date].volume += inv.usdAmount * inv.sellRate!;
            return acc;
        }, {});

    const sortedDates = Object.keys(dailyLogs).sort((a, b) => b.localeCompare(a));

    // 정렬된 투자 내역 계산
    const sortedInvestments = [...investments].sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortConfig.field) {
            case 'profit':
                const aTargetProfit = a.status === 'holding' ? currentRate : a.sellRate!;
                const bTargetProfit = b.status === 'holding' ? currentRate : b.sellRate!;
                aValue = a.usdAmount * (aTargetProfit - a.buyRate);
                bValue = b.usdAmount * (bTargetProfit - b.buyRate);
                break;
            case 'sellRate': // 현재/매도 환율 컬럼 대응
                aValue = a.status === 'holding' ? currentRate : a.sellRate!;
                bValue = b.status === 'holding' ? currentRate : b.sellRate!;
                break;
            default:
                aValue = a[sortConfig.field as keyof FXInvestment];
                bValue = b[sortConfig.field as keyof FXInvestment];
        }

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (aValue < bValue) return sortConfig.order === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.order === 'asc' ? 1 : -1;
        return 0;
    });

    // 페이징 처리
    const totalPages = Math.ceil(sortedInvestments.length / ITEMS_PER_PAGE);
    const paginatedInvestments = sortedInvestments.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    return (
        <div className="space-y-8">
            {/* 요약 카드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>보유 중인 달러</h3>
                    <div className="space-y-1">
                        <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            ${totalHoldingUsd.toLocaleString()}
                        </p>
                        <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                            매수 원금: {Math.round(totalHoldingKrw).toLocaleString()}원
                        </p>
                        <div className="flex justify-between items-baseline border-t border-gray-100 dark:border-gray-700 pt-1 mt-1">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">평균 단가:</span>
                            <span className={`text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {avgBuyRate > 0 ? avgBuyRate.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'}원
                            </span>
                        </div>
                        <div className="text-[10px] text-right text-gray-400 invisible">
                            Spacer
                        </div>
                    </div>
                </div>
                <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>평가 손익 (일/월/년)</h3>
                    <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-500">오늘 매수분:</span>
                            <span className={`text-md font-bold ${unrealizedToday >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {unrealizedToday >= 0 ? '+' : ''}{Math.round(unrealizedToday).toLocaleString()}원
                            </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-500">이번 달:</span>
                            <span className={`text-md font-bold ${unrealizedMonth >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {unrealizedMonth >= 0 ? '+' : ''}{Math.round(unrealizedMonth).toLocaleString()}원
                            </span>
                        </div>
                        <div className="flex justify-between items-baseline border-t border-gray-100 dark:border-gray-700 pt-1 mt-1">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">총 미실현 손익:</span>
                            <span className={`text-lg font-black ${unrealizedProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {unrealizedProfit >= 0 ? '+' : ''}{Math.round(unrealizedProfit).toLocaleString()}원
                            </span>
                        </div>
                        <div className={`text-[10px] text-right ${unrealizedProfit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                            전체 수익률: {unrealizedRoi.toFixed(2)}%
                        </div>
                    </div>
                </div>
                <div
                    onClick={() => setShowDailyLog(true)}
                    className={`p-6 rounded-2xl shadow-xl cursor-pointer hover:ring-2 hover:ring-yellow-400 transition-all ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}
                >
                    <div className="flex justify-between items-start mb-2 text-sm font-medium">
                        <h3 className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>실현 손익 (일/월/년)</h3>
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-500">일지보기 🔍</span>
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-500">오늘:</span>
                            <span className={`text-md font-bold ${realizedToday >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {realizedToday >= 0 ? '+' : ''}{Math.round(realizedToday).toLocaleString()}원
                            </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-500">이번 달:</span>
                            <span className={`text-md font-bold ${realizedMonth >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {realizedMonth >= 0 ? '+' : ''}{Math.round(realizedMonth).toLocaleString()}원
                            </span>
                        </div>
                        <div className="flex justify-between items-baseline border-t border-gray-100 dark:border-gray-700 pt-1 mt-1">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">올해 합계:</span>
                            <span className={`text-lg font-black ${realizedYear >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                {realizedYear >= 0 ? '+' : ''}{Math.round(realizedYear).toLocaleString()}원
                            </span>
                        </div>
                    </div>
                </div>
                <div className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>누적 거래총액 (일/월/년)</h3>
                    <div className="space-y-1">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-500">오늘:</span>
                            <span className={`text-md font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {Math.round(volumeToday).toLocaleString()}원
                            </span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-500">이번 달:</span>
                            <span className={`text-md font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {Math.round(volumeMonth).toLocaleString()}원
                            </span>
                        </div>
                        <div className="flex justify-between items-baseline border-t border-gray-100 dark:border-gray-700 pt-1 mt-1">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">올해 누적:</span>
                            <span className={`text-lg font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                {Math.round(volumeYear).toLocaleString()}원
                            </span>
                        </div>
                        <div className="text-[10px] text-right text-gray-400">
                            매수+매도 합산 규모
                        </div>
                    </div>
                </div>
            </div>

            {/* 현재 환율 정보 바 */}
            <div className={`p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
                <div className="flex items-center gap-3">
                    <span className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                        적용 환율:
                    </span>
                    {isEditingRate ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={tempRate}
                                onChange={(e) => setTempRate(e.target.value)}
                                className="w-24 p-1 rounded-lg border border-gray-300 text-right font-bold text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                            />
                            <button onClick={() => {
                                setManualRate(Number(tempRate) || apiRate);
                                setIsEditingRate(false);
                            }} className="px-4 py-2 text-sm font-bold rounded-xl bg-yellow-400 text-gray-900 hover:bg-yellow-500 transition-colors">적용</button>
                            <button onClick={() => {
                                setManualRate(null);
                                setIsEditingRate(false);
                            }} className="px-4 py-2 text-sm font-bold rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors">실시간</button>
                        </div>
                    ) : (
                        <div
                            className="flex items-center gap-2 group cursor-pointer"
                            onClick={() => {
                                setTempRate(currentRate.toString());
                                setIsEditingRate(true);
                            }}
                            title="환율 직접 수정하기"
                        >
                            <span className="text-xl font-bold">{currentRate.toLocaleString()}원</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-200 dark:bg-blue-900 px-2 py-1 rounded">✏️ 편집</span>
                            {manualRate !== null && (
                                <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold ml-1 border border-yellow-200">수동</span>
                            )}
                        </div>
                    )}
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-yellow-400 text-gray-900 rounded-xl text-sm font-bold hover:bg-yellow-500 transition-colors shadow-md"
                >
                    {isAdding ? '취소' : '➕ 새 투자 기록'}
                </button>
            </div>

            {/* 입력 폼 */}
            {isAdding && (
                <div className={`p-6 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
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
                                    value={newInvestment.usdAmount || ''}
                                    onChange={(e) => setNewInvestment({ ...newInvestment, usdAmount: e.target.value === '' ? undefined : Number(e.target.value) })}
                                    className={`w-full p-3 pl-8 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>매수 환율 (원)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={newInvestment.buyRate || currentRate || ''}
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
                            className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-gray-500/10"
                        >
                            기록 저장하기
                        </button>
                    </div>
                </div>
            )}

            {/* 분할 매도 폼 */}
            {partialSellId && (
                <div className={`p-6 rounded-2xl shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                    <h2 className={`text-xl font-bold mb-6 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        💰 달러 분할 매도 기록
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>매도 금액 (USD)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400">$</span>
                                <input
                                    type="number"
                                    max={investments.find(i => i.id === partialSellId)?.usdAmount}
                                    value={partialSellAmount}
                                    onChange={(e) => setPartialSellAmount(Number(e.target.value))}
                                    className={`w-full p-3 pl-8 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">최대 가능 금액: ${investments.find(i => i.id === partialSellId)?.usdAmount.toLocaleString()}</p>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>매도 환율 (원)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={partialSellRate}
                                onChange={(e) => setPartialSellRate(Number(e.target.value))}
                                className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                            />
                        </div>
                        <div className="flex flex-col">
                            {/* 라벨 높이만큼 스페이서 추가 */}
                            <div className="hidden md:block h-7 mb-2"></div>
                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={() => handlePartialSell(partialSellId, partialSellAmount, partialSellRate)}
                                    className="px-5 h-9 flex items-center justify-center bg-yellow-400 text-gray-900 text-sm font-bold rounded-lg hover:bg-yellow-500 transition-all shadow-md"
                                >
                                    매도 확정
                                </button>
                                <button
                                    onClick={() => setPartialSellId(null)}
                                    className="px-4 h-9 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-bold rounded-lg hover:bg-gray-200 transition-all shadow-sm"
                                >
                                    취소
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 기록 리스트 */}
            <div className={`overflow-hidden rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className={theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}>
                            <tr>
                                <th onClick={() => handleSort('status')} className={`p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    상태 {getSortIcon('status')}
                                </th>
                                <th onClick={() => handleSort('date')} className={`p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    날짜 {getSortIcon('date')}
                                </th>
                                <th onClick={() => handleSort('usdAmount')} className={`p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    매수 금액 {getSortIcon('usdAmount')}
                                </th>
                                <th onClick={() => handleSort('buyRate')} className={`p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    매수 환율 {getSortIcon('buyRate')}
                                </th>
                                <th onClick={() => handleSort('sellRate')} className={`p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    현재/매도 환율 {getSortIcon('sellRate')}
                                </th>
                                <th onClick={() => handleSort('profit')} className={`p-4 text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                                    수익률 (수익금) {getSortIcon('profit')}
                                </th>
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
                                paginatedInvestments.map(inv => {
                                    const isHolding = inv.status === 'holding';
                                    const targetRate = isHolding ? currentRate : inv.sellRate!;
                                    const profit = inv.usdAmount * (targetRate - inv.buyRate);
                                    const roi = (targetRate / inv.buyRate - 1) * 100;

                                    return (
                                        <tr key={inv.id} className={`${theme === 'dark' ? 'hover:bg-gray-750' : 'hover:bg-gray-50'} transition-colors`}>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${isHolding
                                                    ? 'bg-gray-200 text-gray-800 dark:text-gray-200'
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
                                                        <>
                                                            <button
                                                                onClick={() => {
                                                                    const rate = prompt('매도 환율을 입력하세요:', currentRate.toString());
                                                                    if (rate && !isNaN(Number(rate))) {
                                                                        handleSettleInvestment(inv.id, Number(rate));
                                                                    }
                                                                }}
                                                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-yellow-400 text-gray-900 hover:bg-yellow-500 transition-colors"
                                                            >
                                                                전체매도
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setPartialSellId(inv.id);
                                                                    setPartialSellAmount(inv.usdAmount);
                                                                    setPartialSellRate(currentRate);
                                                                }}
                                                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 hover:bg-orange-200 transition-colors"
                                                            >
                                                                분할매도
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleRevertToHolding(inv.id)}
                                                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                                                        >
                                                            보유 전환
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDeleteInvestment(inv.id)}
                                                        className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
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

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                    <div className="p-4 flex justify-center items-center gap-4">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className={`px-3 py-1 rounded-lg border text-sm font-bold ${currentPage === 1
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                                }`}
                        >
                            이전
                        </button>
                        <div className="flex gap-2">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = 1;
                                if (totalPages <= 5) pageNum = i + 1;
                                else {
                                    if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                }

                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${currentPage === pageNum
                                            ? 'bg-yellow-400 text-gray-900 shadow-md'
                                            : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className={`px-3 py-1 rounded-lg border text-sm font-bold ${currentPage === totalPages
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600'
                                }`}
                        >
                            다음
                        </button>
                    </div>
                )}
            </div>

            {/* 일별 일지 팝업 */}
            {showDailyLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDailyLog(false)}>
                    <div
                        className={`w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={`p-6 border-b flex justify-between items-center ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
                            <h2 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>📅 일별 실현손익 일지</h2>
                            <button onClick={() => setShowDailyLog(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors font-bold">✕</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            {sortedDates.length === 0 ? (
                                <div className="text-center py-20 text-gray-500">아직 실현 기록이 없습니다.</div>
                            ) : (
                                <div className="space-y-4">
                                    {sortedDates.map(date => {
                                        const log = dailyLogs[date];
                                        return (
                                            <div key={date} className={`p-4 rounded-2xl border flex justify-between items-center ${theme === 'dark' ? 'bg-gray-750 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                                <div className="space-y-1">
                                                    <div className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{date}</div>
                                                    <div className="text-xs text-gray-500">{log.count}건의 거래 / 거래액 {Math.round(log.volume).toLocaleString()}원</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`text-lg font-black ${log.profit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                        {log.profit >= 0 ? '+' : ''}{Math.round(log.profit).toLocaleString()}원
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className={`p-6 border-t text-center text-xs text-gray-400 ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
                            매도 시점의 환율 차액을 합산한 결과입니다.
                        </div>
                    </div>
                </div>
            )}

            {/* 안내 문구 */}
            <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    💡 환차익 계산기 도움말
                </h3>
                <ul className={`space-y-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    <li>• <strong>미실현 손익</strong>: 현재 보유 중인 달러를 현재 환율로 매도했을 때의 예상 수익입니다.</li>
                    <li>• <strong>실현 손익</strong>: 이미 매도 처리를 완료하여 확정된 수익의 합계입니다.</li>
                    <li>• <strong>클라우드 동기화</strong>: 구글 로그인 시 기기 간 데이터가 자동으로 동기화됩니다.</li>
                </ul>
            </div>
        </div>
    );
}
