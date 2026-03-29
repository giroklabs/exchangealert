import { useTheme } from '../contexts/ThemeContext';
import type { AssetInvestment, AssetSplitSettings } from '../types';
import { useSyncState } from '../hooks/useSyncState';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { BarChart3, ShoppingCart, RotateCcw, Trash2, Edit2, Plus, Activity } from 'lucide-react';

import { fetchMarketDashboardData } from '../services/marketDashboardService';
import { fetchFXIntradayData } from '../services/fxHistoryService';
import type { TrackedStock } from '../types';

// 단일 종목 관리자 컴포넌트
function SingleAssetManager({
    investment,
    stockPrices,
    onUpdate,
    onDelete
}: {
    investment: AssetInvestment,
    stockPrices: TrackedStock[],
    onUpdate: (updated: AssetInvestment) => void,
    onDelete: () => void
}) {
    const { theme } = useTheme();
    const [currentPrice, setCurrentPrice] = useState<number>(investment.lastPrice || 0);

    // 슬롯 수정 상태
    const [editingSlotNumber, setEditingSlotNumber] = useState<number | null>(null);
    const [editBuyPrice, setEditBuyPrice] = useState<number>(0);
    const [editQuantity, setEditQuantity] = useState<number>(0);
    const [editTargetPrice, setEditTargetPrice] = useState<number>(0);

    // 주가 자동 검색 및 업데이트 로직
    const searchAndApplyPrice = (name: string) => {
        if (!name) return;

        const searchName = name.trim().toLowerCase().replace(/\s/g, '');
        const found = stockPrices.find(s =>
            s.name.toLowerCase().replace(/\s/g, '') === searchName ||
            s.enName.toLowerCase().replace(/\s/g, '') === searchName ||
            s.symbol.toLowerCase().replace(/\s/g, '').includes(searchName) ||
            s.id.toLowerCase().replace(/\s/g, '') === searchName
        );

        if (found) {
            setCurrentPrice(found.price);
            handleUpdate({ lastPrice: found.price });
        }
    };

    // 로컬 현재가 동기화
    useEffect(() => {
        if (investment.lastPrice && investment.lastPrice !== currentPrice) {
            setCurrentPrice(investment.lastPrice);
        }
    }, [investment.lastPrice]);

    // 초기 로딩 시 가격 검색 (가격이 아직 없는 경우)
    useEffect(() => {
        if (investment.settings.assetName && currentPrice === 0) {
            searchAndApplyPrice(investment.settings.assetName);
        }
    }, [stockPrices]);

    // 내부 상태 변경 시 상위로 전파
    const handleUpdate = (updates: Partial<AssetInvestment>) => {
        onUpdate({ ...investment, ...updates });
    };

    const handleSettingUpdate = (key: keyof AssetSplitSettings, value: string | number) => {
        const updatedSettings = { ...investment.settings, [key]: value };

        // 종목명 변경 시 주가 검색 자동 시도
        if (key === 'assetName') {
            searchAndApplyPrice(String(value));
        }

        // 분할 횟수가 변경될 때 슬롯 배열 조정
        if (key === 'splitCount') {
            const newCount = Number(value);
            let newSlots = [...investment.slots];

            if (newSlots.length < newCount) {
                // 슬롯 추가
                const toAdd = newCount - newSlots.length;
                const startNum = newSlots.length + 1;
                const addedSlots = Array.from({ length: toAdd }, (_, i) => ({
                    number: startNum + i,
                    isActive: false,
                    buyPrice: null,
                    quantity: 0,
                    investedAmount: 0,
                    targetPrice: null
                }));
                newSlots = [...newSlots, ...addedSlots];
            } else if (newSlots.length > newCount) {
                // 슬롯 축소 (활성화된 슬롯이 있는지 확인)
                const activeBeyondLimit = newSlots.slice(newCount).some(s => s.isActive);
                if (activeBeyondLimit) {
                    if (!window.confirm('축소하려는 슬롯 범위에 이미 매수된 내역이 있습니다. 정말로 축소하시겠습니까? (삭제됨)')) {
                        return;
                    }
                }
                newSlots = newSlots.slice(0, newCount);
            }
            handleUpdate({ settings: updatedSettings, slots: newSlots });
        } else {
            handleUpdate({ settings: updatedSettings });
        }
    };

    const handleBuy = (slotNumber: number) => {
        if (currentPrice <= 0) {
            alert('현재가를 먼저 입력해주세요.');
            return;
        }

        const slotIndex = slotNumber - 1;
        const buyPrice = currentPrice;
        const budgetPerSlot = investment.settings.totalBudget / investment.settings.splitCount;
        const quantity = budgetPerSlot / buyPrice;

        const newSlots = [...investment.slots];
        newSlots[slotIndex] = {
            ...newSlots[slotIndex],
            isActive: true,
            buyPrice: buyPrice,
            quantity: quantity,
            investedAmount: budgetPerSlot,
            buyDate: new Date().toISOString().split('T')[0],
            targetPrice: buyPrice * (1 + investment.settings.targetProfitPercent / 100)
        };
        handleUpdate({ slots: newSlots, lastPrice: currentPrice });
    };

    const handleSell = (slotNumber: number) => {
        const slotIndex = slotNumber - 1;
        const newSlots = [...investment.slots];
        newSlots[slotIndex] = {
            ...newSlots[slotIndex],
            isActive: false,
            buyPrice: null,
            quantity: 0,
            investedAmount: 0,
            buyDate: undefined,
            targetPrice: null
        };
        handleUpdate({ slots: newSlots, lastPrice: currentPrice });
    };

    const handleEditStart = (slot: any) => {
        setEditBuyPrice(slot.buyPrice || 0);
        setEditQuantity(slot.quantity || 0);
        setEditTargetPrice(slot.targetPrice || 0);
        setEditingSlotNumber(slot.number);
    };

    const handleEditSave = (slotNumber: number) => {
        const slotIndex = slotNumber - 1;
        const newSlots = [...investment.slots];
        newSlots[slotIndex] = {
            ...newSlots[slotIndex],
            buyPrice: editBuyPrice,
            quantity: editQuantity,
            investedAmount: editBuyPrice * editQuantity,
            targetPrice: editTargetPrice
        };
        handleUpdate({ slots: newSlots });
        setEditingSlotNumber(null);
    };

    const handleReset = () => {
        if (window.confirm('이 종목의 모든 슬롯 데이터를 초기화하시겠습니까?')) {
            const resetSlots = Array.from({ length: investment.settings.splitCount }, (_, i) => ({
                number: i + 1,
                isActive: false,
                buyPrice: null,
                quantity: 0,
                investedAmount: 0,
                targetPrice: null,
                buyDate: undefined
            }));
            handleUpdate({ slots: resetSlots });
        }
    };

    // 통계 계산
    const activeSlots = investment.slots.filter(s => s.isActive);
    const totalInvested = activeSlots.reduce((sum, s) => sum + (s.buyPrice! * s.quantity), 0);
    const totalValue = activeSlots.reduce((sum, s) => sum + (currentPrice * s.quantity), 0);
    const totalProfit = totalValue - totalInvested;
    const totalRoi = totalInvested > 0 ? (totalValue / totalInvested - 1) * 100 : 0;

    return (
        <div className={`p-6 rounded-2xl space-y-8 border shadow-xl ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
            {/* 헤더: 종목명 및 기본 정보 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 border-dashed border-gray-200">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}>
                        <BarChart3 className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                        <input
                            type="text"
                            value={investment.settings.assetName}
                            onChange={(e) => handleSettingUpdate('assetName', e.target.value)}
                            className={`text-2xl font-black bg-transparent border-b-2 border-transparent hover:border-yellow-300 focus:border-yellow-500 focus:outline-none ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}
                        />
                        <div className={`text-sm mt-1 font-medium ${totalRoi >= 0 ? 'text-red-500 font-bold' : 'text-blue-500 font-bold'}`}>
                            전체 수익률: {totalRoi >= 0 ? '+' : ''}{totalRoi.toFixed(2)}% ({Math.round(totalProfit).toLocaleString()}원)
                        </div>
                        <div className={`text-[11px] mt-0.5 font-bold space-x-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            <span>매수총액: {Math.round(totalInvested).toLocaleString()}원</span>
                            <span>•</span>
                            <span>평단가: {Math.round(totalInvested / activeSlots.reduce((sum, s) => sum + s.quantity, 0) || 0).toLocaleString()}원</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>리셋</span>
                    </button>
                    <button
                        onClick={onDelete}
                        className="px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        <span>종목 삭제</span>
                    </button>
                </div>
            </div>

            {/* 설정 및 현재가 입력 섹션 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">총 예산</label>
                        <input
                            type="number"
                            value={investment.settings.totalBudget}
                            onChange={(e) => handleSettingUpdate('totalBudget', Number(e.target.value))}
                            className={`w-full p-2.5 text-sm font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-sm'}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">간격 (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={investment.settings.gapPercent}
                            onChange={(e) => handleSettingUpdate('gapPercent', Number(e.target.value))}
                            className={`w-full p-2.5 text-sm font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-sm'}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">목표 (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={investment.settings.targetProfitPercent}
                            onChange={(e) => handleSettingUpdate('targetProfitPercent', Number(e.target.value))}
                            className={`w-full p-2.5 text-sm font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-sm'}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">기준가(슬롯1)</label>
                        <input
                            type="number"
                            value={investment.settings.basePrice}
                            onChange={(e) => handleSettingUpdate('basePrice', Number(e.target.value))}
                            className={`w-full p-2.5 text-sm font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-sm'}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">분할 횟수</label>
                        <select
                            value={investment.settings.splitCount || 7}
                            onChange={(e) => handleSettingUpdate('splitCount', Number(e.target.value))}
                            className={`w-full p-2.5 text-sm font-bold rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all appearance-none ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-sm'}`}
                            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                        >
                            <option value={5}>5분할</option>
                            <option value={6}>6분할</option>
                            <option value={7}>7분할</option>
                            <option value={8}>8분할</option>
                            <option value={9}>9분할</option>
                            <option value={10}>10분할</option>
                        </select>
                    </div>
                </div>
                <div className={`lg:col-span-4 p-4 rounded-2xl flex flex-col justify-center items-center gap-3 border-2 ${theme === 'dark' ? 'bg-yellow-900/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-100 shadow-inner'}`}>
                    <label className="text-xs font-black text-yellow-600 uppercase tracking-wider">현재 {investment.settings.assetName} 가격</label>
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            value={currentPrice || ''}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setCurrentPrice(val);
                                handleUpdate({ lastPrice: val });
                            }}
                            className={`w-40 p-2 text-xl font-black rounded-lg border focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all text-center ${theme === 'dark' ? 'bg-gray-800 border-yellow-500/50 text-white shadow-sm' : 'bg-yellow-100 border-yellow-300 text-yellow-900 shadow-sm'}`}
                            placeholder="0"
                        />
                        <span className="font-bold text-yellow-600">원</span>
                    </div>
                </div>
            </div>

            {/* 슬롯 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {investment.slots.map((slot, index) => {
                    const isSlot1 = slot.number === 1;
                    const prevSlot = index > 0 ? investment.slots[index - 1] : null;

                    let recommendedBuyPrice = 0;
                    if (isSlot1) {
                        recommendedBuyPrice = investment.settings.basePrice;
                    } else if (prevSlot && prevSlot.buyPrice) {
                        recommendedBuyPrice = prevSlot.buyPrice * (1 - investment.settings.gapPercent / 100);
                    }

                    const isRecommendBuy = currentPrice > 0 && !slot.isActive && (isSlot1 || (prevSlot && prevSlot.isActive && currentPrice <= recommendedBuyPrice));
                    const canBuy = currentPrice > 0 && !slot.isActive;
                    const canSell = slot.isActive && currentPrice >= (slot.targetPrice || 0);
                    const slotRoi = slot.isActive ? ((currentPrice / slot.buyPrice!) - 1) * 100 : 0;
                    const profit = slot.isActive ? (currentPrice - slot.buyPrice!) * slot.quantity : 0;

                    return (
                        <div
                            key={slot.number}
                            className={`relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-md hover:shadow-xl ${slot.isActive
                                ? 'border-gray-800 dark:border-gray-200'
                                : 'border-gray-100 dark:border-gray-700'
                                } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                        >
                            {/* 슬롯 헤더 */}
                            <div className={`p-4 flex justify-between items-center ${slot.isActive
                                ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900'
                                : (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')
                                }`}>
                                <span className="font-bold">Slot {slot.number} {isSlot1 && '(Base)'}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${slot.isActive ? 'bg-white/20' : (theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200')
                                    }`}>
                                    {slot.isActive ? '운영 중' : '비어 있음'}
                                </span>
                            </div>

                            {/* 슬롯 바디 */}
                            <div className="p-5 space-y-4">
                                {slot.isActive ? (
                                    editingSlotNumber === slot.number ? (
                                        <div className="space-y-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400">매수가</label>
                                                <input
                                                    type="number"
                                                    value={editBuyPrice}
                                                    onChange={(e) => setEditBuyPrice(Number(e.target.value))}
                                                    className={`w-full p-1 text-xs border rounded ${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400">수량</label>
                                                <input
                                                    type="number"
                                                    value={editQuantity}
                                                    onChange={(e) => setEditQuantity(Number(e.target.value))}
                                                    className={`w-full p-1 text-xs border rounded ${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400">목표가</label>
                                                <input
                                                    type="number"
                                                    value={editTargetPrice}
                                                    onChange={(e) => setEditTargetPrice(Number(e.target.value))}
                                                    className={`w-full p-1 text-xs border rounded ${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEditSave(slot.number)}
                                                    className="flex-1 py-1 text-xs font-bold bg-green-500 text-white rounded"
                                                >
                                                    저장
                                                </button>
                                                <button
                                                    onClick={() => setEditingSlotNumber(null)}
                                                    className="flex-1 py-1 text-xs font-bold bg-gray-400 text-white rounded"
                                                >
                                                    취소
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">매수가</span>
                                                <span className="font-bold">{slot.buyPrice?.toLocaleString()}원</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">목표가</span>
                                                <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{slot.targetPrice?.toLocaleString()}원</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-gray-500">매수일자</span>
                                                <span className={`font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{slot.buyDate || '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">수량</span>
                                                <span className="font-bold">{slot.quantity.toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">투자금액</span>
                                                <span className="font-bold">{Math.round(slot.investedAmount || 0).toLocaleString()}원</span>
                                            </div>
                                            <div className="pt-2 border-t border-dashed border-gray-200 dark:border-gray-600">
                                                <div className="flex justify-between items-end">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs text-gray-500">현재 수익률</span>
                                                        <button
                                                            onClick={() => handleEditStart(slot)}
                                                            className="text-[10px] text-blue-500 hover:underline flex items-center gap-1"
                                                        >
                                                            <span>데이터 수정</span>
                                                            <Edit2 className="w-2.5 h-2.5" />
                                                        </button>
                                                    </div>
                                                    <span className={`text-lg font-black ${slotRoi >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                        {slotRoi >= 0 ? '+' : ''}{slotRoi.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <div className={`text-right text-xs mt-1 ${profit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                                                    {profit >= 0 ? '+' : ''}{Math.round(profit).toLocaleString()}원
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleSell(slot.number)}
                                                className={`w-full py-3 rounded-xl font-bold transition-all ${canSell
                                                    ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500 shadow-lg shadow-yellow-400/20'
                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                                    }`}
                                            >
                                                {canSell ? '💰 매도 가능!' : '보유 중'}
                                            </button>
                                        </>
                                    )
                                ) : (
                                    <>
                                        <div className="h-24 flex flex-col justify-center items-center text-center space-y-2">
                                            <span className="text-xs text-gray-400">
                                                {isSlot1 ? (
                                                    '기준가 도달 시 투자를 시작하세요'
                                                ) : (
                                                    prevSlot?.isActive ? (
                                                        `매수 권장가: ${Math.round(recommendedBuyPrice).toLocaleString()}원 이하`
                                                    ) : (
                                                        '이전 슬롯을 먼저 매수하세요'
                                                    )
                                                )}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleBuy(slot.number)}
                                            disabled={!canBuy}
                                            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${canBuy
                                                ? (isRecommendBuy
                                                    ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500 shadow-lg shadow-yellow-400/20'
                                                    : 'bg-yellow-200 text-gray-700 hover:bg-yellow-300 shadow-md')
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-300 cursor-not-allowed'
                                                }`}
                                        >
                                            <ShoppingCart className="w-5 h-5" />
                                            {canBuy ? (isRecommendBuy ? '매수 실행' : '임의 매수') : '매수 대기'}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function AssetSplitInvestment() {
    const { theme } = useTheme();
    const { userDataLoaded } = useAuth();
    const [stockPrices, setStockPrices] = useState<TrackedStock[]>([]);

    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadDashboardData = async () => {
        if (!userDataLoaded) return;
        setIsRefreshing(true);
        try {
            const [data, intraday] = await Promise.all([
                fetchMarketDashboardData(),
                fetchFXIntradayData()
            ]);
            
            let allPrices: TrackedStock[] = [];
            
            if (data.majorRates) {
                const ratesAsStocks: TrackedStock[] = data.majorRates.map((r: any) => ({
                    id: r.id,
                    symbol: r.symbol || r.id,
                    name: r.name,
                    enName: r.name,
                    price: parseFloat(String(r.value).replace(/,/g, '')),
                    changePercent: r.changePercent,
                    trend: r.trend
                }));
                allPrices = [...allPrices, ...ratesAsStocks];
            }

            if (data.stockPrices) {
                allPrices = [...allPrices, ...data.stockPrices];
            }
            
            if (allPrices.length > 0) {
                // USD인 경우 실시간 intraday 데이터가 있다면 반영
                const updatedStockPrices = allPrices.map((s: TrackedStock) => {
                    if (s.id === 'usd-krw' || s.symbol === 'USDKRW' || s.name === '미국 달러') {
                        if (intraday && intraday.length > 0) {
                            return { ...s, price: intraday[intraday.length - 1].rate };
                        }
                    }
                    return s;
                });
                
                setStockPrices(updatedStockPrices);

                // 기존 투자 종목들의 현재가를 실시간 가격으로 자동 업데이트
                setInvestments(prev => prev.map(inv => {
                    const searchName = inv.settings.assetName.trim().toLowerCase().replace(/\s/g, '');
                    const found = updatedStockPrices.find((s: TrackedStock) =>
                        s.name.toLowerCase().replace(/\s/g, '') === searchName ||
                        s.enName.toLowerCase().replace(/\s/g, '') === searchName ||
                        s.symbol.toLowerCase().replace(/\s/g, '').includes(searchName) ||
                        s.id.toLowerCase().replace(/\s/g, '') === searchName
                    );

                    if (found && inv.lastPrice !== found.price) {
                        return { ...inv, lastPrice: found.price };
                    }
                    return inv;
                }));
            }
        } catch (error) {
            console.error('시세 업데이트 실패:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (userDataLoaded) {
            loadDashboardData();
            const interval = setInterval(loadDashboardData, 60000);
            return () => clearInterval(interval);
        }
    }, [userDataLoaded]);

    // 여러 종목 상태 관리
    const [investments, setInvestments] = useSyncState<AssetInvestment[]>('asset-investments-v2', () => {
        // 초기 샘플 종목
        return [{
            id: 'init-1',
            settings: {
                assetName: '삼성전자',
                totalBudget: 10000000,
                gapPercent: 3.0,
                targetProfitPercent: 3.0,
                basePrice: 70000,
                splitCount: 7
            },
            slots: Array.from({ length: 7 }, (_, i) => ({
                number: i + 1,
                isActive: false,
                buyPrice: null,
                quantity: 0,
                investedAmount: 0,
                targetPrice: null
            })),
            lastPrice: 70000
        }];
    });

    // 종목 추가
    const addInvestment = () => {
        const newAsset: AssetInvestment = {
            id: Date.now().toString(),
            settings: {
                assetName: '새 종목',
                totalBudget: 10000000,
                gapPercent: 3.0,
                targetProfitPercent: 3.0,
                basePrice: 50000,
                splitCount: 7
            },
            slots: Array.from({ length: 7 }, (_, i) => ({
                number: i + 1,
                isActive: false,
                buyPrice: null,
                quantity: 0,
                investedAmount: 0,
                targetPrice: null
            })),
            lastPrice: 0
        };
        setInvestments(prev => [...prev, newAsset]);
    };

    // 종목 삭제
    const deleteInvestment = (id: string) => {
        if (window.confirm('정말로 이 종목을 삭제하시겠습니까? 데이터가 모두 소멸됩니다.')) {
            setInvestments(prev => prev.filter(inv => inv.id !== id));
        }
    };

    // 종목 업데이트
    const updateInvestment = (updated: AssetInvestment) => {
        setInvestments(prev => prev.map(inv => inv.id === updated.id ? updated : inv));
    };

    const totalItems = investments.length;
    const totalInvestedAmount = investments.reduce((sum, inv) => {
        return sum + inv.slots.reduce((slotSum, slot) => slotSum + (slot.isActive && slot.investedAmount ? slot.investedAmount : 0), 0);
    }, 0);
    const totalBudget = investments.reduce((sum, inv) => sum + inv.settings.totalBudget, 0);

    const totalCurrentValue = investments.reduce((sum, inv) => {
        const activeSlots = inv.slots.filter(s => s.isActive);
        return sum + activeSlots.reduce((slotSum, slot) => slotSum + ((inv.lastPrice || 0) * slot.quantity), 0);
    }, 0);
    const totalProfit = totalCurrentValue - totalInvestedAmount;
    const totalRoi = totalInvestedAmount > 0 ? (totalProfit / totalInvestedAmount) * 100 : 0;

    return (
        <div className="space-y-8">
            {/* 상단 통계 요약 (FX Tracker와 동일한 4개 카드 디자인) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>운용 종목 수</h3>
                    <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {totalItems}개
                    </p>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        전체 포트폴리오
                    </p>
                </div>

                <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>현재 매수 총액</h3>
                    <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                        {Math.round(totalInvestedAmount).toLocaleString()}원
                    </p>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        투입 원금 합계
                    </p>
                </div>

                <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>평가 손익 (미실현)</h3>
                    <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                        {totalProfit >= 0 ? '+' : ''}{Math.round(totalProfit).toLocaleString()}원
                    </p>
                    <p className={`text-sm mt-1 ${totalProfit >= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                        {totalRoi.toFixed(2)}%
                    </p>
                </div>

                <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-100'}`}>
                    <h3 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>예산 총액</h3>
                    <p className={`text-2xl font-bold ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>
                        {totalBudget.toLocaleString()}원
                    </p>
                    <p className={`text-sm mt-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        설정된 전체 한도
                    </p>
                </div>
            </div>

            {/* 액션 바 (FX Tracker와 동일한 스타일) */}
            <div className={`p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
                <div className="flex items-center gap-3">
                    <span className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900'}`}>
                        포트폴리오 관리:
                    </span>
                    <span className="text-sm text-gray-500">종목별 분할 매수 상황을 확인하세요.</span>
                    <div className="flex items-center gap-2 ml-4 px-3 py-1 bg-white/50 dark:bg-gray-700/50 rounded-lg">
                        <span className={`text-[10px] font-bold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                            실시간 시세: {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button
                            onClick={loadDashboardData}
                            disabled={isRefreshing}
                            className={`p-2 rounded-lg transition-all duration-200 flex items-center justify-center group ${theme === 'dark' ? 'hover:bg-gray-700' : 'hover:bg-gray-200'} ${isRefreshing ? 'opacity-50' : ''}`}
                            title="시세 새로고침"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={`transition-transform duration-500 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180'} ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}
                            >
                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                <polyline points="21 3 21 8 16 8" />
                            </svg>
                        </button>
                    </div>
                </div>
                <button
                    onClick={addInvestment}
                    className="flex shrink-0 items-center justify-center gap-2 px-6 py-2.5 bg-yellow-400 text-gray-900 rounded-xl text-sm font-bold hover:bg-yellow-500 transition-colors shadow-md"
                >
                    <Plus className="w-4 h-4" />
                    <span>새 종목 추가하기</span>
                </button>
            </div>

            {/* 종목 리스트 */}
            <div className="space-y-16 pb-20">
                {investments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 border-4 border-dashed border-gray-200 rounded-3xl opacity-50">
                        <Activity className="w-16 h-16 mb-4 text-gray-300" />
                        <p className="text-xl font-bold text-gray-400">운영 중인 종목이 없습니다</p>
                    </div>
                ) : (
                    investments.map(inv => (
                        <SingleAssetManager
                            key={inv.id}
                            investment={inv}
                            stockPrices={stockPrices}
                            onUpdate={updateInvestment}
                            onDelete={() => deleteInvestment(inv.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
