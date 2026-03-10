import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export function UserProfile() {
    const { user, login, logout, loading } = useAuth();
    const { theme } = useTheme();

    if (loading) {
        return <div className={`h-10 w-24 rounded-full animate-pulse ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-200'}`}></div>;
    }

    return (
        <div className="flex items-center gap-4">
            {user ? (
                <div className="flex items-center gap-3">
                    <img
                        src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`}
                        alt="Profile"
                        className="w-8 h-8 rounded-full border border-gray-200"
                    />
                    <div className="hidden sm:block text-sm">
                        <p className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{user.displayName}</p>
                    </div>
                    <button
                        onClick={logout}
                        className={`text-sm px-4 py-2 rounded-full font-medium transition-colors ${theme === 'dark'
                            ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                            : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 shadow-sm'
                            }`}
                    >
                        로그아웃
                    </button>
                </div>
            ) : (
                <button
                    onClick={login}
                    className={`flex items-center gap-2 text-sm px-5 py-2 rounded-full font-bold transition-all shadow-sm ${theme === 'dark'
                        ? 'bg-yellow-400 hover:bg-yellow-300 text-gray-900' : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                        }`}
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google 로그인
                </button>
            )}
        </div>
    );
}
