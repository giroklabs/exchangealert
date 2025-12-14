import { useTheme } from '../contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`fixed top-4 right-4 z-50 p-3 rounded-full shadow-lg transition-colors ${
        theme === 'dark'
          ? 'bg-gray-800 hover:bg-gray-700'
          : 'bg-white hover:bg-gray-100 border border-gray-200'
      }`}
      aria-label="테마 전환"
    >
      {theme === 'dark' ? (
        <span className="text-2xl">☀️</span>
      ) : (
        <span className="text-2xl">🌙</span>
      )}
    </button>
  );
}

