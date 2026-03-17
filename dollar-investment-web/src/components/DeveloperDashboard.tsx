import { useTheme } from '../contexts/ThemeContext';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar
} from 'recharts';

interface DeveloperDashboardProps {
    onClose: () => void;
}

const visitorData = [
    { name: 'Mon', count: 240 },
    { name: 'Tue', count: 320 },
    { name: 'Wed', count: 450 },
    { name: 'Thu', count: 580 },
    { name: 'Fri', count: 890 },
    { name: 'Sat', count: 1200 },
    { name: 'Sun', count: 980 },
];

const geminiUsageData = [
    { date: '03-11', cost: 0.12, requests: 45 },
    { date: '03-12', cost: 0.15, requests: 62 },
    { date: '03-13', cost: 0.28, requests: 120 },
    { date: '03-14', cost: 0.42, requests: 185 },
    { date: '03-15', cost: 0.38, requests: 154 },
    { date: '03-16', cost: 0.55, requests: 210 },
    { date: '03-17', cost: 0.15, requests: 85 }, // Today partial
];

export function DeveloperDashboard({ onClose }: DeveloperDashboardProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div 
                className={`w-full max-w-5xl h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl flex flex-col border animate-in zoom-in-95 duration-300 ${
                    isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-white'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`p-8 border-b flex justify-between items-center ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Developer Metrics</h2>
                            <p className="text-sm text-gray-500 font-medium">관리자 전용 대시보드 (v1.0)</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className={`p-3 rounded-2xl transition-all ${
                            isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                        }`}
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    {/* Stats Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            <p className="text-sm font-bold text-gray-500 mb-2">오늘 방문자 수</p>
                            <h3 className={`text-4xl font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>1,284</h3>
                            <div className="flex items-center gap-2 mt-2 text-xs font-bold text-green-500">
                                <span className="p-1 rounded bg-green-500/10">▲ 12.4%</span>
                                <span className="text-gray-400 font-medium">vs 어제</span>
                            </div>
                        </div>
                        <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            <p className="text-sm font-bold text-gray-500 mb-2">Gemini API 호출</p>
                            <h3 className={`text-4xl font-black ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>24,812</h3>
                            <div className="flex items-center gap-2 mt-2 text-xs font-bold text-purple-500">
                                <span className="p-1 rounded bg-purple-500/10">⚡ 100% Success</span>
                            </div>
                        </div>
                        <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            <p className="text-sm font-bold text-gray-500 mb-2">이번 달 예상 비용</p>
                            <h3 className={`text-4xl font-black ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>$12.45</h3>
                            <div className="flex items-center gap-2 mt-2 text-xs font-bold text-gray-400">
                                <span className="p-1 rounded bg-gray-500/10">Estimated</span>
                                <span className="font-medium">Total: $12.45</span>
                            </div>
                        </div>
                    </div>

                    {/* Charts Wrapper */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Visitor Status */}
                        <div className={`p-8 rounded-[2.5rem] border ${isDark ? 'bg-gray-800/30 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-8">
                                <h4 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>사용자 유입 현황</h4>
                                <span className="text-xs font-bold text-gray-500">최근 7일 기준</span>
                            </div>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={visitorData}>
                                        <defs>
                                            <linearGradient id="colorVisitor" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#f0f0f0'} />
                                        <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: isDark ? '#1f2937' : '#ffffff', 
                                                border: 'none', 
                                                borderRadius: '16px',
                                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                                color: isDark ? '#ffffff' : '#000000'
                                            }}
                                        />
                                        <Area type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorVisitor)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Gemini Usage Cost */}
                        <div className={`p-8 rounded-[2.5rem] border ${isDark ? 'bg-gray-800/30 border-gray-700' : 'bg-white border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-8">
                                <h4 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Gemini AI 사용 비용</h4>
                                <span className="text-xs font-bold text-gray-500">Google Cloud Console 기준</span>
                            </div>
                            <div className="h-[250px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={geminiUsageData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#374151' : '#f0f0f0'} />
                                        <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#9ca3af" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                                        <Tooltip 
                                            cursor={{fill: isDark ? '#374151' : '#f3f4f6', radius: 8}}
                                            contentStyle={{ 
                                                backgroundColor: isDark ? '#1f2937' : '#ffffff', 
                                                border: 'none', 
                                                borderRadius: '16px',
                                                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                                                color: isDark ? '#ffffff' : '#000000'
                                            }}
                                            formatter={(value) => [`$${value}`, 'Cost']}
                                        />
                                        <Bar dataKey="cost" fill="#fbbf24" radius={[6, 6, 0, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Status */}
                    <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-gray-800/20 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                        <div className="flex items-center gap-3">
                            <span className="flex h-3 w-3 rounded-full bg-green-500 animate-pulse"></span>
                            <span className={`text-sm font-bold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>시스템 정상 작동 중</span>
                            <span className="text-xs text-gray-500 ml-auto">Last update: {new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: ${isDark ? '#374151' : '#e5e7eb'};
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: ${isDark ? '#4b5563' : '#d1d5db'};
                }
            `}</style>
        </div>
    );
}
