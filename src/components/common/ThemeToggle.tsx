import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle dark mode"
      className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-all duration-200 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5 rotate-0 transition-transform duration-300" />
      ) : (
        <Moon className="h-5 w-5 rotate-0 transition-transform duration-300" />
      )}
    </button>
  );
};

export default ThemeToggle;
