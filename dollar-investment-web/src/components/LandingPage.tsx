import React from 'react';
import { 
  Database, 
  Sparkles, 
  Compass, 
  Activity, 
  TrendingUp, 
  BarChart3, 
  Calendar, 
  Search, 
  Send,
  ArrowRight
} from 'lucide-react';
import '../LandingPage.css';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="landing-container">
      {/* Background Decor (Gold Glow) */}
      <div className="bg-glow" style={{ top: '-10%;', left: '-10%', background: 'radial-gradient(circle, rgba(251, 191, 36, 0.08) 0%, rgba(251, 191, 36, 0) 70%)' }} />
      <div className="bg-glow" style={{ bottom: '15%', right: '-5%', background: 'radial-gradient(circle, rgba(251, 191, 36, 0.06) 0%, rgba(251, 191, 36, 0) 70%)' }} />

      {/* Hero Section */}
      <section className="hero-section">
        <div className="badge animate-up">
          달러인베스트.pro
        </div>
        
        <h1 className="hero-title animate-up" style={{ animationDelay: '0.1s' }}>
          투자의 품격을 높이는 <br />
          <span className="gradient-text">단 하나의 환율 대시보드</span>
        </h1>
        
        <p className="hero-subtitle animate-up" style={{ animationDelay: '0.2s' }}>
          실시간 지표 동기화와 AI 분석 엔진의 조화. <br />
          이제 복잡한 환율 변동 속에서 흔들리지 않는 당신만의 투자 원칙을 세우세요.
        </p>
        
        <div className="cta-group animate-up" style={{ animationDelay: '0.3s' }}>
          <button className="btn-primary" onClick={onStart}>
            데이터 분석 시작하기
            <ArrowRight className="w-5 h-5 ml-2" strokeWidth={3} />
          </button>
          <button 
            className="btn-secondary" 
            onClick={() => document.getElementById('philosophy-section')?.scrollIntoView({ behavior: 'smooth' })}
          >
            주요 지표 둘러보기
          </button>
        </div>
      </section>

      {/* Philosophy Section */}
      <section id="philosophy-section" className="py-32 px-6 border-t border-white/5">
        <div className="section-title-group">
          <span className="section-label">Our Philosophy</span>
          <h2 className="section-main-title">가장 정교한 데이터가 <br />가장 안전한 수익을 만듭니다</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
           {[
             { title: '데이터의 투명성', desc: '한국은행 ECOS와 KIS API로부터 1분 단위로 가장 정밀한 환율 데이터를 가져옵니다.', icon: Database },
             { title: 'AI 기반 인사이트', desc: 'Gemini 1.5 Pro 모델이 수만 건의 뉴스와 지표를 실시간 분석해 최적의 시뮬레이션을 제공합니다.', icon: Sparkles },
             { title: '투자 원칙의 수립', desc: '단순한 정보를 넘어 7분할 투자법 등 검증된 전략을 시각적으로 가이드합니다.', icon: Compass }
           ].map((item, idx) => (
             <div key={idx} className="feature-card animate-up" style={{ animationDelay: `${0.4 + idx*0.1}s` }}>
               <div className="icon-box group-hover:scale-110 transition-transform duration-500">
                 <item.icon className="w-8 h-8 text-slate-800" strokeWidth={1.5} />
               </div>
               <h3 className="feature-name">{item.title}</h3>
               <p className="feature-desc">{item.desc}</p>
             </div>
           ))}
        </div>
      </section>

      {/* Advanced Features */}
      <section className="py-32 bg-white/[0.01]">
        <div className="section-title-group">
          <span className="section-label">Advanced Tools</span>
          <h2 className="section-main-title">전문가를 위한 올인원 솔루션</h2>
        </div>

        <div className="feature-grid">
          {[
            { title: '실시간 시장 모니터', desc: '환율, KOSPI, 미국 국채 지수 등 핵심 지표를 하나의 화면에서 제어하세요.', icon: Activity },
            { title: 'AI 퀀트 시황 분석', desc: '뉴스와 지표의 상관관계를 분석해 투자 위험 신호를 실시간으로 탐지합니다.', icon: TrendingUp },
            { title: '자산 분배 트래커', desc: '환차익과 투자 가중치를 자동으로 계산해 자산 현황을 시각화합니다.', icon: BarChart3 },
            { title: '글로벌 경제 캘린더', desc: '주요국의 금리 결정과 경제 지표 발표 일정을 실시간으로 수집합니다.', icon: Calendar },
            { title: '뉴스 인텔리전스', desc: '수백 개의 뉴스 소스에서 환율에 직접적인 영향을 주는 키워드만 선별합니다.', icon: Search },
            { title: '텔레그램 채널 [달러인베스트]', desc: '주요 지표와 시황 분석 결과를 텔레그램 알림으로 실시간 전송합니다.', icon: Send }
          ].map((feature, idx) => (
             <div key={idx} className="feature-card group cursor-default">
               <div className="icon-box group-hover:bg-amber-500/10 transition-colors duration-500">
                 <feature.icon className="w-8 h-8 text-slate-800" strokeWidth={1.5} />
               </div>
               <h3 className="feature-name">{feature.title}</h3>
               <p className="feature-desc">{feature.desc}</p>
             </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer-section">
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center text-gray-400 text-sm">
          <div className="font-black tracking-tighter text-slate-900">GIROK Labs.</div>
          <div className="flex gap-8 font-medium">
            <a href="https://t.me/dollar_invest_pro" target="_blank" rel="noopener noreferrer" className="hover:text-amber-500 transition-colors flex items-center gap-2">
              <Send className="w-4 h-4" />
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
