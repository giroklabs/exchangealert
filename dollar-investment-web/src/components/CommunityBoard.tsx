import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import {
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    doc,
    updateDoc,
    increment,
    Timestamp,
    arrayUnion
} from 'firebase/firestore';

interface Comment {
    id: string;
    author: string;
    content: string;
    createdAt: string;
}

interface Post {
    id: string;
    authorId: string;
    author: string;
    authorPhoto?: string;
    title: string;
    content: string;
    sentiment: 'up' | 'down' | 'neutral';
    reactions: { [key: string]: number };
    comments: Comment[];
    createdAt: any;
    date: string;
    tags: string[];
}

const SENTIMENT_LABELS = {
    up: { label: '상승 우세', icon: '📈', color: 'text-red-500', bg: 'bg-red-500/10' },
    down: { label: '하락 우세', icon: '📉', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    neutral: { label: '중립/보합', icon: '↔️', color: 'text-gray-500', bg: 'bg-gray-500/10' }
};

export const CommunityBoard: React.FC = () => {
    const { theme } = useTheme();
    const { user, login } = useAuth();
    const [posts, setPosts] = useState<Post[]>([]);
    const [isWriting, setIsWriting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [newPost, setNewPost] = useState<{ title: string; content: string; sentiment: 'up' | 'down' | 'neutral'; tags: string }>({
        title: '',
        content: '',
        sentiment: 'neutral',
        tags: ''
    });
    const [commentTexts, setCommentTexts] = useState<{ [postId: string]: string }>({});

    // Real-time Firestore sync
    useEffect(() => {
        const q = query(collection(db, 'community_posts'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedPosts = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: data.createdAt ? new Date(data.createdAt.seconds * 1000).toLocaleString('ko-KR', { hour12: false }).substring(0, 16) : '방금 전'
                } as Post;
            });
            setPosts(fetchedPosts);
            setLoading(false);
        }, (error) => {
            console.error("Firestore sync error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            alert('로그인이 필요한 기능입니다.');
            login();
            return;
        }
        if (!newPost.title || !newPost.content) return;

        try {
            await addDoc(collection(db, 'community_posts'), {
                authorId: user.uid,
                author: user.displayName || '익명',
                authorPhoto: user.photoURL || '',
                title: newPost.title,
                content: newPost.content,
                sentiment: newPost.sentiment,
                reactions: {},
                comments: [],
                tags: newPost.tags.split(' ').filter(t => t.startsWith('#')),
                createdAt: serverTimestamp()
            });

            setNewPost({ title: '', content: '', sentiment: 'neutral', tags: '' });
            setIsWriting(false);
        } catch (error) {
            console.error("Post creation error:", error);
            alert("글 등록에 실패했습니다. 다시 시도해 주세요.");
        }
    };

    const handleReaction = async (postId: string, emoji: string) => {
        if (!user) {
            alert('반응을 남기려면 로그인이 필요합니다.');
            login();
            return;
        }
        try {
            const postRef = doc(db, 'community_posts', postId);
            await updateDoc(postRef, {
                [`reactions.${emoji}`]: increment(1)
            });
        } catch (error) {
            console.error("Reaction error:", error);
        }
    };

    const handleAddComment = async (postId: string) => {
        const text = commentTexts[postId];
        if (!user) {
            alert('댓글을 달려면 로그인이 필요합니다.');
            login();
            return;
        }
        if (!text || !text.trim()) return;

        try {
            const postRef = doc(db, 'community_posts', postId);
            await updateDoc(postRef, {
                comments: arrayUnion({
                    id: Date.now().toString(),
                    author: user.displayName || '익명',
                    content: text,
                    createdAt: new Date().toISOString()
                })
            });
            setCommentTexts({ ...commentTexts, [postId]: '' });
        } catch (error) {
            console.error("Comment error:", error);
        }
    };

    const isDark = theme === 'dark';

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <div className={`w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 shadow-lg shadow-indigo-500/20`}></div>
                <p className={`${isDark ? 'text-gray-400' : 'text-gray-500'} font-bold`}>커뮤니티를 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-20">
            {/* 상단 통계/인사이드 섹션 */}
            <div className={`p-6 rounded-3xl border ${isDark ? 'bg-gray-900/40 border-gray-800' : 'bg-white border-gray-100'} shadow-sm flex justify-between items-center`}>
                <div>
                    <h2 className="text-xl font-bold mb-1">🗨️ 커뮤니티 인사이트</h2>
                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>투자자들의 실시간 환율 전망을 확인해 보세요.</p>
                </div>
                <button
                    onClick={() => {
                        if (!user) {
                            login();
                        } else {
                            setIsWriting(!isWriting);
                        }
                    }}
                    className={`px-5 py-2.5 rounded-xl font-bold transition-all ${isWriting
                        ? (isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600')
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-500/20'
                        }`}
                >
                    {!user ? '로그인하고 대화하기' : (isWriting ? '취소' : '글쓰기')}
                </button>
            </div>

            {/* 글쓰기 폼 */}
            {isWriting && user && (
                <form onSubmit={handleSubmit} className={`p-8 rounded-3xl border animate-in slide-in-from-top-4 duration-300 ${isDark ? 'bg-gray-900/60 border-gray-800' : 'bg-white border-gray-200'} shadow-xl`}>
                    <div className="space-y-4">
                        <div className="flex gap-4 items-center mb-6">
                            {(['up', 'down', 'neutral'] as const).map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setNewPost({ ...newPost, sentiment: s })}
                                    className={`flex-1 py-3 px-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-2 font-bold ${newPost.sentiment === s
                                        ? (s === 'up' ? 'border-red-500 bg-red-500/10 text-red-500' : s === 'down' ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-gray-500 bg-gray-500/10 text-gray-500')
                                        : (isDark ? 'border-gray-800 bg-gray-800/40 text-gray-400' : 'border-gray-100 bg-gray-50 text-gray-500')
                                        }`}
                                >
                                    <span className="text-xl">{SENTIMENT_LABELS[s].icon}</span>
                                    {SENTIMENT_LABELS[s].label}
                                </button>
                            ))}
                        </div>
                        <input
                            type="text"
                            placeholder="제목을 입력하세요"
                            value={newPost.title}
                            onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                            className={`w-full px-5 py-4 rounded-2xl border outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}
                            required
                        />
                        <textarea
                            placeholder="거시경제나 환율에 대한 의견을 자유롭게 나눠보세요..."
                            value={newPost.content}
                            onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                            className={`w-full h-40 px-5 py-4 rounded-2xl border outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}
                            required
                        />
                        <input
                            type="text"
                            placeholder="#태그를 입력하세요 (예: #달러 #엔화)"
                            value={newPost.tags}
                            onChange={e => setNewPost({ ...newPost, tags: e.target.value })}
                            className={`w-full px-5 py-4 rounded-2xl border outline-none ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-100'}`}
                        />
                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-10 rounded-2xl shadow-lg transition-all"
                            >
                                의견 등록하기
                            </button>
                        </div>
                    </div>
                </form>
            )}

            {/* 게시글 리스트 */}
            <div className="space-y-4">
                {posts.map(post => (
                    <div
                        key={post.id}
                        className={`p-6 rounded-3xl border transition-all hover:scale-[1.01] ${isDark ? 'bg-gray-900/40 border-gray-800 hover:bg-gray-900/60' : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'
                            }`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                {post.authorPhoto ? (
                                    <img src={post.authorPhoto} alt={post.author} className="w-10 h-10 rounded-full" />
                                ) : (
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white bg-gradient-to-br from-indigo-500 to-purple-600`}>
                                        {post.author[0]}
                                    </div>
                                )}
                                <div>
                                    <div className="font-bold">{post.author}</div>
                                    <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{post.date}</div>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${SENTIMENT_LABELS[post.sentiment].bg} ${SENTIMENT_LABELS[post.sentiment].color}`}>
                                <span>{SENTIMENT_LABELS[post.sentiment].icon}</span>
                                {SENTIMENT_LABELS[post.sentiment].label}
                            </div>
                        </div>

                        <h3 className="text-xl font-bold mb-3">{post.title}</h3>
                        <p className={`mb-4 whitespace-pre-wrap leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            {post.content}
                        </p>

                        {post.tags && post.tags.length > 0 && (
                            <div className="flex gap-2 mb-4">
                                {post.tags.map(tag => (
                                    <span key={tag} className={`text-xs px-2 py-1 rounded-lg ${isDark ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t border-gray-800/10">
                            <div className="flex gap-2">
                                {['🔥', '🤔', '🕯️', '🚀', '💰'].map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleReaction(post.id, emoji)}
                                        className={`px-3 py-1.5 rounded-xl border transition-all flex items-center gap-2 ${isDark ? 'border-gray-800 bg-gray-800/30 hover:bg-gray-800' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                                            }`}
                                    >
                                        <span>{emoji}</span>
                                        <span className="text-xs font-bold">{post.reactions?.[emoji] || 0}</span>
                                    </button>
                                ))}
                            </div>
                            <div className={`text-sm font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                댓글 {post.comments?.length || 0}개
                            </div>
                        </div>

                        {/* 댓글 섹션 */}
                        <div className="mt-6 space-y-4">
                            {post.comments && post.comments.length > 0 && (
                                <div className={`space-y-3 p-4 rounded-2xl ${isDark ? 'bg-gray-800/30' : 'bg-gray-50/50'}`}>
                                    {post.comments.map((c, idx) => (
                                        <div key={idx} className="text-sm flex gap-2 items-start">
                                            <span className="font-bold whitespace-nowrap">{c.author}</span>
                                            <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>{c.content}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 댓글 입력창 */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="따뜻한 댓글을 남겨주세요..."
                                    value={commentTexts[post.id] || ''}
                                    onChange={(e) => setCommentTexts({ ...commentTexts, [post.id]: e.target.value })}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                    className={`flex-1 px-4 py-2.5 rounded-xl border outline-none text-sm transition-all focus:ring-2 focus:ring-indigo-500/20 ${isDark ? 'bg-gray-800/50 border-gray-700 text-gray-200' : 'bg-gray-50 border-gray-100 text-gray-800'
                                        }`}
                                />
                                <button
                                    onClick={() => handleAddComment(post.id)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors"
                                >
                                    등록
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
