import { useState, useEffect } from 'react';
import { Megaphone, X } from 'lucide-react';

interface Announcement {
  id: string;
  message: string;
  created_at: string;
  expires_at: string | null;
}

const DISMISSED_KEY = 'teksafe_dismissed_announcements';

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function addDismissed(id: string) {
  const dismissed = getDismissed();
  if (!dismissed.includes(id)) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed, id]));
  }
}

const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    setDismissed(getDismissed());
    fetch('/api/admin/broadcast')
      .then(r => r.ok ? r.json() : { announcements: [] })
      .then(data => setAnnouncements(data.announcements ?? []))
      .catch(() => {});
  }, []);

  const visible = announcements.filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  const handleDismiss = (id: string) => {
    addDismissed(id);
    setDismissed(prev => [...prev, id]);
  };

  return (
    <div className="flex flex-col gap-1 px-3 pt-2">
      {visible.map(a => (
        <div
          key={a.id}
          className="flex items-start gap-2.5 rounded-xl border border-[#00D4AA]/30 bg-[#00D4AA]/10 px-3.5 py-2.5 text-sm text-[#00D4AA]"
        >
          <Megaphone className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{a.message}</span>
          <button
            onClick={() => handleDismiss(a.id)}
            className="shrink-0 rounded p-0.5 hover:bg-[#00D4AA]/20 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default AnnouncementBanner;
