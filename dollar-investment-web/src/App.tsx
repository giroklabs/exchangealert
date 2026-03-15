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
import { fetchCurrentExchangeRate, getCurrentRateValue, fetchLastUpdateTime } from './services/exchangeRateService';
import logo from './assets/logo.png';
import './App.css';

function App() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentRateInfo, setCurrentRateInfo] = useState<{ rate: number; time: string } | null>(null);

  useEffect(() => {
    async function fetchHeaderRate() {
      try {
        const [rateData, updateTime] = await Promise.all([
          fetchCurrentExchangeRate(),
          fetchLastUpdateTime()
        ]);
        if (rateData) {
          setCurrentRateInfo({
            rate: getCurrentRateValue(rateData),
            time: updateTime || ''
          });
        }
      } catch (e) {
        console.error("Header rate fetch error:", e);
      }
    }
    fetchHeaderRate();
    const interval = setInterval(fetchHeaderRate, 15 * 60 * 1000); // 15분
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
            <MarketDashboard />
          )}
        </main>

        <footer className={`mt-20 py-10 border-t ${theme === 'dark' ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'} text-center text-xs`}>
          © 2026 GirokLabs. All rights reserved.
        </footer>
        {/* <BackupManager /> */}
      </div>
    </div>
  );
}

export default App;
