interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  variant?: 'danger' | 'warning';
}

export const ConfirmModal = ({ message, onConfirm, onCancel, isLoading, variant = 'danger' }: ConfirmModalProps) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-900 p-3 text-sm">
    <p className="flex-1 text-gray-300">{message}</p>
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={onCancel}
        disabled={isLoading}
        className="rounded-lg px-3 py-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onConfirm}
        disabled={isLoading}
        className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
          variant === 'danger'
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
            : 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
        } disabled:opacity-50`}
      >
        {isLoading ? 'Deleting...' : 'Confirm'}
      </button>
    </div>
  </div>
);
