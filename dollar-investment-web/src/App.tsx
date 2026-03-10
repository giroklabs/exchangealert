import { useState } from 'react';
import { InvestmentAnalysis } from './components/InvestmentAnalysis';
import { SevenSplitInvestment } from './components/SevenSplitInvestment';
import { AssetSplitInvestment } from './components/AssetSplitInvestment';
import { FXExchangeProfitTracker } from './components/FXExchangeProfitTracker';
import { MarketDashboard } from './components/MarketDashboard';
import { AboutPage } from './components/AboutPage';
import { Tabs } from './components/Tabs';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './contexts/ThemeContext';
import { UserProfile } from './components/UserProfile';
import { BackupManager } from './components/BackupManager';
import './App.css';

function App() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: '시장 대시보드', icon: '🌍' },
    { id: 'analysis', label: '투자적정성 분석', icon: '📊' },
    { id: 'sevensplit', label: '환율 스플릿', icon: '📈' },
    { id: 'asset-split', label: '자산 스플릿', icon: '🏦' },
    { id: 'fx-profit', label: '환차익 계산기', icon: '💰' },
    // { id: 'about', label: '소개', icon: '❓' }, // 임시 숨김 처리
  ];

  return (
    <div className={`min-h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0a0a0c] text-gray-100' : 'bg-gray-50 text-gray-900'}`}>
      {/* 헤더 */}
      <div className="max-w-6xl mx-auto px-4 pt-8">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2">
            <h1 className={`text-2xl font-black tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              달러 인베스트
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <UserProfile />
            <ThemeToggle />
          </div>
        </header>
      </div>

      {/* 전체 너비 탭바 */}
      <div className={`w-full border-b mb-8 ${theme === 'dark' ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-100'} shadow-sm`}>
        <div className="flex">
          <Tabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={tabs}
          />
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-6xl mx-auto px-4">
        <main className="transition-all duration-300">
          {activeTab === 'analysis' ? (
            <InvestmentAnalysis />
          ) : activeTab === 'sevensplit' ? (
            <SevenSplitInvestment />
          ) : activeTab === 'asset-split' ? (
            <AssetSplitInvestment />
          ) : activeTab === 'fx-profit' ? (
            <FXExchangeProfitTracker />
          ) : activeTab === 'about' ? (
            <AboutPage />
          ) : (
            <MarketDashboard />
          )}
        </main>

        <footer className={`mt-20 py-10 border-t ${theme === 'dark' ? 'border-gray-800 text-gray-500' : 'border-gray-100 text-gray-400'} text-center text-xs`}>
          © 2026 GirokLabs. All rights reserved.
        </footer>
        <BackupManager />
      </div>
    </div>
  );
}

export default App;
