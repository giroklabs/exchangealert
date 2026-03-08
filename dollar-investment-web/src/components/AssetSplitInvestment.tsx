import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { AssetSplitSettings, AssetSplitSlot } from '../types';

export function AssetSplitInvestment() {
    const { theme } = useTheme();

    // 수동 현재가 입력 상태 (주식 등은 실시간 API 연동 대신 수동 입력)
    const [currentPrice, setCurrentPrice] = useState<number>(0);

    // 기본 설정 상태
    const [settings, setSettings] = useState<AssetSplitSettings>(() => {
        const saved = localStorage.getItem('asset-split-settings');
        return saved ? JSON.parse(saved) : {
            assetName: '삼성전자',
            totalBudget: 10000000, // 1000만원
            gapPrice: 500,
            targetProfitPercent: 3.0,
            basePrice: 70000
        };
    });

    // 슬롯 상태
    const [slots, setSlots] = useState<AssetSplitSlot[]>(() => {
        const saved = localStorage.getItem('asset-split-slots');
        if (saved) return JSON.parse(saved);

        return Array.from({ length: 7 }, (_, i) => ({
            number: i + 1,
            isActive: false,
            buyPrice: null,
            quantity: 0,
            investedAmount: 0,
            targetPrice: null
        }));
    });

    // 설정 저장
    useEffect(() => {
        localStorage.setItem('asset-split-settings', JSON.stringify(settings));
    }, [settings]);

    // 슬롯 저장
    useEffect(() => {
        localStorage.setItem('asset-split-slots', JSON.stringify(slots));
    }, [slots]);

    // 설정 변경 핸들러 (String/Number 구분)
    const handleSettingUpdate = (key: keyof AssetSplitSettings, value: string | number) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // 매수 처리
    const handleBuy = (slotNumber: number) => {
        const slotIndex = slotNumber - 1;

        // 현재가가 0이면 매수 불가
        if (currentPrice <= 0) {
            alert('현재가를 먼저 입력해주세요.');
            return;
        }

        const buyPrice = currentPrice;
        const budgetPerSlot = settings.totalBudget / 7;
        const quantity = budgetPerSlot / buyPrice;

        const newSlots = [...slots];
        newSlots[slotIndex] = {
            ...newSlots[slotIndex],
            isActive: true,
            buyPrice: buyPrice,
            quantity: quantity,
            investedAmount: budgetPerSlot,
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
            quantity: 0,
            investedAmount: 0,
            targetPrice: null
        };
        setSlots(newSlots);
    };

    // 리셋
    const handleReset = () => {
        if (window.confirm('모든 자산 투자 데이터를 초기화하시겠습니까?')) {
            setSlots(Array.from({ length: 7 }, (_, i) => ({
                number: i + 1,
                isActive: false,
                buyPrice: null,
                quantity: 0,
                investedAmount: 0,
                targetPrice: null
            })));
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 space-y-8">
            {/* 타이틀 섹션 */}
            <div className="text-center mb-8">
                <h1 className={`text-4xl font-bold mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                    자산 분할 매수/매도 관리
                </h1>
                <p className={`${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    주식, 코인 등 모든 자산을 위한 세븐스플릿 변형 전략
                </p>
            </div>

            {/* 설정 섹션 */}
            <div className={`p-6 rounded-2xl shadow-xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        ⚙️ {settings.assetName || '자산'} 투자 설정
                    </h2>
                    <button
                        onClick={handleReset}
                        className="text-sm px-3 py-1 bg-red-100 text-red-600 rounded-md hover:bg-red-200"
                    >
                        초기화
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            자산 명칭 (예: 삼성전자, 비트코인)
                        </label>
                        <input
                            type="text"
                            value={settings.assetName}
                            onChange={(e) => handleSettingUpdate('assetName', e.target.value)}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                            placeholder="자산 이름 입력"
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            총 투자 예산
                        </label>
                        <input
                            type="number"
                            value={settings.totalBudget}
                            onChange={(e) => handleSettingUpdate('totalBudget', Number(e.target.value))}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            매수 간격 (Gap)
                        </label>
                        <input
                            type="number"
                            value={settings.gapPrice}
                            onChange={(e) => handleSettingUpdate('gapPrice', Number(e.target.value))}
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
                            onChange={(e) => handleSettingUpdate('targetProfitPercent', Number(e.target.value))}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                            기준 가격 (슬롯1)
                        </label>
                        <input
                            type="number"
                            value={settings.basePrice}
                            onChange={(e) => handleSettingUpdate('basePrice', Number(e.target.value))}
                            className={`w-full p-3 rounded-xl border ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`}
                        />
                    </div>
                </div>
            </div>

            {/* 실시간 가격 입력 섹션 */}
            <div className={`p-6 rounded-2xl border-2 flex flex-col md:flex-row justify-between items-center gap-4 ${theme === 'dark' ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'}`}>
                <div>
                    <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-indigo-200' : 'text-indigo-800'}`}>
                        📈 현재 {settings.assetName} 가격 입력
                    </h3>
                    <p className={`text-sm ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}>평가 손익 계산을 위해 수시로 업데이트 해주세요</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="number"
                        value={currentPrice || ''}
                        onChange={(e) => setCurrentPrice(Number(e.target.value))}
                        className={`text-2xl font-black w-48 p-3 rounded-xl border-2 focus:ring-4 focus:ring-indigo-500/20 ${theme === 'dark' ? 'bg-gray-800 border-indigo-500 text-white' : 'bg-white border-indigo-300 text-indigo-900'}`}
                        placeholder="0"
                    />
                    <span className={`text-xl font-bold ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>원</span>
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
                        recommendedBuyPrice = settings.basePrice;
                    } else if (prevSlot && prevSlot.buyPrice) {
                        recommendedBuyPrice = prevSlot.buyPrice - settings.gapPrice;
                    }

                    const canBuy = currentPrice > 0 && !slot.isActive && (isSlot1 || (prevSlot && prevSlot.isActive && currentPrice <= recommendedBuyPrice));
                    const canSell = slot.isActive && currentPrice >= (slot.targetPrice || 0);

                    const profit = slot.isActive ? (currentPrice - slot.buyPrice!) * slot.quantity : 0;
                    const roi = slot.isActive ? ((currentPrice / slot.buyPrice!) - 1) * 100 : 0;

                    return (
                        <div
                            key={slot.number}
                            className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${slot.isActive
                                ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                                : 'border-transparent shadow-md hover:border-gray-300'
                                } ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}
                        >
                            {/* 슬롯 헤더 */}
                            <div className={`p-4 flex justify-between items-center ${slot.isActive ? 'bg-indigo-500 text-white' : (theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')
                                }`}>
                                <span className="font-bold">Slot {slot.number} {isSlot1 && '(Base)'}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${slot.isActive ? 'bg-white/20' : (theme === 'dark' ? 'bg-gray-600' : 'bg-gray-200')
                                    }`}>
                                    {slot.isActive ? '보유 주표' : '비어 있음'}
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
                                            <span className="font-bold text-red-500">{slot.targetPrice?.toLocaleString(undefined, { maximumFractionDigits: 0 })}원</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">보유수량</span>
                                            <span className="font-bold">{slot.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}주</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">평가금액</span>
                                            <span className="font-bold">{Math.round(currentPrice * slot.quantity).toLocaleString()}원</span>
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
                                            {canSell ? '💰 매도 실행!' : '보유 중'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="h-24 flex flex-col justify-center items-center text-center space-y-2">
                                            <span className="text-xs text-gray-400">
                                                {isSlot1 ? (
                                                    '기준 가격 도달 시 분할 매수를 시작하세요'
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
                                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/30'
                                                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                                }`}
                                        >
                                            {canBuy ? '🛒 매수 실행' : '매수 대기'}
                                        </button>
                                        {canBuy && (
                                            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 animate-pulse"></div>
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
                    💡 자산 투자(주식) 분할 전략
                </h3>
                <ul className={`space-y-2 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-600'}`}>
                    <li>• <strong>평단가 관리</strong>: 가격이 하락할 때마다 다음 슬롯을 매수하여 평균 단가를 낮춥니다.</li>
                    <li>• <strong>보유 비중 원칙</strong>: 각 슬롯에 총 자산의 1/7 또는 정해진 비중을 균등하게 배분하여 위험을 분산합니다.</li>
                    <li>• <strong>수동 현재가 업데이트</strong>: 주식 등은 변동성이 크므로 실시간으로 현재가를 입력하여 수익 현황을 체크하세요.</li>
                    <li>• <strong>탈출 전략</strong>: 목표 수익률에 도달한 슬롯은 수익 실현하고, 다시 매수 권장가에 진입할 때까지 기다립니다.</li>
                </ul>
            </div>
        </div>
    );
}
