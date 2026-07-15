import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export function useSyncState<T>(key: string, initialValue: T | (() => T)): [T, (val: T | ((prev: T) => T)) => void] {
    const { user, userDataLoaded } = useAuth();

    // 1. 초기 상태 불러오기 (localStorage 우선)
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (item) return JSON.parse(item);
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
        }
        return initialValue instanceof Function ? initialValue() : initialValue;
    });

    // 2. Auth 상태가 변경되어 Firestore 데이터가 로드되었을 때 상태 업데이트
    useEffect(() => {
        if (userDataLoaded) {
            try {
                const item = window.localStorage.getItem(key);
                if (item) {
                    setState(JSON.parse(item));
                }
            } catch (error) {
                console.warn(`Error updating state after auth load for key "${key}":`, error);
            }
        }
    }, [userDataLoaded, key]);

    // 3. 상태 변경 시 localStorage와 Firestore 동시 쓰기
    const setSyncState = (value: T | ((val: T) => T)) => {
        try {
            const valueToStore = value instanceof Function ? value(state) : value;
            setState(valueToStore);

            const now = new Date().toISOString();

            // LocalStorage 저장
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
            window.localStorage.setItem(`${key}_lastUpdated`, now);

            // Firestore 저장 (로그인 되어있는 경우)
            if (user && db) {
                const docRef = doc(db, 'users', user.uid);
                // merge: true로 부분 업데이트 처리
                setDoc(docRef, {
                    [key]: valueToStore,
                    [`${key}_lastUpdated`]: now, // 개별 항목별 업데이트 시간 기록
                    lastUpdated: now
                }, { merge: true }).catch(err => console.error("Firestore sync failed:", err));
            }
        } catch (error) {
            console.warn(`Error setting state for key "${key}":`, error);
        }
    };

    return [state, setSyncState];
}
