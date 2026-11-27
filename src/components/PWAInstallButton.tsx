import React, { useState } from 'react';
import { MonitorDown, Laptop, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'mobile-menu';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  const buttonClasses =
    variant === 'mobile-menu'
      ? 'cursor-pointer text-left px-3 py-3 min-h-[44px] text-sm flex items-center gap-2 rounded-md text-blue-950 dark:text-amber-400 font-semibold bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 transition-colors'
      : 'cursor-pointer inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 min-h-[38px] sm:min-h-[40px] text-xs font-semibold rounded-md transition-all border border-blue-900/20 dark:border-amber-400/30 bg-blue-50/90 dark:bg-blue-950/60 text-blue-950 dark:text-amber-300 hover:bg-blue-100 dark:hover:bg-blue-900/70 whitespace-nowrap shrink-0';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={buttonClasses}
        title={isIOS ? 'Add Mugina Hope Academy to Home Screen' : 'Install Mugina Hope Academy as a Desktop App'}
      >
        <MonitorDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
        {variant === 'mobile-menu' ? (
          <span>{isIOS ? 'Install App (iOS)' : 'Install Desktop App'}</span>
        ) : (
          <>
            <span className="hidden md:inline">{isIOS ? 'Install App' : 'Desktop App'}</span>
            <span className="md:hidden">App</span>
          </>
        )}
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-950 text-white flex items-center justify-center shrink-0">
                  <Laptop className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 id="pwa-install-title" className="text-base font-bold text-slate-900 dark:text-white">
                    {isIOS ? 'Install on iPhone / iPad' : 'Install as a Desktop App'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mugina Hope Primary &amp; Nursery Academy
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close install instructions"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
                <li>
                  Tap the <strong>Share</strong> button in the Safari toolbar.
                </li>
                <li>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Tap <strong>Add</strong> to launch Mugina Hope Academy like a native app.
                </li>
              </ol>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <p>
                  Run this website as a standalone desktop window with its own app icon and offline access:
                </p>
                <ul className="space-y-2 list-disc list-inside text-xs sm:text-sm">
                  <li>
                    <strong>Chrome / Edge (Windows, macOS, Linux):</strong> Click the <strong>Install</strong> icon on the right side of the address bar, or open the browser menu and select <strong>Cast, save, and share → Install page as app</strong> (or <strong>Apps → Install this site as an app</strong>).
                  </li>
                  <li>
                    <strong>Safari (macOS):</strong> Choose <strong>File → Add to Dock…</strong> from the menu bar.
                  </li>
                </ul>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-lg bg-blue-950 hover:bg-blue-900 text-white py-2.5 text-sm font-semibold transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
