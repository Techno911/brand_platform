import { useState, useEffect } from 'react';
import { X, Lightbulb } from 'lucide-react';

interface OnboardingBannerProps {
  storageKey: string;
  title: string;
  body: string;
}

// Баннер «вы не кодите, вы редактируете» (B-inner).
// Закрывается, запоминает в localStorage. Отображается разово на старте каждой новой стадии.
export default function OnboardingBanner({ storageKey, title, body }: OnboardingBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = typeof window !== 'undefined' && window.localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [storageKey]);

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(storageKey, String(Date.now()));
    setVisible(false);
  };

  return (
    <div className="relative bg-[#EEF2FF] border border-[#A5B4FC] rounded-2xl p-5">
      <div className="flex gap-3 pr-8">
        <Lightbulb className="w-5 h-5 text-[#4F46E5] flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm text-[#1A1A1A] mb-1">{title}</p>
          <p className="text-[#6B7280] text-sm leading-relaxed">{body}</p>
        </div>
      </div>
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors"
        title="Скрыть"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
