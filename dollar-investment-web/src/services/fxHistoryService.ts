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
        const url = import.meta.env.DEV
            ? '/exchangealert/data/fx-history.json'
            : 'https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/fx-history.json';

        const response = await fetch(url);
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
        const url = import.meta.env.DEV
            ? '/exchangealert/data/fx-intraday.json'
            : 'https://raw.githubusercontent.com/giroklabs/exchangealert/main/data/fx-intraday.json';

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load intraday data');
        return await response.json();
    } catch (error) {
        console.error('Error loading FX intraday data:', error);
        return [];
    }
}
