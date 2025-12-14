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
    gapRatioAboveAverage: boolean;
    rateBelowAppropriate: boolean;
  };
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

