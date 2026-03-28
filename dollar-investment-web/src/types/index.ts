// 환율 데이터 타입
export interface ExchangeRate {
  result: number;
  cur_unit: string;
  ttb: string;
  tts: string;
  deal_bas_r: string;
  bkpr: string;
  yy_efee_r: string;
  ten_dd_efee_r: string;
  kftc_bkpr: string;
  kftc_deal_bas_r: string;
  cur_nm: string;
}

// 달러 지수 데이터 타입
export interface DollarIndexData {
  date: string;
  current: number;
  history: Array<{
    date: string;
    value: number;
  }>;
  "52week": {
    low: number;
    high: number;
    average: number;
  };
}

// 52주 평균 데이터 타입
export interface WeeklyAverageData {
  date: string;
  exchangeRate: {
    low: number;
    high: number;
    average: number;
  };
  dollarIndex: {
    low: number;
    high: number;
    average: number;
  };
  gapRatio: {
    average: number;
  };
}

// 투자 신호 타입
export interface InvestmentSignal {
  isSuitable: boolean;
  conditions: {
    rateBelowAverage: boolean;
    dollarIndexBelowAverage: boolean;
    gapRatioBelowAverage: boolean;
    rateBelowAppropriate: boolean;
  };
  score: number;
  appropriateRate: number;
  currentGapRatio: number;
  averageGapRatio: number;
}

// 계산 결과 타입
export interface CalculationResult {
  low: number;
  high: number;
  average: number;
}

// 스플릿 데이터 타입
export interface SevenSplitSlot {
  number: number;
  isActive: boolean;
  buyPrice: number | null;
  amount: number; // 매수 환전액 (USD)
  krwAmount: number; // 투자 원금 (KRW)
  targetPrice: number | null;
  buyDate?: string;
  currentProfit?: number;
  currentRoi?: number;
}

export interface SevenSplitSettings {
  totalBudget: number;
  gapWon: number;
  targetProfitPercent: number;
  baseExchangeRate: number;
  splitCount: number; // 분할 횟수
}

export interface FXInvestment {
  id: string;
  date: string;
  usdAmount: number;
  buyRate: number;
  sellRate: number | null;
  sellDate: string | null;
  status: 'holding' | 'sold';
  memo: string;
}

export interface MarketIndicator {
  id: string;
  name: string;
  category?: 'domestic' | 'international';
  block?: string;
  value: string | number;
  unit: string;
  trend: 'up' | 'down' | 'neutral';
  impact: 'up' | 'down' | 'neutral'; // Impact on Exchange Rate (USD/KRW)
  realizedImpact?: 'up' | 'down' | 'neutral'; // Current realized direction
  description: string;
  source?: string;
  history?: Array<{ date: string; value: number }>;
}

export interface MajorRate {
  id: string;
  symbol?: string;
  name: string;
  unit: string;
  flag: string;
  value: string;
  change: string;
  changePercent: string;
  trend: 'up' | 'down' | 'neutral';
  is100Yen?: boolean;
}

export interface TrackedStock {
  id: string;
  symbol: string;
  name: string;
  enName: string;
  price: number;
  changePercent: string;
  trend: 'up' | 'down' | 'neutral';
}

export interface DashboardData {
  indicators: MarketIndicator[];
  majorRates?: MajorRate[];
  stockPrices?: TrackedStock[];
  forecast?: {
    sentiment: string;
    upProb: number;
    downProb: number;
    kospiUpProb?: number;
    kospiDownProb?: number;
    aiAnalysis: string;
    lastAiUpdate?: number;
    score: { upScore: number; downScore: number; kospiScore?: { up: number; down: number } };
  };
  lastUpdate: string;
}

// 자산 투자 데이터 타입
export interface AssetSplitSlot {
  number: number;
  isActive: boolean;
  buyPrice: number | null;
  quantity: number;
  investedAmount: number;
  targetPrice: number | null;
  buyDate?: string;
}

export interface AssetSplitSettings {
  assetName: string;
  totalBudget: number;
  gapPercent: number;
  targetProfitPercent: number;
  basePrice: number;
  splitCount: number; // 분할 횟수 (예: 5, 6, 7)
}

export interface AssetInvestment {
  id: string;
  settings: AssetSplitSettings;
  slots: AssetSplitSlot[];
  lastPrice: number;
}

// 통합 백업 데이터 타입
export interface UserBackupData {
  version: string;
  timestamp: string;
  fxInvestments: FXInvestment[];
  assetInvestments: AssetInvestment[];
  sevenSplitSettings?: SevenSplitSettings;
  sevenSplitSlots?: SevenSplitSlot[];
}

// GitHub 동기화 정보 타입
export interface GitHubSyncInfo {
  pat: string;
  owner: string;
  repo: string;
  filePath: string;
  lastSync?: string;
}
