import { useState, useRef, useEffect } from 'react';
import { Download, FileText, TableProperties, Globe, Printer } from 'lucide-react';
import { exportAsHtml, exportAsPdf, exportAsWord, exportAsExcel } from '../../lib/exportChat';
import type { Message } from '../../types';

interface ChatExportMenuProps {
  messages: Message[];
  title: string;
}

const FORMATS = [
  { label: 'Word (.doc)', icon: FileText, action: exportAsWord },
  { label: 'Excel (.xls)', icon: TableProperties, action: exportAsExcel },
  { label: 'PDF (print)', icon: Printer, action: exportAsPdf },
  { label: 'HTML (.html)', icon: Globe, action: exportAsHtml },
];

const ChatExportMenu = ({ messages, title }: ChatExportMenuProps) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const exportable = messages.filter((m) => m.role !== 'system');
  if (exportable.length === 0) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Export chat"
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-dark-surface dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200"
      >
        <Download className="h-3.5 w-3.5" />
        Export
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-dark-surface">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Export as
          </p>
          {FORMATS.map(({ label, icon: Icon, action }) => (
            <button
              key={label}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60"
              onClick={() => {
                setOpen(false);
                action(messages, title);
              }}
            >
              <Icon className="h-3.5 w-3.5 text-accent" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatExportMenu;
