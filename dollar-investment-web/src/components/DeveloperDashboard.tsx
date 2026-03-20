import { useEffect, useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { getVisitorStats, getTotalVisitorCount } from '../services/analyticsService';
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

interface BillingData {
    lastUpdate: string;
    projectId: string;
    totalCostMonth: number;
    history: { date: string; cost: number; requests: number }[];
}

export function DeveloperDashboard({ onClose }: DeveloperDashboardProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [visitorData, setVisitorData] = useState<{ name: string; count: number; date: string }[]>([]);
    const [totalVisitors, setTotalVisitors] = useState(0);
    const [billingData, setBillingData] = useState<BillingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadMetrics() {
            try {
                // billing.json 파일은 GitHub Action에 의해 생성됨
                const billingResponse = await fetch(`${import.meta.env.BASE_URL}data/billing.json?t=${Date.now()}`).catch(() => null);
                const billingJson = billingResponse && billingResponse.ok ? await billingResponse.json() : null;

                const [stats, total] = await Promise.all([
                    getVisitorStats(7),
                    getTotalVisitorCount()
                ]);
                
                setVisitorData(stats);
                setTotalVisitors(total);
                if (billingJson) setBillingData(billingJson);
            } catch (error) {
                console.error("Failed to load metrics:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadMetrics();
    }, []);

    // 오늘 방문자 및 어제 대비 증가율 계산
    const todayVisitorCount = visitorData.length > 0 ? visitorData[visitorData.length - 1].count : 0;
    const yesterdayVisitorCount = visitorData.length > 1 ? visitorData[visitorData.length - 2].count : 0;
    const visitorChange = yesterdayVisitorCount > 0 
        ? ((todayVisitorCount - yesterdayVisitorCount) / yesterdayVisitorCount * 100).toFixed(1)
        : '0';
    const isIncrease = parseFloat(visitorChange) >= 0;

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
                            <h3 className={`text-4xl font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                {isLoading ? '...' : todayVisitorCount.toLocaleString()}
                            </h3>
                            <div className={`flex items-center gap-2 mt-2 text-xs font-bold ${isIncrease ? 'text-green-500' : 'text-red-500'}`}>
                                <span className={`p-1 rounded ${isIncrease ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                                    {isIncrease ? '▲' : '▼'} {Math.abs(parseFloat(visitorChange))}%
                                </span>
                                <span className="text-gray-400 font-medium">vs 어제</span>
                            </div>
                        </div>
                        <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            <p className="text-sm font-bold text-gray-500 mb-2">Gemini 사용 비용 (당월)</p>
                            <h3 className={`text-4xl font-black ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                 {billingData?.totalCostMonth !== undefined ? `$${billingData.totalCostMonth.toFixed(2)}` : '$0.00'}
                            </h3>
                            <div className="flex items-center gap-2 mt-2 text-xs font-bold text-purple-500">
                                <span className="p-1 rounded bg-purple-500/10">⚡ Google Cloud Billing</span>
                            </div>
                        </div>
                        <div className={`p-6 rounded-[2rem] border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                            <p className="text-sm font-bold text-gray-500 mb-2">누적 방문자 수</p>
                            <h3 className={`text-4xl font-black ${isDark ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                {isLoading ? '...' : totalVisitors.toLocaleString()}
                            </h3>
                            <div className="flex items-center gap-2 mt-2 text-xs font-bold text-gray-400">
                                <span className="p-1 rounded bg-gray-500/10">All Time</span>
                                <span className="font-medium">Total Visitors</span>
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
                                    <BarChart data={billingData?.history || []}>
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
                            <span className="text-xs text-gray-500 ml-auto">Last update: {billingData?.lastUpdate ? new Date(billingData.lastUpdate).toLocaleString('ko-KR') : 'Loading...'}</span>
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
