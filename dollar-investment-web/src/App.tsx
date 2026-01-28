import { useState } from 'react';
import { InvestmentAnalysis } from './components/InvestmentAnalysis';
import { SevenSplitInvestment } from './components/SevenSplitInvestment';
import { Tabs } from './components/Tabs';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './contexts/ThemeContext';
import './App.css';

function App() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('analysis');

  const tabs = [
    { id: 'analysis', label: '투자적정성 분석', icon: '📊' },
    { id: 'sevensplit', label: '세븐스플릿 투자', icon: '📈' },
  ];

  return (
    <div className={`min-h-screen transition-colors duration-500 py-8 ${theme === 'dark' ? 'bg-[#0a0a0c] text-white' : 'bg-gradient-to-br from-green-50 to-blue-50'
      }`}>
      <div className="max-w-6xl mx-auto px-4">
        <header className="flex justify-end mb-4">
          <ThemeToggle />
        </header>

        <Tabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={tabs}
        />

        <main className="transition-all duration-300">
          {activeTab === 'analysis' ? (
            <InvestmentAnalysis />
          ) : (
            <SevenSplitInvestment />
          )}
        </main>

        <footer className={`mt-20 pb-10 text-center text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
          }`}>
          © 2026 Dollar Invest. 무단 전재 및 재배포 금지.
        </footer>
      </div>
    </div>
  );
}

export default App;
