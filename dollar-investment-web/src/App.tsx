import { useState, useEffect } from 'react';
import { InvestmentAnalysis } from './components/InvestmentAnalysis';
import { SevenSplitInvestment } from './components/SevenSplitInvestment';
import { AssetSplitInvestment } from './components/AssetSplitInvestment';
import { FXExchangeProfitTracker } from './components/FXExchangeProfitTracker';
import { MarketDashboard } from './components/MarketDashboard';
import { Tabs } from './components/Tabs';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './contexts/ThemeContext';
import { UserProfile } from './components/UserProfile';
// import { BackupManager } from './components/BackupManager';
import { ExchangeRateNews } from './components/ExchangeRateNews';
import { CommunityBoard } from './components/CommunityBoard';
import { FXHistoryTimeline } from './components/FXHistoryTimeline';
import { DeveloperDashboard } from './components/DeveloperDashboard';
import { fetchAllCurrentExchangeRates } from './services/exchangeRateService';
import { fetchMarketDashboardData } from './services/marketDashboardService';
import { fetchFXIntradayData } from './services/fxHistoryService';
import type { DashboardData } from './types';
import logo from './assets/logo.png';
import './App.css';

function App() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentRateInfo, setCurrentRateInfo] = useState<{ rate: number; time: string } | null>(null);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [showDevDashboard, setShowDevDashboard] = useState(false);

  const fetchGlobalData = async () => {
    try {
      const [intraday, dashData, currentRates] = await Promise.all([
        fetchFXIntradayData(),
        fetchMarketDashboardData(),
        fetchAllCurrentExchangeRates()
      ]);

      // 1. 헤더 환율 동기화 (그래프와 소스 일치)
      if (intraday && intraday.length > 0) {
        const latest = intraday[intraday.length - 1];
        setCurrentRateInfo({
          rate: latest.rate,
          time: latest.fullTime.split('+')[0].replace('T', ' ')
        });
      }

      // 2. 대시보드 카드/지표 데이터 동기화
      if (dashData) {
        if (currentRates && dashData.majorRates) {
          dashData.majorRates = dashData.majorRates.map((rate: any) => {
            const curUnit = rate.id.split('-')[0].toUpperCase();
            
            // USD 특수 처리: 실시간 데이터(intraday)가 있으면 그것을 최우선으로 반영 (소수점 1자리 유지)
            if (curUnit === 'USD' && intraday && intraday.length > 0) {
              const latest = intraday[intraday.length - 1];
              return { 
                ...rate, 
                value: latest.rate.toLocaleString('ko-KR', { 
                  minimumFractionDigits: 1,
                  maximumFractionDigits: 1 
                }) 
              };
            }

            const latestRate = currentRates.find((r: any) => r.cur_unit === curUnit);
            return latestRate ? { ...rate, value: latestRate.deal_bas_r } : rate;
          });
        }
        setDashboardData(dashData);
      }
    } catch (e) {
      console.error("Global data sync error:", e);
    } finally {
      setIsDataLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
    const interval = setInterval(fetchGlobalData, 1 * 60 * 1000); // 1분 주기로 정밀 동기화
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'dashboard', label: '시장 대시보드' },
    { id: 'analysis', label: '투자적정성 분석' },
    { id: 'sevensplit', label: '환율 스플릿' },
    { id: 'asset-split', label: '자산 스플릿' },
    { id: 'fx-profit', label: '환차익 계산기' },
    { id: 'news', label: '환율 뉴스' },
    { id: 'community', label: '커뮤니티' },
    { id: 'history', label: '환율 연혁' },
    // { id: 'about', label: '소개' }, // 임시 숨김 처리
  ];

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0a0a0c] text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* 헤더 */}
      <div className="max-w-6xl mx-auto px-4 pt-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div onClick={() => window.location.reload()} className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
              <img src={logo} alt="로장보로" className="w-10 h-10 rounded-xl shadow-sm" />
              <h1 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                달러 인베스트
              </h1>
            </div>
            {currentRateInfo && (
              <div className={`text-sm font-bold flex items-center pt-1.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className={`text-base mr-1 ${theme === 'dark' ? 'text-yellow-400' : 'text-blue-600'}`}>
                  원/달러 {currentRateInfo.rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원
                </span>
                <span className="text-xs font-medium">({currentRateInfo.time})</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 flex-shrink-0">
            <button
              onClick={() => setShowDevDashboard(true)}
              className={`p-2.5 rounded-xl transition-all font-bold text-xs flex items-center gap-2 border ${
                theme === 'dark' 
                ? 'bg-gray-800 border-gray-700 text-blue-400 hover:bg-gray-700' 
                : 'bg-white border-gray-200 text-blue-600 hover:bg-gray-50'
              }`}
              title="개발자 대시보드"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <span className="hidden md:inline">개발자 화면</span>
            </button>
            <UserProfile />
            <ThemeToggle />
          </div>
        </header>
      </div>

      {/* 탭바 */}
      <div className="max-w-6xl mx-auto px-4 mb-8">
        <Tabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
        />
      </div>

      {/* 본문 */}
      <div className="max-w-6xl mx-auto px-4">
        <main>
          {activeTab === 'analysis' ? (
            <InvestmentAnalysis />
          ) : activeTab === 'sevensplit' ? (
            <SevenSplitInvestment />
          ) : activeTab === 'asset-split' ? (
            <AssetSplitInvestment />
          ) : activeTab === 'fx-profit' ? (
            <FXExchangeProfitTracker />
          ) : activeTab === 'news' ? (
            <ExchangeRateNews />
          ) : activeTab === 'community' ? (
            <CommunityBoard />
          ) : activeTab === 'history' ? (
            <FXHistoryTimeline />
          ) : (
            <MarketDashboard initialData={dashboardData} isLoadingExternal={isDataLoading} />
          )}
        </main>

        <footer className={`mt-20 py-10 border-t ${theme === 'dark' ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'} text-center text-xs`}>
          © 2026 GirokLabs. All rights reserved.
        </footer>
        {/* <BackupManager /> */}
      </div>

      {/* 개발자 대시보드 모달 */}
      {showDevDashboard && (
        <DeveloperDashboard onClose={() => setShowDevDashboard(false)} />
      )}
    </div>
  );
}

export default App;
