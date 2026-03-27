import { useState } from 'react';
import { HelpCircle, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DiagnosticCardProps {
  questions: string[];
  onAnswer: (answer: string) => void;
  answered: boolean;
}

const DiagnosticCard = ({ questions, onAnswer, answered }: DiagnosticCardProps) => {
  const [customInput, setCustomInput] = useState('');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  if (answered) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400 dark:border-gray-700 dark:bg-gray-800/40">
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Answered — see response below</span>
      </div>
    );
  }

  const handleChipClick = (question: string) => {
    setSelectedAnswer(question);
    onAnswer(question);
  };

  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    setSelectedAnswer(trimmed);
    onAnswer(trimmed);
    setCustomInput('');
  };

  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <HelpCircle className="h-4 w-4 shrink-0 text-accent" />
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
          Quick questions to get you the right fix:
        </p>
      </div>

      {/* Question chips */}
      <div className="flex flex-col gap-2">
        {questions.map((question, i) => (
          <button
            key={i}
            onClick={() => handleChipClick(question)}
            disabled={!!selectedAnswer}
            className={cn(
              'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-all duration-150',
              selectedAnswer === question
                ? 'border-accent bg-accent/10 text-accent dark:bg-accent/20'
                : selectedAnswer
                ? 'cursor-default border-gray-200 bg-white opacity-40 dark:border-gray-700 dark:bg-dark-surface'
                : 'border-gray-200 bg-white text-gray-700 hover:border-accent/50 hover:bg-accent/5 hover:text-primary dark:border-gray-700 dark:bg-dark-surface dark:text-gray-300 dark:hover:border-accent/50'
            )}
          >
            <span>{question}</span>
            {!selectedAnswer && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
            )}
          </button>
        ))}
      </div>

      {/* Custom answer input */}
      {!selectedAnswer && (
        <div className="mt-2 flex gap-2">
          <input
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
            placeholder="Or type your own answer..."
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-accent focus:outline-none dark:border-gray-700 dark:bg-dark-surface dark:text-gray-300 dark:placeholder-gray-500"
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customInput.trim()}
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
};

export default DiagnosticCard;
