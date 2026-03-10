export function AboutPage() {
    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header Section */}
            <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4 mb-6">
                    <span className="text-4xl">👋</span>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white">달러 인베스트 소개</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            데이터 기반의 효율적이고 안전한 달러 투자 여정을 함께합니다.
                        </p>
                    </div>
                </div>

                <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                    <strong>달러 인베스트</strong>는 박성현 작가의 '스플릿(7 Split)' 투자 철학에 영감을 받아 제작된
                    개인 맞춤형 달러 투자 및 자산 관리 플랫폼입니다. 사용자들은 거시 경제 지표를 실시간으로 확인하고,
                    AI 분석을 통해 투자 적정성을 판단하며, 시스템화된 분할 매수/매도 기법을 통해 안정적인 수익을 창출할 수 있습니다.
                </p>
            </div>

            {/* Core Features */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FeatureCard
                    icon="📊"
                    title="시장 대시보드 & AI 분석"
                    desc="FRED(미 연준), ECOS(한국은행), 야후 파이낸스의 실시간 지표를 종합하여 환율 흐름을 분석하고, Gemini AI가 향후 방향성을 예측합니다."
                />
                <FeatureCard
                    icon="🏦"
                    title="스플릿 & 자산투자"
                    desc="금액을 분할하여 투자하는 시스템을 제공합니다. 사용자의 투자 성향에 맞게 슬롯을 분할하고 목표 수익률에 도달하면 자동으로 매도 알림을 받을 수 있습니다."
                />
                <FeatureCard
                    icon="💰"
                    title="환차익 계산기"
                    desc="투자 금액, 평균 단가, 목표 환율을 입력하여 예상되는 환차익(비과세 혜택 포함)을 한눈에 시뮬레이션 할 수 있습니다."
                />
                <FeatureCard
                    icon="🛡️"
                    title="GitHub 클라우드 백업"
                    desc="사용자의 소중한 투자 데이터를 본인의 GitHub 저장소에 안전하게 백업 및 동기화하여 언제 어디서든 접근하고 복구할 수 있습니다."
                />
            </div>

            {/* Info Section */}
            <div className="bg-gray-100 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 mt-8">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white dark:text-blue-300 mb-3 flex items-center gap-2">
                    <span>💡</span> 투자 유의사항 및 면책 조항
                </h3>
                <ul className="text-xs text-gray-800 dark:text-gray-200 dark:text-gray-500 dark:text-gray-400 space-y-2 leading-relaxed">
                    <li>• 본 사이트에서 제공하는 환율 예측, 시장 지표, AI 분석 결과는 <strong>참고용 정보</strong>일 뿐입니다.</li>
                    <li>• 야후 파이낸스의 일부 실시간 데이터 및 FRED 지표는 수집 시점에 따라 실제 시장가와 미세한 차이나 지연이 있을 수 있습니다.</li>
                    <li>• 모든 투자의 최종 결정과 그에 따른 결과는 투자자 본인에게 책임이 귀속됩니다.</li>
                    <li>• 개인의 데이터는 브라우저 로컬 저장소 및 사용자의 GitHub 계정에만 안전하게 저장되며, 별도의 중앙 서버로 수집되지 않습니다.</li>
                </ul>
            </div>

            <div className="text-center pt-8 border-t border-gray-200 dark:border-gray-800 mt-8">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Made with ❤️ by GirokT (기록연구소)<br />
                    Powered by React, Tailwind CSS, Google Gemini, and GitHub Actions
                </p>
                <a
                    href="https://github.com/giroklabs/exchangealert"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-bold transition-colors"
                >
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                    GitHub Project
                </a>
            </div>
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow">
            <div className="text-3xl mb-3">{icon}</div>
            <h3 className="font-black text-gray-900 dark:text-white mb-2">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
        </div>
    );
}
