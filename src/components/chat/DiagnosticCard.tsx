import { useState } from 'react';
import { HelpCircle, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

// ─── Parse "Question?Opt1,Opt2,Opt3" strings from the AI ─────────────────────

interface ParsedQuestion {
  question: string;
  options: string[];
}

function parseQuestions(raw: string[]): ParsedQuestion[] {
  return raw.map(q => {
    const sepIdx = q.indexOf('?');
    if (sepIdx === -1) return { question: q, options: [] };
    return {
      question: q.slice(0, sepIdx).trim(),
      options: q.slice(sepIdx + 1).split(',').map(o => o.trim()).filter(Boolean),
    };
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DiagnosticCardProps {
  questions: string[];
  onAnswer: (answer: string) => void;
  answered: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DiagnosticCard = ({ questions, onAnswer, answered }: DiagnosticCardProps) => {
  const parsed = parseQuestions(questions);
  const total = parsed.length;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');

  if (answered) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-400 dark:border-gray-700 dark:bg-gray-800/40">
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        <span>Answered — see response below</span>
      </div>
    );
  }

  const current = parsed[step];

  const commit = (option: string) => {
    const newAnswers = [...answers, option];
    if (step < total - 1) {
      setAnswers(newAnswers);
      setStep(s => s + 1);
      setCustomInput('');
    } else {
      // All questions answered — fire as one combined message
      onAnswer(newAnswers.join(' • '));
    }
  };

  const handleCustomSubmit = () => {
    const trimmed = customInput.trim();
    if (trimmed) commit(trimmed);
  };

  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-4 dark:border-primary/30 dark:bg-primary/10">

      {/* Progress bar */}
      {total > 1 && (
        <div className="mb-3 flex gap-1">
          {parsed.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1 flex-1 rounded-full transition-all duration-300',
                i < step
                  ? 'bg-accent'
                  : i === step
                  ? 'bg-accent/50'
                  : 'bg-gray-200 dark:bg-gray-700'
              )}
            />
          ))}
        </div>
      )}

      {/* Question */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0 text-accent" />
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {current.question}
          </p>
        </div>
        {total > 1 && (
          <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
            {step + 1} / {total}
          </span>
        )}
      </div>

      {/* Previously selected answers */}
      {answers.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {answers.map((a, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent"
            >
              <Check className="h-3 w-3 shrink-0" />
              {a}
            </span>
          ))}
        </div>
      )}

      {/* Answer options */}
      {current.options.length > 0 && (
        <div className="mb-2 flex flex-col gap-1.5">
          {current.options.map((option, i) => (
            <button
              key={i}
              onClick={() => commit(option)}
              className="flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-700 transition-all duration-150 hover:border-accent/50 hover:bg-accent/5 hover:text-primary dark:border-gray-700 dark:bg-dark-surface dark:text-gray-300 dark:hover:border-accent/50"
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {/* Custom / free-text input */}
      <div className="flex gap-2">
        <input
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
          placeholder={current.options.length > 0 ? 'Or type your own...' : 'Type your answer...'}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-accent focus:outline-none dark:border-gray-700 dark:bg-dark-surface dark:text-gray-300 dark:placeholder-gray-500"
        />
        <button
          onClick={handleCustomSubmit}
          disabled={!customInput.trim()}
          className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-40"
        >
          {step < total - 1 ? 'Next' : 'Done'}
        </button>
      </div>
    </div>
  );
};

export default DiagnosticCard;
