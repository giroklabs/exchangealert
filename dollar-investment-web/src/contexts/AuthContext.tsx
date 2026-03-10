import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, loginWithGoogle, logout } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    userDataLoaded: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [userDataLoaded, setUserDataLoaded] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                // 로그인 시 Firestore에서 데이터 가져와서 localStorage에 병합/덮어쓰기
                try {
                    const docRef = doc(db, 'users', currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        Object.keys(data).forEach(key => {
                            if (key !== 'lastUpdated') {
                                localStorage.setItem(key, JSON.stringify(data[key]));
                            }
                        });
                    } else {
                        // 최초 로그인 시 로컬 스토리지에 있는 데이터를 Firestore에 동기화
                        const localData: Record<string, any> = {};
                        const keysToSync = ['seven-split-settings', 'seven-split-slots', 'asset-investments-v2', 'fx-investments'];

                        keysToSync.forEach(key => {
                            const item = localStorage.getItem(key);
                            if (item) {
                                try {
                                    localData[key] = JSON.parse(item);
                                } catch (e) {
                                    console.error("Parse error for key", key);
                                }
                            }
                        });

                        if (Object.keys(localData).length > 0) {
                            localData.lastUpdated = new Date().toISOString();
                            await setDoc(docRef, localData);
                        }
                    }
                } catch (error) {
                    console.error("데이터 동기화 실패:", error);
                }
            } else {
                // 로그아웃 시 필요하다면 localStorage를 초기화하거나 유지 (여기서는 유지)
            }
            setUserDataLoaded(true);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async () => {
        try {
            await loginWithGoogle();
        } catch (error: any) {
            console.error('로그인 실패:', error);
            alert(`로그인 중 문제가 발생했습니다: ${error.message || '알 수 없는 오류'}\nFirebase 콘솔의 승인된 도메인 설정을 확인해주세요.`);
        }
    };

    const logoutUser = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout: logoutUser, userDataLoaded }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
