import React, { useRef, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { 
  BarChart2, 
  ArrowDownUp, 
  PieChart, 
  Calculator, 
  Newspaper, 
  Users, 
  History, 
  LayoutDashboard 
} from 'lucide-react';

interface Tab {
  id: string;
  label: string;
}

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  tabs: Tab[];
}

// 아이콘 매핑
const getIcon = (id: string, className: string) => {
  switch (id) {
    case 'dashboard': return <LayoutDashboard className={className} />;
    case 'analysis': return <BarChart2 className={className} />;
    case 'sevensplit': return <ArrowDownUp className={className} />;
    case 'asset-split': return <PieChart className={className} />;
    case 'fx-profit': return <Calculator className={className} />;
    case 'news': return <Newspaper className={className} />;
    case 'community': return <Users className={className} />;
    case 'history': return <History className={className} />;
    default: return <LayoutDashboard className={className} />;
  }
};

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onTabChange, tabs }) => {
  const { theme } = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);

  // 활성 탭이 바뀔 때 스크롤 중앙 정렬
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]') as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab]);

  return (
    <div className={`md:hidden fixed bottom-0 left-0 right-0 z-50 border-t pb-safe pointer-events-auto shadow-lg backdrop-blur-lg ${
      theme === 'dark' 
        ? 'bg-[#0a0a0c]/80 border-gray-800' 
        : 'bg-white/80 border-gray-200'
    }`}>
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto overscroll-x-contain hide-scrollbar px-2 py-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-active={isActive}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center min-w-[72px] flex-shrink-0 snap-center px-1 transition-colors duration-200 ${
                isActive 
                  ? (theme === 'dark' ? 'text-blue-400' : 'text-blue-600') 
                  : (theme === 'dark' ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600')
              }`}
            >
              <div className={`p-1.5 rounded-2xl mb-1 transition-all duration-300 ${
                isActive && theme === 'dark' ? 'bg-blue-500/10' : 
                isActive && theme !== 'dark' ? 'bg-blue-50' : 'bg-transparent'
              }`}>
                {getIcon(tab.id, `w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`)}
              </div>
              <span className={`text-[10px] tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
