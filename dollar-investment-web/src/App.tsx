import { InvestmentAnalysis } from './components/InvestmentAnalysis';
import { ThemeToggle } from './components/ThemeToggle';
import { useTheme } from './contexts/ThemeContext';
import './App.css';

function App() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen transition-colors ${theme === 'dark' ? 'bg-black' : 'bg-green-50'}`}>
      <ThemeToggle />
      <InvestmentAnalysis />
      </div>
  );
}

export default App;
