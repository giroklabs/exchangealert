export interface FXHistoryData {
    date: string;
    rate: number;
    ma5: number | null;
    ma20: number | null;
    ma60: number | null;
}

export interface FXIntradayData {
    time: string;
    fullTime: string;
    rate: number;
    timestamp: number;
}

export async function fetchFXHistoryData(): Promise<FXHistoryData[]> {
    try {
        const timestamp = new Date().getTime();
        const url = `/data/fx-history.json?t=${timestamp}`;

        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error loading FX history data:', error);
        return [];
    }
}

export async function fetchFXIntradayData(): Promise<FXIntradayData[]> {
    try {
        const timestamp = new Date().getTime();
        const url = `/data/fx-intraday.json?t=${timestamp}`;

        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load intraday data');
        return await response.json();
    } catch (error) {
        console.error('Error loading FX intraday data:', error);
        return [];
    }
}
