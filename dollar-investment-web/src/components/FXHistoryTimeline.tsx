import { useTheme } from '../contexts/ThemeContext';

interface HistoryEvent {
    period: string;
    event: string;
    description: string;
    impact: 'high' | 'medium';
}

interface YearGroup {
    year: number;
    events: HistoryEvent[];
}

const HISTORY_DATA: YearGroup[] = [
    {
        year: 2026,
        events: [
            { period: '2026-03-13', event: '최근 환율 동향', description: '달러/원 약 1,490원대에서 거래, 최근 1개월간 원화 약 3% 이상 추가 약세, 1년 기준 약 2~3%대 절하 상태.', impact: 'high' },
            { period: '2026-01-29', event: '미 재무부 언급', description: '최근 원화 약세가 한국의 기초여건과 부합하지 않는 측면이 있다고 언급, 환율 수준에 대한 국제적 관심 표명.', impact: 'medium' }
        ]
    },
    {
        year: 2025,
        events: [
            { period: '2025-11', event: '1,500원선 근접', description: '원화 급격한 약세로 달러/원 1,500원선에 근접, 외국인 주식 순매도 확대·엔저 심화가 복합적으로 작용.', impact: 'high' },
            { period: '2025-상반기', event: '원화 실질실효환율 절하', description: '원화 실질실효환율이 2024년 대비 약 4%대 추가 절하, 대외적으로는 “과도한 약세” 우려 제기.', impact: 'medium' }
        ]
    },
    {
        year: 2024,
        events: [
            { period: '2024-연중', event: '원화 약세 연장', description: '2024년 전체 달러/원 환율은 전년 대비 약 +14% 수준 상승해 원화 약세 연장.', impact: 'high' },
            { period: '2024-04-16', event: '장중 1,400원 돌파', description: '미 금리인하 지연·중동 등 지정학적 긴장 고조로 달러/원 장중 1,400원 돌파, 당국 구두개입 및 매도 개입.', impact: 'high' }
        ]
    },
    {
        year: 2023,
        events: [
            { period: '2023-하반기', event: '고금리 장기화 인식 확산', description: '미 장기금리 급등과 “고금리 장기화” 인식 확산으로 달러 재강세, 원화 재약세, 1,300원 이상 재진입.', impact: 'medium' },
            { period: '2023-상반기', event: '위험자산 선호 회복', description: '미 인플레 둔화 기대와 중국 리오프닝 기대가 겹치며 달러 약세·원화 강세로 1,200원대 중반까지 하락.', impact: 'medium' }
        ]
    },
    {
        year: 2022,
        events: [
            { period: '2022-10-25', event: '금융위기 이후 최고점 (1,440원)', description: '글로벌 금융위기 이후 처음으로 1,440원 안팎까지 상승, 당국 구두개입 및 스무딩 오퍼레이션 강화.', impact: 'high' },
            { period: '2022-03~11', event: '미 연준 초고속 긴축', description: '연준의 잇따른 “자이언트·메가스텝” 인상, 달러지수 110 급등, 원화는 급격한 약세.', impact: 'high' }
        ]
    },
    {
        year: 2021,
        events: [
            { period: '2021-하반기', event: '달러 강세 재개', description: '연준의 테이퍼링 시사 및 인플레이션 우려로 달러 강세 재개, 달러/원 1,180~1,200원대로 상승.', impact: 'medium' },
            { period: '2021-08·11', event: '한국은행 기준금리 인상', description: '주요국 중 비교적 이른 시점에서 기준금리 인상 시작(0.5 → 1.0%), 상대적 원화 강세 요인.', impact: 'medium' }
        ]
    },
    {
        year: 2020,
        events: [
            { period: '2020-03~04', event: '달러 경색 완화', description: '미 연준의 무제한 양적완화로 달러 경색 완화, 위험자산 회복과 함께 원화 강세 전환.', impact: 'medium' },
            { period: '2020-03-19', event: '코로나 팬데믹 쇼크', description: '코로나19 팬데믹 공포, 글로벌 달러 유동성 경색으로 신흥국 통화 폭락, 1,290원대 급등.', impact: 'high' }
        ]
    },
    {
        year: 2019,
        events: [
            { period: '2019-07·10', event: '한은 기준금리 인하', description: '기준금리 인하(1.75 → 1.25%), 경기둔화 우려 속 원화에 약세 압력.', impact: 'medium' },
            { period: '2019-05~08', event: '미·중 무역분쟁 재격화', description: '위안화 7위안 돌파 이후 위안화·원화 동반 약세, 달러/원 1,200원 전후 테스트.', impact: 'high' }
        ]
    },
    {
        year: 2018,
        events: [
            { period: '2018-12', event: '연준 추가 금리인상', description: '글로벌 위험회피 심화로 신흥국 통화 약세, 달러/원 상단 압력 강화.', impact: 'medium' },
            { period: '2018-03~12', event: '미·중 무역분쟁 본격화', description: '달러 강세·위안화 약세에 연동되며 원화 변동성 확대, 달러/원 1,100원대 중후반으로 상향.', impact: 'high' }
        ]
    },
    {
        year: 2017,
        events: [
            { period: '2017-11-30', event: '한국은행 금리 인상', description: '기준금리 6년 만에 인상(1.25 → 1.50%), 원화 강세 요인으로 작용.', impact: 'medium' },
            { period: '2017-01~09', event: '글로벌 경기 회복', description: '위험선호로 신흥국 자금 재유입, 달러 약세와 맞물려 원화 강세 (1,100원 하회 구간 등장).', impact: 'medium' }
        ]
    },
    {
        year: 2016,
        events: [
            { period: '2016-11-09', event: '트럼프 당선 쇼크', description: '당선 직후 “트럼프 랠리”와 미 금리상승 기대로 신흥국 통화와 원화 동반 약세.', impact: 'high' },
            { period: '2016-01~02', event: '중국 경기둔화 우려', description: '위안화 절하 우려, 위험회피 확대로 원화 약세 심화, 달러/원 1,200원대 재상승.', impact: 'medium' }
        ]
    }
];

export function FXHistoryTimeline() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
            <header className="text-center space-y-2">
                <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    역대 환율 주요 이벤트 연혁
                </h2>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    2016년부터 현재까지 환율 시장을 흔든 결정적인 순간들
                </p>
            </header>

            <div className="relative space-y-12 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 dark:before:via-gray-700 before:to-transparent">
                {HISTORY_DATA.map((group) => (
                    <div key={group.year} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        {/* 연도 마커 */}
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 shadow-sm shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors duration-500 ${
                            isDark ? 'bg-gray-800 border-gray-600 text-yellow-400' : 'bg-white border-blue-100 text-blue-600'
                        }`}>
                            <span className="text-[11px] font-black">{group.year}</span>
                        </div>

                        {/* 카드 컨텐츠 */}
                        <div className={`w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 rounded-3xl border shadow-xl transition-all duration-300 hover:scale-[1.01] ${
                            isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-50'
                        }`}>
                            <div className="space-y-6">
                                {group.events.map((event, idx) => (
                                    <div key={idx} className={`relative ${idx > 0 ? 'pt-6 border-t border-dashed dark:border-gray-700' : ''}`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                                isDark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {event.period}
                                            </span>
                                            {event.impact === 'high' && (
                                                <span className="flex items-center gap-1.5 text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full inline-flex w-fit">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                                    HIGH IMPACT
                                                </span>
                                            )}
                                        </div>
                                        <h4 className={`text-[16px] font-black mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {event.event}
                                        </h4>
                                        <p className={`text-[13px] leading-relaxed font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            {event.description}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
