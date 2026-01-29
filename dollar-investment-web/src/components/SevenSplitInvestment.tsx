import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { SevenSplitSettings, SevenSplitSlot } from '../types';
import { getCurrentRateValue } from '../services/exchangeRateService';
import { useInvestmentAnalysis } from '../hooks/useInvestmentAnalysis';

export function SevenSplitInvestment() {
    const { theme } = useTheme();
    const { exchangeRate } = useInvestmentAnalysis();
    const currentRate = exchangeRate ? getCurrentRateValue(exchangeRate) : 0;

    // 기본 설정 상태
    const [settings, setSettings] = useState<SevenSplitSettings>(() => {
        const saved = localStorage.getItem('seven-split-settings');
        return saved ? JSON.parse(saved) : {
            totalBudget: 10000000, // 1000만원
            gapWon: 10,
            targetProfitPercent: 1.0,
            baseExchangeRate: currentRate || 1400
        };
    });

    // 슬롯 상태
    const [slots, setSlots] = useState<SevenSplitSlot[]>(() => {
        const saved = localStorage.getItem('seven-split-slots');
        if (saved) return JSON.parse(saved);

        return Array.from({ length: 7 }, (_, i) => ({
            number: i + 1,
            isActive: false,
            buyPrice: null,
            amount: 0,
            krwAmount: 0,
            targetPrice: null
        }));
    });

    // 설정 저장
    useEffect(() => {
        localStorage.setItem('seven-split-settings', JSON.stringify(settings));
    }, [settings]);

    // 슬롯 저장
    useEffect(() => {
        localStorage.setItem('seven-split-slots', JSON.stringify(slots));
    }, [slots]);

    // 설정 변경 핸들러
    const handleSettingChange = (key: keyof SevenSplitSettings, value: number) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // 매수 처리
    const handleBuy = (slotNumber: number) => {
        const slotIndex = slotNumber - 1;
        let buyPrice = currentRate;

        // 슬롯 2~7은 이전 슬롯 매수가 - Gap 조건 확인 (선택 사항이지만 권장)
        if (slotNumber > 1 && slots[slotIndex - 1].isActive) {
            // 강제는 아니지만 가이드 제공 가능
        }

        const budgetPerSlot = settings.totalBudget / 7; // 단순 균등 배분 (슬롯1 비중 조절 로직 추가 가능)
        const amount = budgetPerSlot / buyPrice;

        const newSlots = [...slots];
        newSlots[slotIndex] = {
            ...newSlots[slotIndex],
            isActive: true,
            buyPrice: buyPrice,
            amount: amount,
            krwAmount: budgetPerSlot,
            targetPrice: buyPrice * (1 + settings.targetProfitPercent / 100)
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
            targetPrice: null
        };
        setSlots(newSlots);
    };

    // 리셋
    const handleReset = () => {
        if (window.confirm('모든 슬롯 데이터를 초기화하시겠습니까?')) {
            setSlots(Array.from({ length: 7 }, (_, i) => ({
                number: i + 1,
                isActive: false,
                buyPrice: null,
                amount: 0,
                krwAmount: 0,
                targetPrice: null
            })));
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            {/* 타이틀 섹션 */}
            <div className="text-center mb-8">
                <h1 className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    세븐 스플릿 투자 관리
                </h1>
                <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    7개의 독립 계좌로 나누어 매수/매도하는 시스템 투자 전략
                </p>
            </div>

            {/* 설정 섹션 */}
            <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        ⚙️ 투자 설정
                    </h2>
                    <button
                        onClick={handleReset}
                        className="text-sm px-3 py-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200"
                    >
                        초기화
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
            </div>

            {/* 현재 상태 정보 */}
            <div className={`p-4 rounded-xl flex justify-between items-center ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50'}`}>
                <span className={`font-medium ${theme === 'dark' ? 'text-blue-200' : 'text-blue-800'}`}>
                    현재 원/달러 환율: <span className="text-xl font-bold">{currentRate.toLocaleString()}원</span>
                </span>
                <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
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

                    const canBuy = !slot.isActive && (isSlot1 || (prevSlot && prevSlot.isActive && currentRate <= recommendedBuyPrice));
                    const canSell = slot.isActive && currentRate >= (slot.targetPrice || 0);

                    const profit = slot.isActive ? (currentRate - slot.buyPrice!) * slot.amount : 0;
                    const roi = slot.isActive ? ((currentRate / slot.buyPrice!) - 1) * 100 : 0;

                    return (
                        <div
                            key={slot.number}
                            className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${slot.isActive
                                ? 'border-green-500 shadow-lg shadow-green-500/20'
                                : 'border-transparent shadow-md hover:border-gray-300'
                                } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                        >
                            {/* 슬롯 헤더 */}
                            <div className={`p-4 flex justify-between items-center ${slot.isActive ? 'bg-green-500 text-white' : (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')
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
                                    <>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">매수가</span>
                                            <span className="font-bold">{slot.buyPrice?.toLocaleString()}원</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">목표가</span>
                                            <span className="font-bold text-blue-500">{slot.targetPrice?.toFixed(2)}원</span>
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
                                                <span className="text-xs text-gray-500">현재 수익률</span>
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
                                                ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30'
                                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                }`}
                                        >
                                            {canSell ? '💰 매도 가능!' : '보유 중'}
                                        </button>
                                    </>
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
                                            className={`w-full py-3 rounded-xl font-bold transition-all ${canBuy
                                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30'
                                                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                                }`}
                                        >
                                            {canBuy ? '🛒 매수 실행' : '매수 대기'}
                                        </button>
                                        {canBuy && (
                                            <div className="absolute top-0 left-0 w-full h-1 bg-blue-500 animate-pulse"></div>
                                        )}
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
                    💡 세븐 스플릿 투자 원칙
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
