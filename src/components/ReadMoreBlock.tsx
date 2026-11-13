import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ReadMoreTextProps {
  text?: string;
  paragraphs?: string[];
  maxChars?: number;
  className?: string;
  paragraphClassName?: string;
  buttonClassName?: string;
  variant?: 'light' | 'dark';
  readMoreLabel?: string;
  showLessLabel?: string;
  stopPropagation?: boolean;
}

const truncateAtWordBoundary = (input: string, maxChars: number): string => {
  if (input.length <= maxChars) return input;
  const sliced = input.slice(0, maxChars);
  const lastSpace = sliced.lastIndexOf(' ');
  const cutoff = lastSpace > maxChars * 0.6 ? lastSpace : maxChars;
  return `${sliced.slice(0, cutoff).trimEnd()}...`;
};

export const ReadMoreText: React.FC<ReadMoreTextProps> = ({
  text = '',
  paragraphs,
  maxChars = 145,
  className = '',
  paragraphClassName = '',
  buttonClassName = '',
  variant = 'light',
  readMoreLabel = 'Read More',
  showLessLabel = 'Show Less',
  stopPropagation = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const normalizedParagraphs =
    paragraphs && paragraphs.length > 0
      ? paragraphs.map((p) => p.trim()).filter(Boolean)
      : text
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean);

  if (normalizedParagraphs.length === 0) {
    return null;
  }

  const totalLength = normalizedParagraphs.reduce((sum, p) => sum + p.length, 0);
  const hasMoreContent =
    normalizedParagraphs.length > 1 || totalLength > maxChars;

  const toggleExpanded = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    setExpanded((prev) => !prev);
  };

  const defaultBtnStyle =
    variant === 'dark'
      ? 'text-amber-300 hover:text-amber-200 focus-visible:ring-amber-400'
      : 'text-blue-900 hover:text-blue-700 focus-visible:ring-blue-800';

  if (!hasMoreContent) {
    return (
      <div className={className}>
        {normalizedParagraphs.map((p, idx) => (
          <p key={idx} className={paragraphClassName}>
            {p}
          </p>
        ))}
      </div>
    );
  }

  const firstParagraph = normalizedParagraphs[0];
  const collapsedFirst =
    firstParagraph.length > maxChars
      ? truncateAtWordBoundary(firstParagraph, maxChars)
      : firstParagraph;

  return (
    <div className={className}>
      {expanded ? (
        <div className="space-y-3">
          {normalizedParagraphs.map((p, idx) => (
            <p key={idx} className={paragraphClassName}>
              {p}
            </p>
          ))}
        </div>
      ) : (
        <p className={paragraphClassName}>{collapsedFirst}</p>
      )}

      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        className={`mt-2 inline-flex items-center gap-1 py-1 text-xs font-bold underline underline-offset-4 decoration-1.5 transition-colors cursor-pointer rounded focus:outline-hidden focus-visible:ring-2 ${defaultBtnStyle} ${buttonClassName}`}
      >
        <span>{expanded ? showLessLabel : readMoreLabel}</span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        )}
      </button>
    </div>
  );
};

interface ReadMorePanelProps {
  children: React.ReactNode;
  readMoreLabel?: string;
  showLessLabel?: string;
  defaultOpen?: boolean;
  variant?: 'light' | 'dark';
  className?: string;
  buttonClassName?: string;
  stopPropagation?: boolean;
}

export const ReadMorePanel: React.FC<ReadMorePanelProps> = ({
  children,
  readMoreLabel = 'Read More',
  showLessLabel = 'Show Less',
  defaultOpen = false,
  variant = 'light',
  className = '',
  buttonClassName = '',
  stopPropagation = false,
}) => {
  const [expanded, setExpanded] = useState(defaultOpen);

  const toggle = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    setExpanded((prev) => !prev);
  };

  const defaultBtnStyle =
    variant === 'dark'
      ? 'text-amber-300 hover:text-amber-200 bg-slate-800/80 hover:bg-slate-800 border-slate-700 focus-visible:ring-amber-400'
      : 'text-blue-900 hover:text-blue-950 bg-blue-50/70 hover:bg-blue-100/80 border-blue-200 focus-visible:ring-blue-800';

  return (
    <div className={className}>
      {expanded && (
        <div className="mb-3 animate-in fade-in duration-150">{children}</div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] text-xs font-bold rounded-md border transition-colors cursor-pointer focus:outline-hidden focus-visible:ring-2 whitespace-nowrap ${defaultBtnStyle} ${buttonClassName}`}
      >
        <span>{expanded ? showLessLabel : readMoreLabel}</span>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
        )}
      </button>
    </div>
  );
};
