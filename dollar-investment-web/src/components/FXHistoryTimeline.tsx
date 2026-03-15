import { useTheme } from '../contexts/ThemeContext';
import timelineImg from '../assets/images/usd_krw_history_timeline.png';

interface HistoryEvent {
    period: string;
    event: string;
    peakRate: string;
    description: string;
    impact: 'high' | 'medium';
}

const HISTORY_DATA: HistoryEvent[] = [
    {
        period: '2024년 4월',
        event: '강달러 체제 지속',
        peakRate: '1,400원',
        description: '미국 금리 인하 지연 기대 및 중동 지정학적 리스크 심화',
        impact: 'high'
    },
    {
        period: '2023년 3월',
        event: '미국 SVB 파산 사태',
        peakRate: '1,360원',
        description: '미국 지방은행 위기로 인한 안전자산(달러) 선호 현상',
        impact: 'medium'
    },
    {
        period: '2022년 10월',
        event: '미 연준 공격적 금리 인상',
        peakRate: '1,444원',
        description: '4회 연속 자이언트 스텝 및 러시아-우크라이나 전쟁 장기화',
        impact: 'high'
    },
    {
        period: '2020년 3월',
        event: 'COVID-19 팬데믹',
        peakRate: '1,290원',
        description: '전 세계 경제 폐쇄 공포로 인한 달러 인덱스 폭등',
        impact: 'high'
    },
    {
        period: '2019년 8월',
        event: '미·중 무역 전쟁 격화',
        peakRate: '1,220원',
        description: '양국 관세 보복 전쟁으로 인한 고환율 시대 진입',
        impact: 'medium'
    },
    {
        period: '2016년 2월',
        event: '중국 증시 폭락 및 유가 하락',
        peakRate: '1,240원',
        description: '중국발 경제 위기 우려 및 글로벌 경기 둔화',
        impact: 'medium'
    }
];

export function FXHistoryTimeline() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 상단 타임라인 이미지 */}
            <div className={`p-4 rounded-3xl shadow-2xl border overflow-hidden ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="relative group">
                    <img 
                        src={timelineImg} 
                        alt="USD/KRW 10-Year Timeline" 
                        className="w-full h-auto rounded-2xl transform transition-transform duration-500 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
                </div>
                <p className={`mt-4 text-center text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    📊 2014-2024 원/달러 환율 주요 변곡점 시각화 (인포그래픽)
                </p>
            </div>

            {/* 상세 내역 테이블 */}
            <div className={`rounded-3xl shadow-2xl border overflow-hidden ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className={`${isDark ? 'bg-gray-900/50' : 'bg-gray-50'}`}>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>연도 / 기간</th>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>주요 이벤트</th>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>환율 최고점</th>
                                <th className={`px-6 py-4 text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>시장 영향 및 배경</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-100'}`}>
                            {HISTORY_DATA.map((item, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-5 whitespace-nowrap">
                                        <span className={`text-sm font-bold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item.period}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2">
                                            {item.impact === 'high' && (
                                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                            )}
                                            <span className={`text-[15px] font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.event}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                        <span className={`text-lg font-black ${isDark ? 'text-yellow-400' : 'text-blue-600'}`}>{item.peakRate}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className={`text-sm leading-relaxed font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{item.description}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 정보 출처 */}
            <div className={`p-6 rounded-2xl flex items-center gap-4 ${isDark ? 'bg-gray-900/40 text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
                <span className="text-2xl">ℹ️</span>
                <p className="text-xs leading-relaxed font-medium">
                    본 데이터는 한국은행 경제통계시스템(ECOS) 및 인베스팅닷컴의 과거 환율 데이터를 바탕으로 작성되었습니다. <br />
                    환율 기록은 시장 상황에 따라 종가 또는 장중 최고가 기준으로 일부 차이가 있을 수 있습니다.
                </p>
            </div>
        </div>
    );
}
