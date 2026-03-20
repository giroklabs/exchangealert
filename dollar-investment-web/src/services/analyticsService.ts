import { db } from '../firebase';
import { doc, setDoc, updateDoc, increment, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export async function trackVisitor() {
    try {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const visitorStorageKey = `visitor_counted_${today}`;
        
        // 오늘 이미 집계된 경우 중복 집계 방지 (로컬 스토리지 기준)
        if (localStorage.getItem(visitorStorageKey)) {
            return;
        }

        const docRef = doc(db, 'analytics', `visitors_${today}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            await updateDoc(docRef, {
                count: increment(1),
                lastUpdated: new Date().toISOString()
            });
        } else {
            await setDoc(docRef, {
                date: today,
                count: 1,
                lastUpdated: new Date().toISOString()
            });
        }

        // 전체 카운트 업데이트
        const totalRef = doc(db, 'analytics', 'total_stats');
        const totalSnap = await getDoc(totalRef);
        if (totalSnap.exists()) {
            await updateDoc(totalRef, {
                totalVisitors: increment(1)
            });
        } else {
            await setDoc(totalRef, {
                totalVisitors: 1
            });
        }

        localStorage.setItem(visitorStorageKey, 'true');
    } catch (error) {
        console.error('❌ Visitor tracking failed:', error);
    }
}

export async function getVisitorStats(days: number = 7) {
    try {
        const analyticsRef = collection(db, 'analytics');
        // visitors_ 로 시작하는 문서들을 날짜순으로 가져옴
        const q = query(analyticsRef, orderBy('date', 'desc'), limit(days));
        const querySnapshot = await getDocs(q);
        
        const stats: { name: string; count: number; date: string }[] = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.date && data.count !== undefined) {
                // 그래프 표시용 (Mon, Tue 등)
                const dateObj = new Date(data.date);
                const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                stats.push({
                    name: dayName,
                    count: data.count,
                    date: data.date
                });
            }
        });
        
        return stats.reverse(); // 시간순 정렬
    } catch (error) {
        console.error('❌ Failed to fetch visitor stats:', error);
        return [];
    }
}

export async function getTotalVisitorCount() {
    try {
        const totalRef = doc(db, 'analytics', 'total_stats');
        const totalSnap = await getDoc(totalRef);
        return totalSnap.exists() ? totalSnap.data().totalVisitors : 0;
    } catch (error) {
        console.error('Failed to fetch total visitor count:', error);
        return 0;
    }
}
