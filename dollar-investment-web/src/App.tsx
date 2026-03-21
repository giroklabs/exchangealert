import { useState, useEffect } from 'react';
import { useSwipeable } from 'react-swipeable';
import { motion, AnimatePresence } from 'framer-motion';
import { InvestmentAnalysis } from './components/InvestmentAnalysis';
import { SevenSplitInvestment } from './components/SevenSplitInvestment';
import { AssetSplitInvestment } from './components/AssetSplitInvestment';
import { FXExchangeProfitTracker } from './components/FXExchangeProfitTracker';
import { MarketDashboard } from './components/MarketDashboard';
import { Tabs } from './components/Tabs';
import { BottomNavigation } from './components/BottomNavigation';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { UserProfile } from './components/UserProfile';
// import { BackupManager } from './components/BackupManager';
import { ExchangeRateNews } from './components/ExchangeRateNews';
import { CommunityBoard } from './components/CommunityBoard';
import { FXHistoryTimeline } from './components/FXHistoryTimeline';
import { DeveloperDashboard } from './components/DeveloperDashboard';
import { fetchAllCurrentExchangeRates } from './services/exchangeRateService';
import { fetchMarketDashboardData } from './services/marketDashboardService';
import { fetchFXIntradayData } from './services/fxHistoryService';
import { trackVisitor } from './services/analyticsService';
import type { DashboardData } from './types';
import logo from './assets/logo.png';
import './App.css';

function App() {
  const { theme } = useTheme();
  const { isAdmin } = useAuth();
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
    trackVisitor(); // 방문자 수 집계 (Firestore)
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

  const activeTabIndex = tabs.findIndex(t => t.id === activeTab);
  
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (activeTabIndex < tabs.length - 1) {
        setActiveTab(tabs[activeTabIndex + 1].id);
      }
    },
    onSwipedRight: () => {
      if (activeTabIndex > 0) {
        setActiveTab(tabs[activeTabIndex - 1].id);
      }
    },
    preventScrollOnSwipe: true,
    trackMouse: false
  });

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0a0a0c] text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* 헤더 */}
      <div className="max-w-6xl mx-auto px-4 pt-4 md:pt-8 w-full">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8 w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 w-full md:w-auto">
            <div onClick={() => window.location.reload()} className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity cursor-pointer">
              <img src={logo} alt="로장보로" className="w-8 h-8 md:w-10 md:h-10 rounded-xl shadow-sm flex-shrink-0" />
              <h1 className={`text-xl md:text-2xl font-black tracking-tight whitespace-nowrap flex-shrink-0 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                달러 인베스트
              </h1>
            </div>
            {currentRateInfo && (
              <div className={`text-xs md:text-sm font-bold flex items-center pt-1 sm:pt-1.5 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                <span className={`text-sm md:text-base mr-1 whitespace-nowrap ${theme === 'dark' ? 'text-yellow-400' : 'text-blue-600'}`}>
                  원/달러 {currentRateInfo.rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}원
                </span>
                <span className="text-xs font-medium whitespace-nowrap">({currentRateInfo.time})</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 w-full md:w-auto overflow-x-auto hide-scrollbar pb-1 md:pb-0">
            {isAdmin && (
              <button
                onClick={() => setShowDevDashboard(true)}
                className={`p-2 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 border flex-shrink-0 ${
                  theme === 'dark' 
                  ? 'bg-gray-800 border-gray-700 text-blue-400 hover:bg-gray-700' 
                  : 'bg-white border-gray-200 text-blue-600 hover:bg-gray-50'
                }`}
                title="개발자 대시보드"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <span className="hidden sm:inline">개발자 화면</span>
              </button>
            )}
            <div className="flex-shrink-0"><UserProfile /></div>
            <div className="flex-shrink-0"><ThemeToggle /></div>
          </div>
        </header>
      </div>

      {/* 탭바 (데스크톱) */}
      <div className="hidden md:block max-w-6xl mx-auto px-4 mb-8">
        <Tabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
        />
      </div>

      {/* 본문 */}
      <div className="max-w-6xl mx-auto px-4 pb-24 md:pb-0" {...swipeHandlers}>
        <main className="relative min-h-[60vh] overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
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
            </motion.div>
          </AnimatePresence>
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
      
      {/* 모바일 하단 네비게이션 */}
      <BottomNavigation 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        tabs={tabs} 
      />
    </div>
  );
}

export default App;
