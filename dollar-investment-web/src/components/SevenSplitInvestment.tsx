import { useTheme } from '../contexts/ThemeContext';
import type { SevenSplitSettings, SevenSplitSlot } from '../types';
import { getCurrentRateValue } from '../services/exchangeRateService';
import { useInvestmentAnalysis } from '../hooks/useInvestmentAnalysis';
import { useSyncState } from '../hooks/useSyncState';
import { Settings, ShoppingCart, Lightbulb, Edit2, RotateCcw } from 'lucide-react';

export function SevenSplitInvestment() {
    const { theme } = useTheme();
    const { exchangeRate } = useInvestmentAnalysis();
    const currentRate = exchangeRate ? getCurrentRateValue(exchangeRate) : 0;

    // 기본 설정 상태
    const [settings, setSettings] = useSyncState<SevenSplitSettings>('seven-split-settings', {
        totalBudget: 10000000, // 1000만원
        gapWon: 10,
        targetProfitPercent: 1.0,
        baseExchangeRate: currentRate || 1400,
        splitCount: 7 // 기본 7분할
    });

    // 슬롯 상태
    const [slots, setSlots] = useSyncState<SevenSplitSlot[]>('seven-split-slots', () => {
        return Array.from({ length: 7 }, (_, i) => ({
            number: i + 1,
            isActive: false,
            buyPrice: null,
            amount: 0,
            krwAmount: 0,
            targetPrice: null,
            buyDate: undefined
        }));
    });

    // 분할 횟수 변경 시 슬롯 조정
    const handleSplitCountChange = (newCount: number) => {
        if (newCount < 1) return;

        let newSlots = [...slots];
        if (newSlots.length < newCount) {
            // 슬롯 추가
            const toAdd = newCount - newSlots.length;
            const startNum = newSlots.length + 1;
            const addedSlots = Array.from({ length: toAdd }, (_, i) => ({
                number: startNum + i,
                isActive: false,
                buyPrice: null,
                amount: 0,
                krwAmount: 0,
                targetPrice: null,
                buyDate: undefined
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

        setSlots(newSlots);
        setSettings(prev => ({ ...prev, splitCount: newCount }));
    };

    const [editingSlot, setEditingSlot] = useSyncState<number | null>('seven-split-editing-slot', null);
    const [editValues, setEditValues] = useSyncState<{ buyPrice: number; amount: number; targetPrice: number }>('seven-split-edit-values', { buyPrice: 0, amount: 0, targetPrice: 0 });

    // 설정 변경 핸들러
    const handleSettingChange = (key: keyof SevenSplitSettings, value: number) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // 매수 처리
    const handleBuy = (slotNumber: number) => {
        const slotIndex = slotNumber - 1;
        const buyPrice = currentRate;

        // 슬롯 2~7은 이전 슬롯 매수가 - Gap 조건 확인 (선택 사항이지만 권장)
        if (slotNumber > 1 && slots[slotIndex - 1].isActive) {
            // 강제는 아니지만 가이드 제공 가능
        }

        const budgetPerSlot = settings.totalBudget / settings.splitCount; // 단순 균등 배분 (슬롯1 비중 조절 로직 추가 가능)
        const amount = budgetPerSlot / buyPrice;

        const newSlots = [...slots];
        newSlots[slotIndex] = {
            ...newSlots[slotIndex],
            isActive: true,
            buyPrice: buyPrice,
            amount: amount,
            krwAmount: budgetPerSlot,
            targetPrice: buyPrice * (1 + settings.targetProfitPercent / 100),
            buyDate: new Date().toISOString().split('T')[0]
        };
        setSlots(newSlots);
    };

    // 매도 처리
    const handleSell = (slotNumber: number) => {
        const slotIndex = slotNumber - 1;
        const newSlots = [...slots];
        newSlots[slotIndex] = {
            ...newSlots[slotIndex],
            isActive: false,
            buyPrice: null,
            amount: 0,
            krwAmount: 0,
            targetPrice: null,
            buyDate: undefined
        };
        setSlots(newSlots);
    };

    const handleEditStart = (slot: SevenSplitSlot) => {
        setEditValues({
            buyPrice: slot.buyPrice || 0,
            amount: slot.amount || 0,
            targetPrice: slot.targetPrice || 0
        });
        setEditingSlot(slot.number);
    };

    const handleEditSave = (slotNumber: number) => {
        const slotIndex = slotNumber - 1;
        const newSlots = [...slots];
        newSlots[slotIndex] = {
            ...newSlots[slotIndex],
            buyPrice: editValues.buyPrice,
            amount: editValues.amount,
            krwAmount: editValues.buyPrice * editValues.amount,
            targetPrice: editValues.targetPrice
        };
        setSlots(newSlots);
        setEditingSlot(null);
    };

    // 리셋
    const handleReset = () => {
        if (window.confirm('모든 슬롯 데이터를 초기화하시겠습니까?')) {
            setSlots(Array.from({ length: settings.splitCount }, (_, i) => ({
                number: i + 1,
                isActive: false,
                buyPrice: null,
                amount: 0,
                krwAmount: 0,
                targetPrice: null,
                buyDate: undefined
            })));
        }
    };

    return (
        <div className="space-y-8">
            {/* 설정 섹션 */}
            <div className={`p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className={`text-xl font-bold flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        <Settings className="w-5 h-5 text-slate-400" />
                        <span>투자 설정</span>
                    </h2>
                    <button
                        onClick={handleReset}
                        className="px-4 py-2 text-sm font-bold flex items-center gap-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>초기화</span>
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            총 투자 예산 (KRW)
                        </label>
                        <input
                            type="number"
                            value={settings.totalBudget}
                            onChange={(e) => handleSettingChange('totalBudget', Number(e.target.value))}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            매수 간격 (Gap 원)
                        </label>
                        <input
                            type="number"
                            value={settings.gapWon}
                            onChange={(e) => handleSettingChange('gapWon', Number(e.target.value))}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            목표 수익률 (%)
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            value={settings.targetProfitPercent}
                            onChange={(e) => handleSettingChange('targetProfitPercent', Number(e.target.value))}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            기준 환율 (슬롯1)
                        </label>
                        <input
                            type="number"
                            value={settings.baseExchangeRate}
                            onChange={(e) => handleSettingChange('baseExchangeRate', Number(e.target.value))}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            분할 횟수
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            value={settings.splitCount}
                            onChange={(e) => handleSplitCountChange(Number(e.target.value))}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                </div>
            </div>

            {/* 현재 상태 정보 */}
            <div className={`p-4 rounded-xl flex justify-between items-center ${theme === 'dark' ? 'bg-gray-800/50' : 'bg-gray-100'}`}>
                <span className={`font-medium ${theme === 'dark' ? 'text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                    현재 원/달러 환율: <span className="text-xl font-bold">{currentRate.toLocaleString()}원</span>
                </span>
                <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 rounded-full"></div>
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>운영 중</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                        <span className={theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}>대기 중</span>
                    </div>
                </div>
            </div>

            {/* 슬롯 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {slots.map((slot, index) => {
                    const isSlot1 = slot.number === 1;
                    const prevSlot = index > 0 ? slots[index - 1] : null;

                    // 매수 권장 가격 계산
                    let recommendedBuyPrice = 0;
                    if (isSlot1) {
                        recommendedBuyPrice = settings.baseExchangeRate;
                    } else if (prevSlot && prevSlot.buyPrice) {
                        recommendedBuyPrice = prevSlot.buyPrice - settings.gapWon;
                    }

                    const isRecommendBuy = !slot.isActive && (isSlot1 || (prevSlot && prevSlot.isActive && currentRate <= recommendedBuyPrice));
                    const canBuy = !slot.isActive;
                    const canSell = slot.isActive && currentRate >= (slot.targetPrice || 0);

                    const profit = slot.isActive ? (currentRate - slot.buyPrice!) * slot.amount : 0;
                    const roi = slot.isActive ? ((currentRate / slot.buyPrice!) - 1) * 100 : 0;

                    return (
                        <div
                            key={slot.number}
                            className={`relative overflow-hidden rounded-2xl border transition-all duration-300 shadow-md hover:shadow-xl ${slot.isActive
                                ? 'border-gray-800 dark:border-gray-200'
                                : 'border-gray-100 dark:border-gray-700'
                                } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                        >
                            {/* 슬롯 헤더 */}
                            <div className={`p-4 flex justify-between items-center ${slot.isActive ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-white' : (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')
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
                                    editingSlot === slot.number ? (
                                        <div className="space-y-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400">매수가</label>
                                                <input
                                                    type="number"
                                                    value={editValues.buyPrice}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, buyPrice: Number(e.target.value) }))}
                                                    className={`w-full p-1 text-xs border rounded ${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400">매수수량 ($)</label>
                                                <input
                                                    type="number"
                                                    value={editValues.amount}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, amount: Number(e.target.value) }))}
                                                    className={`w-full p-1 text-xs border rounded ${theme === 'dark' ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'}`}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400">목표가</label>
                                                <input
                                                    type="number"
                                                    value={editValues.targetPrice}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, targetPrice: Number(e.target.value) }))}
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
                                                    onClick={() => setEditingSlot(null)}
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
                                                <span className="font-bold text-yellow-500 dark:text-yellow-400">{slot.targetPrice?.toFixed(2)}원</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">매수일자</span>
                                                <span className="font-bold">{slot.buyDate || '-'}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">매수수량</span>
                                                <span className="font-bold">${slot.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">투자금액</span>
                                                <span className="font-bold">{Math.round(slot.krwAmount).toLocaleString()}원</span>
                                            </div>
                                            <div className="pt-2 border-t border-dashed border-gray-200">
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
                                                    <span className={`text-lg font-black ${roi >= 0 ? 'text-red-500' : 'text-blue-500'}`}>
                                                        {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
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
                                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
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
                                                    '기준 환율 도달 시 투자를 시작하세요'
                                                ) : (
                                                    prevSlot?.isActive ? (
                                                        `매수 권장가: ${recommendedBuyPrice.toLocaleString()}원 이하`
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
                                                ? (isRecommendBuy ? 'bg-yellow-400 text-gray-900 hover:bg-yellow-500 shadow-lg shadow-yellow-400/20' : 'bg-yellow-200 text-gray-700 hover:bg-yellow-300 shadow-md')
                                                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
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

            {/* 전략 가이드 */}
            <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    <Lightbulb className="w-5 h-5 text-slate-400" />
                    <span>스플릿 투자 원칙</span>
                </h3>
                <ul className={`space-y-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    <li>• <strong>손절은 없다</strong>: 환율이 하락하면 다음 슬롯에서 추가 매수합니다.</li>
                    <li>• <strong>독립 운영</strong>: 각 슬롯은 목표 수익률 도달 시 개별적으로 매도합니다.</li>
                    <li>• <strong>무한 반복</strong>: 매도된 슬롯은 다시 매수 조건이 되면 재진입합니다.</li>
                    <li>• <strong>슬롯 1의 중요성</strong>: 전체 투자의 베이스이므로 가장 보수적인 환율에서 시작하세요.</li>
                </ul>
            </div>
        </div>
    );
}
