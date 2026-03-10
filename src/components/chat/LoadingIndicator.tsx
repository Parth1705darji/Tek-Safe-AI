import { Shield } from 'lucide-react';

const LoadingIndicator = () => {
  return (
    <div className="flex items-start gap-3 animate-slide-up">
      {/* AI avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
        <Shield className="h-4 w-4 text-accent" />
      </div>

      {/* Bouncing dots bubble */}
      <div className="rounded-bubble rounded-tl-sm bg-gray-100 px-4 py-3 dark:bg-dark-surface">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500"
              style={{
                animation: 'bounceDot 0.6s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingIndicator;
