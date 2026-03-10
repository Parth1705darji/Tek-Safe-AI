import { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface FeedbackWidgetProps {
  messageId: string;
  currentFeedback: 'up' | 'down' | null;
  onFeedback: (messageId: string, feedback: 'up' | 'down', text?: string) => void;
}

const FeedbackWidget = ({ messageId, currentFeedback, onFeedback }: FeedbackWidgetProps) => {
  const [showTextInput, setShowTextInput] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');

  const handleThumbsUp = () => {
    if (currentFeedback === 'up') return;
    setShowTextInput(false);
    onFeedback(messageId, 'up');
  };

  const handleThumbsDown = () => {
    if (currentFeedback === 'down') {
      setShowTextInput(false);
      return;
    }
    onFeedback(messageId, 'down');
    setShowTextInput(true);
  };

  const handleTextSubmit = () => {
    onFeedback(messageId, 'down', feedbackText.trim() || undefined);
    setShowTextInput(false);
    setFeedbackText('');
  };

  return (
    <div className="mt-1.5 space-y-2">
      <div className="flex items-center gap-1">
        <button
          onClick={handleThumbsUp}
          aria-label="Thumbs up"
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 active:scale-110',
            currentFeedback === 'up'
              ? 'text-green-500'
              : 'text-gray-400 hover:text-green-500 dark:text-gray-500 dark:hover:text-green-400'
          )}
        >
          <ThumbsUp className={cn('h-4 w-4', currentFeedback === 'up' && 'fill-green-500')} />
        </button>
        <button
          onClick={handleThumbsDown}
          aria-label="Thumbs down"
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-150 active:scale-110',
            currentFeedback === 'down'
              ? 'text-red-500'
              : 'text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400'
          )}
        >
          <ThumbsDown className={cn('h-4 w-4', currentFeedback === 'down' && 'fill-red-500')} />
        </button>
      </div>

      {showTextInput && (
        <div className="flex gap-2 animate-slide-up">
          <input
            autoFocus
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            placeholder="What went wrong?"
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-primary dark:border-gray-700 dark:bg-dark-surface dark:text-gray-300 dark:placeholder-gray-500"
          />
          <button
            onClick={handleTextSubmit}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
};

export default FeedbackWidget;
