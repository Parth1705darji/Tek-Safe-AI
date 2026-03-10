import { Shield } from 'lucide-react';

interface WelcomeScreenProps {
  onPromptClick: (prompt: string) => void;
}

const SUGGESTED_PROMPTS = [
  { emoji: '💻', text: 'My laptop is running slow — how can I speed it up?' },
  { emoji: '🔒', text: 'How do I check if my email has been in a data breach?' },
  { emoji: '🎣', text: 'What should I do if I clicked a phishing link?' },
  { emoji: '🔑', text: 'Help me create strong, unique passwords' },
  { emoji: '🔗', text: 'Is this link safe? [paste your URL here]' },
  { emoji: '📱', text: 'Help me set up a VPN on my phone' },
];

const WelcomeScreen = ({ onPromptClick }: WelcomeScreenProps) => {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      {/* Logo + heading */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 dark:bg-primary/20">
          <Shield className="h-9 w-9 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome to Tek-Safe AI
        </h1>
        <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">
          Your AI Tech Support &amp; Cybersecurity Assistant — ask anything about your devices or
          online safety.
        </p>
      </div>

      {/* Prompt cards grid */}
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTED_PROMPTS.map(({ emoji, text }) => (
          <button
            key={text}
            onClick={() => onPromptClick(text)}
            className="group flex items-start gap-3 rounded-card border border-gray-200 bg-white p-4 text-left text-sm shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md dark:border-gray-700 dark:bg-dark-surface dark:hover:border-accent/40"
          >
            <span className="mt-0.5 text-xl leading-none">{emoji}</span>
            <span className="text-gray-700 transition-colors group-hover:text-primary dark:text-gray-300 dark:group-hover:text-accent">
              {text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default WelcomeScreen;
