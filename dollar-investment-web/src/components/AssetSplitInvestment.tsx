import { useTheme } from '../contexts/ThemeContext';
import type { AssetInvestment, AssetSplitSettings } from '../types';
import { useSyncState } from '../hooks/useSyncState';
import { useState } from 'react';

// 단일 종목 관리자 컴포넌트
function SingleAssetManager({
    investment,
    onUpdate,
    onDelete
}: {
    investment: AssetInvestment,
    onUpdate: (updated: AssetInvestment) => void,
    onDelete: () => void
}) {
    const { theme } = useTheme();
    const [currentPrice, setCurrentPrice] = useState<number>(investment.lastPrice || 0);

    // 내부 상태 변경 시 상위로 전파
    const handleUpdate = (updates: Partial<AssetInvestment>) => {
        onUpdate({ ...investment, ...updates });
    };

    const handleSettingUpdate = (key: keyof AssetSplitSettings, value: string | number) => {
        const updatedSettings = { ...investment.settings, [key]: value };

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
            targetPrice: null
        };
        handleUpdate({ slots: newSlots, lastPrice: currentPrice });
    };

    const handleReset = () => {
        if (window.confirm('이 종목의 모든 슬롯 데이터를 초기화하시겠습니까?')) {
            const resetSlots = Array.from({ length: investment.settings.splitCount }, (_, i) => ({
                number: i + 1,
                isActive: false,
                buyPrice: null,
                quantity: 0,
                investedAmount: 0,
                targetPrice: null
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
        <div className={`p-6 rounded-3xl space-y-8 border-2 ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-yellow-100 shadow-xl'}`}>
            {/* 헤더: 종목명 및 기본 정보 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 border-dashed border-gray-200">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${theme === 'dark' ? 'bg-yellow-900/30' : 'bg-yellow-50'}`}>
                        <span className="text-2xl">📊</span>
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
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200"
                    >
                        데이터 리셋
                    </button>
                    <button
                        onClick={onDelete}
                        className="px-4 py-2 text-xs font-bold rounded-xl bg-red-50 text-gray-900 dark:text-gray-100 font-bold hover:bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                    >
                        종목 삭제
                    </button>
                </div>
            </div>

            {/* 설정 및 현재가 입력 섹션 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">총 예산</label>
                        <input
                            type="number"
                            value={investment.settings.totalBudget}
                            onChange={(e) => handleSettingUpdate('totalBudget', Number(e.target.value))}
                            className={`w-full p-2 text-sm rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">간격 (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={investment.settings.gapPercent}
                            onChange={(e) => handleSettingUpdate('gapPercent', Number(e.target.value))}
                            className={`w-full p-2 text-sm rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">목표 (%)</label>
                        <input
                            type="number"
                            step="0.1"
                            value={investment.settings.targetProfitPercent}
                            onChange={(e) => handleSettingUpdate('targetProfitPercent', Number(e.target.value))}
                            className={`w-full p-2 text-sm rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">기준가(슬롯1)</label>
                        <input
                            type="number"
                            value={investment.settings.basePrice}
                            onChange={(e) => handleSettingUpdate('basePrice', Number(e.target.value))}
                            className={`w-full p-2 text-sm rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                </div>
                <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-400 mb-1 block">분할 횟수</label>
                        <select
                            value={investment.settings.splitCount || 7}
                            onChange={(e) => handleSettingUpdate('splitCount', Number(e.target.value))}
                            className={`w-full p-2 text-sm rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
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
                <div className={`lg:col-span-4 p-4 rounded-2xl flex flex-col justify-center items-center gap-2 border-2 ${theme === 'dark' ? 'bg-yellow-900/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-100 shadow-inner'}`}>
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
                            className={`text-xl font-black w-32 p-1 bg-transparent border-b-2 text-center focus:outline-none ${theme === 'dark' ? 'text-white border-yellow-500' : 'text-yellow-900 border-yellow-300'}`}
                            placeholder="0"
                        />
                        <span className="font-bold text-yellow-500">원</span>
                    </div>
                </div>
            </div>

            {/* 슬롯 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                    return (
                        <div
                            key={slot.number}
                            className={`relative p-4 rounded-2xl border-2 transition-all ${slot.isActive
                                    ? (theme === 'dark' ? 'border-yellow-400 bg-gray-800' : 'border-yellow-400 bg-white shadow-md')
                                    : (theme === 'dark' ? 'border-gray-700 bg-gray-900/30' : 'border-gray-200 bg-gray-50/50')
                                }`}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${slot.isActive
                                        ? 'bg-yellow-400 text-gray-900'
                                        : (theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500')
                                    }`}>
                                    Slot {slot.number}
                                </span>
                                {slot.isActive && (
                                    <span className={`text-[10px] font-bold ${slotRoi >= 0 ? 'text-red-500' : 'text-blue-500'
                                        }`}>
                                        {slotRoi >= 0 ? '▲' : '▼'} {Math.abs(slotRoi).toFixed(2)}%
                                    </span>
                                )}
                            </div>

                            {slot.isActive ? (
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between text-[11px]">
                                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>매수가</span>
                                        <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{slot.buyPrice?.toLocaleString()}원</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>목표가</span>
                                        <span className="font-bold text-yellow-500 dark:text-yellow-400">{Math.round(slot.targetPrice!).toLocaleString()}원</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>수량</span>
                                        <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{slot.quantity.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>총투자액</span>
                                        <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>{Math.round(slot.investedAmount || 0).toLocaleString()}원</span>
                                    </div>
                                    <button
                                        onClick={() => handleSell(slot.number)}
                                        className={`w-full py-2 rounded-xl text-xs font-bold mt-1 ${canSell
                                                ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500'
                                                : (theme === 'dark' ? 'bg-gray-700 text-gray-500' : 'bg-gray-100 text-gray-400')
                                            }`}
                                    >
                                        {canSell ? '💰 매도 실행' : '대기 중'}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-24 mb-4">
                                    <span className={`text-[10px] text-center px-4 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {isSlot1 ? '기준가 도달 시 진입' : (prevSlot?.isActive ? `${Math.round(recommendedBuyPrice).toLocaleString()}원 이하` : '이전 슬롯 대기')}
                                    </span>
                                    <button
                                        onClick={() => handleBuy(slot.number)}
                                        disabled={!canBuy}
                                        className={`mt-3 w-full py-2 rounded-xl text-xs font-bold transition-all ${canBuy
                                                ? (isRecommendBuy ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500' : 'bg-yellow-200 text-gray-700 hover:bg-yellow-300')
                                                : 'bg-transparent border border-dashed border-gray-300 text-gray-400 cursor-not-allowed'
                                            }`}
                                    >
                                        {canBuy ? (isRecommendBuy ? '🛒 매수' : '임의 매수') : '매수 대기'}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function AssetSplitInvestment() {

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

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-12">
            {/* 상단 추가 버튼 (우측 정렬로 변경) */}
            <div className="flex justify-end gap-2 mb-4">
                <button
                    onClick={addInvestment}
                    className="group relative flex items-center gap-2 px-8 py-4 bg-yellow-400 text-gray-900 rounded-3xl font-black shadow-xl shadow-yellow-400/30 hover:bg-yellow-500 transition-all hover:scale-105"
                >
                    <span className="text-xl group-hover:rotate-90 transition-transform">➕</span>
                    새 종목 추가하기
                </button>
            </div>

            {/* 종목 리스트 */}
            <div className="space-y-16 pb-20">
                {investments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 border-4 border-dashed border-gray-200 rounded-3xl opacity-50">
                        <span className="text-6xl mb-6">🏜️</span>
                        <p className="text-xl font-bold text-gray-400">운영 중인 종목이 없습니다</p>
                    </div>
                ) : (
                    investments.map(inv => (
                        <SingleAssetManager
                            key={inv.id}
                            investment={inv}
                            onUpdate={updateInvestment}
                            onDelete={() => deleteInvestment(inv.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
