import { useTheme } from '../contexts/ThemeContext';

interface TabsProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    tabs: { id: string; label: string; icon?: string }[];
}

export function Tabs({ activeTab, onTabChange, tabs }: TabsProps) {
    const { theme } = useTheme();

    return (
        <div className={`w-full flex overflow-hidden rounded-2xl shadow-sm border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 font-bold transition-all duration-300 border-b-4 ${activeTab === tab.id
                        ? 'border-yellow-400 text-gray-900 dark:text-white bg-yellow-400/10'
                        : (theme === 'dark'
                            ? 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
                            : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50')
                        }`}
                >
                    {tab.icon && <span>{tab.icon}</span>}
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
