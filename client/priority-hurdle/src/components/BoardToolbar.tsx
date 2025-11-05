// client/src/components/BoardToolbar.tsx
import React, { useEffect, useRef, useState } from "react";
import { MdExpandMore } from "react-icons/md";
import { IoMdAdd } from "react-icons/io";

interface BoardToolbarProps {
  onAddNewNote: () => void;
  boardId?: string | null;
}

const ICON_BUTTONS: { key: string; label: string; svg: React.ReactNode }[] = [
  {
    key: "sort",
    label: "Sort",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM7 12h10M7 16h6" />
      </svg>
    ),
  },
  {
    key: "filter",
    label: "Filter",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM7 12h10M7 16h6" />
      </svg>
    ),
  },
  {
    key: "leaderboard",
    label: "Leaderboard",
    svg: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v6H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v10H9a1 1 0 01-1-1V7zM14 3a1 1 0 011-1h2a1 1 0 011 1v14h-4V3z" />
      </svg>
    ),
  },
];

const BoardToolbar: React.FC<BoardToolbarProps> = ({ onAddNewNote }) => {
  // position state for draggable toolbar (desktop)
  const [top, setTop] = useState<number>(140);
  const [left, setLeft] = useState<number>(16);

  // mobile reactive detection
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches
  );

  // expanded state — controls whether the rail is shown
  const [expanded, setExpanded] = useState(false);

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const isTouchRef = useRef(false);

  // Hover delay timer ref
  const hoverTimerRef = useRef<number | null>(null);
  const HOVER_DELAY_MS = 220;

  // handle touch dragging (mobile reposition of toolbar)
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startTop = top;
    let startLeft = left;

    const onTouchStart = (e: TouchEvent) => {
      isTouchRef.current = true;
      const t = e.touches[0];
      dragging = true;
      startX = t.clientX;
      startY = t.clientY;
      startTop = top;
      startLeft = left;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const t = e.touches[0];
      const dy = t.clientY - startY;
      const dx = t.clientX - startX;
      const newTop = Math.min(Math.max(16, startTop + dy), window.innerHeight - 80);
      const newLeft = Math.min(Math.max(8, startLeft + dx), window.innerWidth - 80);
      setTop(newTop);
      setLeft(newLeft);
    };

    const onTouchEnd = () => {
      dragging = false;
    };

    el.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [top, left]);

  // keep isMobile reactive to viewport changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // auto collapse when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = toolbarRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Hover with short delay to avoid accidental opens
  const handleMouseEnter = () => {
    if (isTouchRef.current) return;
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    // only expand after a short hover
    hoverTimerRef.current = window.setTimeout(() => {
      setExpanded(true);
      hoverTimerRef.current = null;
    }, HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // collapse on leave if not keyboard-focused
    if (!isTouchRef.current) setExpanded(false);
  };

  // Toggle explicitly
  const handleToggle = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpanded((s) => !s);
  };

  // Desktop / Mobile branches
  if (isMobile) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => {
            // ensure add runs immediately and collapse rail if it was open
            onAddNewNote();
            setExpanded(false);
          }}
          aria-label="Add note"
          className="bg-indigo-500 text-white p-4 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <span className="sr-only">Add note</span>
          <IoMdAdd size={22} />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={toolbarRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    
      className="fixed z-50 left-6 top-1/2 transform -translate-y-1/2"
    >
      {/* Main column (FAB + toggle dot) */}
      <div className="flex flex-col items-center">
        {/* FAB */}
        <button
          onClick={() => {
            // click should always trigger creation immediately
            onAddNewNote();
            setExpanded(false);
          }}
          aria-label="Add note"
          onFocus={() => setExpanded(true)}
          className="relative flex items-center justify-center h-12 w-12 rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-transform bg-indigo-500 text-white"
          title="Add note"
        >
          <span className="sr-only">Add note</span>
          <span className="absolute inset-0 rounded-full animate-pulse opacity-30" style={{ animationDuration: "2.5s" }} />
          <IoMdAdd size={22} />
        </button>

        {/* Toggle dot */}
        <button
          onClick={handleToggle}
          aria-label={expanded ? "Collapse toolbar" : "Expand toolbar"}
          title={expanded ? "Collapse" : "More"}
          className="mt-2 h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
        >
          <MdExpandMore size={20} />
        </button>
      </div>

      {/* Absolute rail (doesn't affect FAB layout) */}
      <div
        className={`absolute left-full ml-3 top-0 transform origin-top-left transition-all duration-200 ease-out ${
          expanded
            ? "opacity-100 translate-x-0 scale-100 max-h-[420px]"
            : "opacity-0 -translate-x-2 scale-95 max-h-0 overflow-hidden pointer-events-none"
        }`}
        aria-hidden={!expanded}
        role="region"
        aria-label="Toolbar"
      >
        <div className="bg-white rounded-lg p-3 shadow-lg flex flex-col gap-2">
          {ICON_BUTTONS.map((b) => (
            <div key={b.key} className="flex items-center gap-3">
              <button
                aria-label={b.label}
                title={b.label}
                onFocus={() => setExpanded(true)}
                tabIndex={0}
                className="flex items-center justify-center h-10 w-10 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-200 transition"
              >
                {b.svg}
              </button>
              <div className="text-sm text-gray-700">{b.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BoardToolbar;
