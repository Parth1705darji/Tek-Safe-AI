import { useAuth, UserButton, SignInButton, SignUpButton } from '@clerk/react';
import { Link } from 'react-router-dom';
import { Shield, Menu } from 'lucide-react';
import ThemeToggle from '../common/ThemeToggle';

interface HeaderProps {
  onMenuClick?: () => void;
  conversationTitle?: string;
}

const Header = ({ onMenuClick, conversationTitle }: HeaderProps) => {
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <header className="sticky top-0 z-50 flex h-16 w-full items-center border-b border-gray-200 bg-white/90 backdrop-blur-sm dark:border-gray-800 dark:bg-dark-bg/90">
      <div className="flex w-full items-center justify-between px-4">
        {/* Left — hamburger (mobile) + logo */}
        <div className="flex min-w-0 items-center gap-3">
          {/* Hamburger — only visible on mobile */}
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              aria-label="Toggle sidebar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}

          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-semibold text-primary dark:text-white"
          >
            <Shield className="h-5 w-5 text-accent" />
            <span className="hidden text-base sm:block">Tek-Safe AI</span>
          </Link>

          {/* Active conversation title — shown when a chat is open */}
          {conversationTitle && (
            <>
              <span className="hidden text-gray-300 dark:text-gray-600 md:block">/</span>
              <p
                className="hidden max-w-[200px] truncate text-sm font-medium text-gray-600 dark:text-gray-300 md:block lg:max-w-xs"
                title={conversationTitle}
              >
                {conversationTitle}
              </p>
            </>
          )}
        </div>

        {/* Right — theme toggle + auth */}
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />

          {!isLoaded ? (
            <div className="h-8 w-20 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
          ) : isSignedIn ? (
            <UserButton />
          ) : (
            <>
              <SignInButton mode="modal">
                <button className="rounded-[10px] px-4 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-gray-100 dark:text-white dark:hover:bg-gray-800">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="rounded-[10px] bg-primary px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90">
                  Sign Up
                </button>
              </SignUpButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
