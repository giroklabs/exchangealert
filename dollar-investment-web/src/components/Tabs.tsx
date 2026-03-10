import { useTheme } from '../contexts/ThemeContext';

interface TabsProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    tabs: { id: string; label: string; icon?: string }[];
}

export function Tabs({ activeTab, onTabChange, tabs }: TabsProps) {
    const { theme } = useTheme();

    return (
        <div className="flex justify-center mb-8">
            <div className={`inline-flex p-1 rounded-2xl ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'
                } shadow-lg border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-100'}`}>
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 ${activeTab === tab.id
                            ? (theme === 'dark' ? 'bg-gray-100 text-gray-900 shadow-md' : 'bg-black text-white shadow-md')
                            : (theme === 'dark' ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100')
                            }`}
                    >
                        {tab.icon && <span>{tab.icon}</span>}
                        {tab.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
