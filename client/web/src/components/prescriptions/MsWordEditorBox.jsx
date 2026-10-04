import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BatteryLow,
  Bold,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cigarette,
  Clock,
  Copy,
  Droplet,
  Droplets,
  Edit2,
  Edit3,
  Eye,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Flame,
  FlaskConical,
  Folder,
  Footprints,
  Heart,
  HeartPulse,
  History,
  Italic,
  Lightbulb,
  List,
  ListOrdered,
  Maximize2,
  Microscope,
  Minimize2,
  Moon,
  Percent,
  PhoneCall,
  Pill,
  Plus,
  RotateCcw,
  RotateCw,
  Scan,
  Scissors,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Strikethrough,
  Syringe,
  Trash2,
  Underline,
  User,
  Users,
  Utensils,
  Wind,
  X,
} from 'lucide-react';
import { Dialog } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import {
  clinicalPhraseStore,
  SECTION_METADATA,
} from '../../services/clinicalPhraseStore.js';
import ClinicalPhraseManagerModal from './ClinicalPhraseManagerModal.jsx';

// Icon mapping for dynamic icons used in chips and section badges
const ICON_MAP = {
  Activity,
  AlertCircle,
  AlertTriangle,
  BatteryLow,
  Bold,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Cigarette,
  Clock,
  Copy,
  Droplet,
  Droplets,
  Edit2,
  Edit3,
  Eye,
  FileImage,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Flame,
  FlaskConical,
  Folder,
  Footprints,
  Heart,
  HeartPulse,
  History,
  Italic,
  Lightbulb,
  List,
  ListOrdered,
  Maximize2,
  Microscope,
  Minimize2,
  Moon,
  Percent,
  PhoneCall,
  Pill,
  Plus,
  RotateCcw,
  RotateCw,
  Scan,
  Scissors,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Strikethrough,
  Syringe,
  Trash2,
  Underline,
  User,
  Users,
  Utensils,
  Wind,
  X,
};

function DynamicIcon({ name, size = 14, className = '' }) {
  const IconComponent = ICON_MAP[name] || Sparkles;
  return <IconComponent size={size} className={className} />;
}

// Dot colors cycling for phrase items in the right panel (matching reference UI)
const DOT_COLORS = [
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#06b6d4', // cyan
];

export default function MsWordEditorBox({
  open,
  onOpenChange,
  title = 'Clinical Notes Editor',
  sectionKey = 'coMorbidities',
  initialValue = '',
  onSave,
}) {
  // initialValue is only ever meant to be a string, but a caller can
  // accidentally hand this a non-string (e.g. a still-empty array from
  // its own form state) — guard here so this editor never throws on
  // `content.trim()` regardless of what it's given.
  const safeInitialValue = typeof initialValue === 'string' ? initialValue : '';
  const [content, setContent] = useState(safeInitialValue);
  const [history, setHistory] = useState([safeInitialValue]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  // Focus tracking for disappearing "Type here" placeholder
  const [isFocused, setIsFocused] = useState(false);

  // Quick chips & phrase state
  const [selectedChipIndex, setSelectedChipIndex] = useState(0);
  const [phrases, setPhrases] = useState(clinicalPhraseStore.getPhrases(sectionKey));
  const [quickChips, setQuickChips] = useState(clinicalPhraseStore.getQuickChips(sectionKey));
  const [query, setQuery] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newText, setNewText] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState('');

  // Single horizontal scroller drag state
  const [scrollProgress, setScrollProgress] = useState(0);
  const [thumbRatio, setThumbRatio] = useState(0.3);
  const [isDraggingTrack, setIsDraggingTrack] = useState(false);

  // Mobile tab state: 'editor' | 'phrases'
  const [activeMobileTab, setActiveMobileTab] = useState('editor');
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  const textareaRef = useRef(null);
  const searchRef = useRef(null);
  const carouselRef = useRef(null);
  const trackRef = useRef(null);

  // Get current metadata
  const meta = useMemo(() => {
    return clinicalPhraseStore.getMetadata(sectionKey);
  }, [sectionKey]);

  // Sync scrollbar state with carousel
  const updateScrollState = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollProgress(Math.max(0, Math.min(1, scrollLeft / maxScroll)));
      setThumbRatio(Math.max(0.18, Math.min(1, clientWidth / scrollWidth)));
    } else {
      setScrollProgress(0);
      setThumbRatio(1);
    }
  }, []);

  // Sync initial value and phrases when opened or section changes
  useEffect(() => {
    if (open) {
      const val = typeof initialValue === 'string' ? initialValue : '';
      setContent(val);
      setHistory([val]);
      setHistoryIndex(0);
      setPhrases(clinicalPhraseStore.getPhrases(sectionKey));
      setQuickChips(clinicalPhraseStore.getQuickChips(sectionKey));
      setSelectedChipIndex(0);
      setQuery('');
      setAddingNew(false);
      setNewText('');
      setEditingIdx(null);
      setRightPanelCollapsed(false);
      setActiveMobileTab('editor');
      setIsFocused(false);

      setTimeout(() => {
        updateScrollState();
      }, 100);
    }
  }, [open, initialValue, sectionKey, updateScrollState]);

  // ResizeObserver for carousel
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateScrollState());
    ro.observe(el);
    return () => ro.disconnect();
  }, [quickChips, updateScrollState]);

  // Subscribe to clinicalPhraseStore updates
  useEffect(() => {
    const unsub = clinicalPhraseStore.subscribe(() => {
      setPhrases(clinicalPhraseStore.getPhrases(sectionKey));
      setQuickChips(clinicalPhraseStore.getQuickChips(sectionKey));
      setTimeout(updateScrollState, 50);
    });
    return () => unsub();
  }, [sectionKey, updateScrollState]);

  // Update content with undo/redo history
  const setVal = (newVal) => {
    setContent(newVal);
    setHistory((h) => {
      const trimmed = h.slice(0, historyIndex + 1);
      const next = [...trimmed, newVal];
      if (next.length > 50) next.shift();
      setHistoryIndex(next.length - 1);
      return next;
    });
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex((i) => i - 1);
      setContent(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((i) => i + 1);
      setContent(history[historyIndex + 1]);
    }
  };

  const applyFormatting = (prefix, suffix = '') => {
    const el = textareaRef.current;
    if (!el) return;
    setIsFocused(true);
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = el.value;
    const selected = current.slice(start, end);
    const before = current.slice(0, start);
    const after = current.slice(end);
    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}${suffix}`;
    const nextVal = before + replacement + after;
    setVal(nextVal);
    setTimeout(() => {
      el.focus();
      const cursorTarget = selected ? start + replacement.length : start + prefix.length;
      el.setSelectionRange(cursorTarget, cursorTarget);
    }, 0);
  };

  const toggleBulletList = () => {
    const el = textareaRef.current;
    if (!el) return;
    setIsFocused(true);
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = el.value;
    const lastNewlineBefore = current.lastIndexOf('\n', start - 1);
    const lineStart = lastNewlineBefore === -1 ? 0 : lastNewlineBefore + 1;
    const nextNewlineAfter = current.indexOf('\n', end);
    const lineEnd = nextNewlineAfter === -1 ? current.length : nextNewlineAfter;
    const lines = current.slice(lineStart, lineEnd).split('\n');
    const allBulleted = lines.every((l) => l.trimStart().startsWith('• '));
    const newLines = lines.map((line) => {
      if (allBulleted) return line.replace(/^\s*•\s*/, '');
      return line.startsWith('• ') ? line : `• ${line.replace(/^[-*•\d+.]\s*/, '')}`;
    });
    const replaced = newLines.join('\n');
    setVal(current.slice(0, lineStart) + replaced + current.slice(lineEnd));
  };

  const toggleNumberedList = () => {
    const el = textareaRef.current;
    if (!el) return;
    setIsFocused(true);
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = el.value;
    const lastNewlineBefore = current.lastIndexOf('\n', start - 1);
    const lineStart = lastNewlineBefore === -1 ? 0 : lastNewlineBefore + 1;
    const nextNewlineAfter = current.indexOf('\n', end);
    const lineEnd = nextNewlineAfter === -1 ? current.length : nextNewlineAfter;
    const lines = current.slice(lineStart, lineEnd).split('\n');
    const allNumbered = lines.every((l) => /^\s*\d+\.\s*/.test(l));
    const newLines = lines.map((line, idx) => {
      if (allNumbered) return line.replace(/^\s*\d+\.\s*/, '');
      const clean = line.replace(/^\s*[-*•\d+.]\s*/, '');
      return `${idx + 1}. ${clean}`;
    });
    setVal(current.slice(0, lineStart) + newLines.join('\n') + current.slice(lineEnd));
  };

  // Insert a phrase into the editor
  const insertTemplatePhrase = useCallback(
    (phrase) => {
      const el = textareaRef.current;
      const current = content.trim();
      const nextVal = current ? `${current}\n• ${phrase}` : `• ${phrase}`;
      setVal(nextVal);
      setIsFocused(true);
      if (activeMobileTab === 'phrases') {
        setActiveMobileTab('editor');
      }
      setTimeout(() => {
        if (el) {
          el.focus();
          el.scrollTop = el.scrollHeight;
        }
      }, 50);
    },
    [content, activeMobileTab]
  );

  const handleChipClick = (chip, index) => {
    setSelectedChipIndex(index);
    insertTemplatePhrase(chip.label);
  };

  const handleAddNewPhrase = () => {
    if (!newText.trim()) return;
    clinicalPhraseStore.addPhrase(sectionKey, newText.trim());
    setNewText('');
    setAddingNew(false);
    setQuery('');
  };

  const handleSaveEditPhrase = (idx) => {
    if (!editText.trim()) return;
    clinicalPhraseStore.updatePhrase(sectionKey, idx, editText.trim());
    setEditingIdx(null);
    setEditText('');
  };

  const handleDeletePhrase = (e, idx) => {
    e.stopPropagation();
    clinicalPhraseStore.deletePhrase(sectionKey, idx);
  };

  // Filter phrases in the right card
  const filtered = useMemo(() => {
    if (!query.trim()) return phrases.map((p, i) => ({ text: p, idx: i }));
    const q = query.toLowerCase();
    return phrases
      .map((p, i) => ({ text: p, idx: i }))
      .filter(({ text }) => text.toLowerCase().includes(q));
  }, [phrases, query]);

  // Scroll horizontal carousel by button
  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const offset = direction === 'left' ? -220 : 220;
      carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Track click handler
  const handleTrackClick = (e) => {
    const track = trackRef.current;
    const carousel = carouselRef.current;
    if (!track || !carousel) return;
    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    carousel.scrollTo({
      left: ratio * maxScroll,
      behavior: 'smooth',
    });
  };

  // Draggable thumb handler
  const handleThumbMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingTrack(true);
    const startX = e.clientX;
    const carousel = carouselRef.current;
    const track = trackRef.current;
    if (!carousel || !track) return;
    const startScrollLeft = carousel.scrollLeft;
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    const trackWidth = track.clientWidth;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaScroll = (deltaX / trackWidth) * maxScroll * 1.3;
      carousel.scrollLeft = Math.max(0, Math.min(maxScroll, startScrollLeft + deltaScroll));
    };

    const onMouseUp = () => {
      setIsDraggingTrack(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Keyboard shortcut handler
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 's')) {
      e.preventDefault();
      handleSave();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      applyFormatting('**', '**');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      applyFormatting('*', '*');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      applyFormatting('<u>', '</u>');
      return;
    }

    if (e.key === 'Enter') {
      const el = textareaRef.current;
      const pos = el.selectionStart;
      const text = el.value;
      const lastLineStart = text.lastIndexOf('\n', pos - 1) + 1;
      const currentLine = text.slice(lastLineStart, pos);

      if (/^\s*[•\-]\s*$/.test(currentLine)) {
        e.preventDefault();
        setVal(text.slice(0, lastLineStart) + text.slice(pos));
        setTimeout(() => el.setSelectionRange(lastLineStart, lastLineStart), 0);
        return;
      }
      if (/^\s*\d+\.\s*$/.test(currentLine)) {
        e.preventDefault();
        setVal(text.slice(0, lastLineStart) + text.slice(pos));
        setTimeout(() => el.setSelectionRange(lastLineStart, lastLineStart), 0);
        return;
      }
      if (/^\s*•\s+/.test(currentLine)) {
        e.preventDefault();
        const nextVal = text.slice(0, pos) + '\n• ' + text.slice(pos);
        setVal(nextVal);
        setTimeout(() => el.setSelectionRange(pos + 3, pos + 3), 0);
        return;
      }
      const numMatch = currentLine.match(/^\s*(\d+)\.\s+/);
      if (numMatch) {
        e.preventDefault();
        const prefix = `\n${parseInt(numMatch[1], 10) + 1}. `;
        setVal(text.slice(0, pos) + prefix + text.slice(pos));
        setTimeout(() => el.setSelectionRange(pos + prefix.length, pos + prefix.length), 0);
        return;
      }
    }
  };

  const handleSave = () => {
    onSave?.(content.trim());
    onOpenChange?.(false);
  };

  const displayTitle = title || meta.label || 'Clinical Section';
  const displaySubtitle = meta.subtitle || `Search and insert ${displayTitle.toLowerCase()} for the patient record`;

  // True placeholder logic: "Type here" disappears immediately when focused OR when content is present
  const hasContent = Boolean(content && content.trim().length > 0);
  const showPlaceholder = !isFocused && !hasContent;

  return (
    <>
      {/* Hide native scrollbars on the quick chips container completely */}
      <style>{`
        .no-native-scrollbar::-webkit-scrollbar,
        .no-scrollbar::-webkit-scrollbar,
        .hide-scrollbar::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
        .no-native-scrollbar,
        .no-scrollbar,
        .hide-scrollbar {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
        .placeholder\\:text-2xl::placeholder {
          font-size: 1.5rem;
          font-style: italic;
          font-family: Georgia, serif;
          color: rgba(148, 163, 184, 0.6);
        }
      `}</style>

      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        className={`p-0 overflow-hidden border border-blue-200/70 shadow-2xl transition-all duration-200 bg-white flex flex-col ${
          isFullScreen
            ? 'max-w-[99vw] w-[99vw] h-[98vh] max-h-[98vh] rounded-2xl'
            : 'max-w-6xl w-[96vw] h-[min(90vh,750px)] max-h-[92vh] rounded-[24px] sm:rounded-[28px]'
        }`}
      >
        <div className="flex flex-col h-full max-h-full bg-[#f8fafc] text-slate-900 select-none overflow-hidden p-2.5 sm:p-4">
          {/* ────────────────────────────────────────────────────────
              1. TOP MAIN HEADER BAR (Matching Reference UI)
             ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pb-2 sm:pb-2.5 shrink-0 border-b border-slate-100">
            {/* Left: Section Icon Badge + Title + Subtitle */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-2xs shrink-0">
                <DynamicIcon name={meta.icon || 'FileText'} size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                  {displayTitle}
                </h2>
                <p className="text-[10.5px] sm:text-[11.5px] text-slate-500 font-normal truncate mt-0.5">
                  {displaySubtitle}
                </p>
              </div>
            </div>

            {/* Right: Find Phrase (⌘K), Manage, Fullscreen, Close (Red circular X) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
              {/* Find Phrase button with ⌘K badge */}
              <button
                type="button"
                onClick={() => {
                  setActiveMobileTab('phrases');
                  setRightPanelCollapsed(false);
                  setTimeout(() => searchRef.current?.focus(), 80);
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl border border-blue-200 bg-white hover:bg-blue-50/70 text-blue-700 font-medium text-xs shadow-2xs transition-all cursor-pointer"
                title="Search Phrases (⌘K / Ctrl+K)"
              >
                <Search size={13} className="text-blue-600" />
                <span className="font-semibold text-[11px]">Find Phrase</span>
                <span className="text-[9.5px] text-blue-600/80 bg-blue-50 px-1 py-0.2 rounded font-mono font-bold border border-blue-100">
                  ⌘ K
                </span>
              </button>

              {/* Manage button */}
              <button
                type="button"
                onClick={() => setIsManagerOpen(true)}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs shadow-2xs transition-all cursor-pointer"
                title="Manage all phrases library"
              >
                <SlidersHorizontal size={13} className="text-slate-500" />
                <span className="font-semibold text-[11px]">Manage</span>
              </button>

              {/* Fullscreen / Restore button */}
              <button
                type="button"
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                title={isFullScreen ? 'Restore Window' : 'Maximize Window'}
              >
                {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>

              {/* Circular RED Close Button (Exact as reference image) */}
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white flex items-center justify-center shadow-xs transition-all cursor-pointer shrink-0"
                title="Close"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────
              2. HORIZONTAL QUICK CHIPS & SINGLE THICK SCROLLER
             ──────────────────────────────────────────────────────── */}
          <div className="py-2 shrink-0 select-none">
            {/* "Quick access" label matching reference */}
            <div className="text-[11px] font-semibold text-blue-600 mb-1.5 px-0.5">
              Quick access
            </div>

            {/* Chips Container - Native scrollbars strictly hidden; only custom thick track is visible */}
            <div className="flex items-center gap-1.5">
              <div
                ref={carouselRef}
                onScroll={updateScrollState}
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                }}
                className="no-native-scrollbar hide-scrollbar no-scrollbar flex items-center gap-2 overflow-x-scroll py-0.5 px-0.5 scroll-smooth flex-1"
              >
                {quickChips.map((chip, idx) => {
                  const isSelected = selectedChipIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleChipClick(chip, idx)}
                      className={`px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-2xs ${
                        isSelected
                          ? 'bg-blue-600 text-white border border-blue-600 shadow-xs ring-1 ring-blue-300'
                          : 'bg-white text-slate-700 hover:bg-blue-50/70 border border-slate-200/90 hover:border-blue-300'
                      }`}
                      title="Click to insert into document"
                    >
                      <DynamicIcon
                        name={chip.icon || 'Sparkles'}
                        size={13}
                        className={isSelected ? 'text-white' : 'text-blue-600'}
                      />
                      <span className="truncate max-w-[240px]">{chip.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Chevron Down / More dropdown indicator */}
              <button
                type="button"
                onClick={() => setIsManagerOpen(true)}
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 flex items-center justify-center shadow-2xs transition-colors shrink-0 cursor-pointer"
                title="View All Phrases"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* ONLY ONE Single, Thick, Easy-to-Drag Horizontal Scroller */}
            <div className="flex items-center gap-2 mt-2 px-0.5 select-none">
              {/* Left Arrow Button */}
              <button
                type="button"
                onClick={() => scrollCarousel('left')}
                className="w-6 h-6 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Scroll Left"
              >
                <ChevronLeft size={16} />
              </button>

              {/* Single Thick Scroll Track — easy to see and grab */}
              <div
                ref={trackRef}
                onClick={handleTrackClick}
                className="h-3.5 sm:h-4 flex-1 bg-slate-200 hover:bg-slate-300/80 rounded-full relative cursor-pointer select-none"
                style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)' }}
              >
                <div
                  onMouseDown={handleThumbMouseDown}
                  style={{
                    width: `${Math.round(thumbRatio * 100)}%`,
                    left: `${Math.round(scrollProgress * (1 - thumbRatio) * 100)}%`,
                    transition: isDraggingTrack ? 'none' : 'left 0.1s ease',
                  }}
                  className={`h-full absolute top-0 rounded-full cursor-grab active:cursor-grabbing shadow-sm ${
                    isDraggingTrack
                      ? 'bg-blue-600'
                      : 'bg-blue-400 hover:bg-blue-500'
                  }`}
                  title="Drag to scroll quick access chips"
                />
              </div>

              {/* Right Arrow Button */}
              <button
                type="button"
                onClick={() => scrollCarousel('right')}
                className="w-6 h-6 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                title="Scroll Right"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────
              3. MOBILE BREAKPOINT TAB CONTROLS (< lg screens)
             ──────────────────────────────────────────────────────── */}
          <div className="lg:hidden flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl mb-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveMobileTab('editor')}
              className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeMobileTab === 'editor'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✏️ Document Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileTab('phrases')}
              className={`flex-1 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeMobileTab === 'phrases'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ✨ Clinical Phrases ({phrases.length})
            </button>
          </div>

          {/* ────────────────────────────────────────────────────────
              4. MAIN TWO-COLUMN BODY (Editor Left, Phrases Right)
             ──────────────────────────────────────────────────────── */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 overflow-hidden min-h-0">
            {/* ── LEFT CARD: EDITOR (Span 7 on lg) ── */}
            <div
              className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col p-3 sm:p-4 overflow-hidden h-full min-h-0 transition-all duration-150 ${
                activeMobileTab === 'editor' ? 'flex' : 'hidden lg:flex'
              } ${rightPanelCollapsed ? 'lg:col-span-12' : 'lg:col-span-7'}`}
            >
              {/* Card Sub-header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0 select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                    <Sparkles size={14} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                      {displayTitle}
                    </h3>
                    <p className="text-[10px] sm:text-[11px] text-slate-400 font-normal truncate">
                      Type your {displayTitle.toLowerCase()} or use the quick phrases on the right
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-slate-200 bg-slate-50/90 text-slate-500 text-[10px] sm:text-[11px] font-medium shrink-0">
                  <FileText size={11} className="text-slate-400" />
                  <span>Prescription Section</span>
                </div>
              </div>

              {/* Editable Canvas */}
              <div
                className="flex-1 py-2 flex flex-col relative overflow-y-auto cursor-text min-h-0"
                onClick={() => {
                  textareaRef.current?.focus();
                }}
              >
                {/* Empty state illustration — only shown when truly no content AND not focused */}
                {showPlaceholder && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center py-2 sm:py-4 select-none pointer-events-none absolute inset-0">
                    <div className="relative mb-2">
                      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-blue-500 shadow-2xs">
                        <FileText size={24} />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shadow-xs">
                        +
                      </div>
                    </div>
                    <h4 className="font-bold text-slate-800 text-xs sm:text-sm">
                      No {displayTitle.toLowerCase()} added yet
                    </h4>
                    <p className="text-slate-400 text-[11px] max-w-xs mt-0.5 leading-relaxed">
                      Click here or select a phrase from the right panel
                    </p>
                  </div>
                )}

                {/* Textarea — always rendered; placeholder attribute handles "Type here" text */}
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setVal(e.target.value)}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type here"
                  className="flex-1 w-full min-h-[90px] resize-none bg-transparent font-sans text-xs sm:text-sm text-slate-800 leading-relaxed outline-none select-text focus:ring-0 placeholder:text-2xl placeholder:font-serif placeholder:italic placeholder:text-slate-300/80"
                />

                {/* Quick Tips Box */}
                <div className="bg-blue-50/40 border border-blue-100/90 rounded-xl p-2 sm:p-2.5 mt-auto shrink-0 select-none">
                  <div className="flex items-center gap-1 font-bold text-blue-800 text-[11px] mb-0.5">
                    <Lightbulb size={13} className="text-blue-600" />
                    <span>Quick Tips</span>
                  </div>
                  <ul className="text-[10px] sm:text-[10.5px] text-slate-600 space-y-0.5 pl-3.5 list-disc">
                    <li>
                      Press <strong className="text-slate-800">Enter</strong> for automatic bullets
                    </li>
                    <li>
                      Use <strong className="text-slate-800">toolbar</strong> for formatting
                    </li>
                    <li>
                      Click <strong className="text-slate-800">"Find Phrase"</strong> to search & insert clinical snippets
                    </li>
                  </ul>
                </div>
              </div>

              {/* Bottom Card Toolbar (B, I, U, S, lists, character count, clear) */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0 select-none">
                {/* Left: Formatting tools */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => applyFormatting('**', '**')}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 font-bold text-xs text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    title="Bold (Ctrl+B)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting('*', '*')}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 font-serif italic text-xs text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    title="Italic (Ctrl+I)"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting('<u>', '</u>')}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 underline text-xs text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    title="Underline (Ctrl+U)"
                  >
                    U
                  </button>
                  <button
                    type="button"
                    onClick={() => applyFormatting('~~', '~~')}
                    className="w-6 h-6 rounded-md hover:bg-slate-100 line-through text-xs text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    title="Strikethrough"
                  >
                    S
                  </button>

                  <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

                  <button
                    type="button"
                    onClick={toggleBulletList}
                    className="p-1 rounded-md hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                    title="Bullet List"
                  >
                    <List size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={toggleNumberedList}
                    className="px-1.5 py-0.5 rounded-md hover:bg-slate-100 text-slate-700 text-[10.5px] font-semibold flex items-center gap-0.5 transition-colors cursor-pointer"
                    title="Numbered List"
                  >
                    <span>1.2</span>
                    <ChevronDown size={10} />
                  </button>

                  <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

                  {/* Undo / Redo */}
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex <= 0}
                    className="p-1 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Undo"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-1 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors cursor-pointer"
                    title="Redo"
                  >
                    <RotateCw size={12} />
                  </button>
                </div>

                {/* Right: Character count & trash */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                    {content.length} characters
                  </span>
                  <button
                    type="button"
                    onClick={() => setVal('')}
                    className="p-1 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title="Clear All Text"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── RIGHT CARD: CLINICAL PHRASES (Span 5 on lg) ── */}
            <div
              className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden h-full min-h-0 transition-all duration-150 ${
                activeMobileTab === 'phrases' ? 'flex' : 'hidden lg:flex'
              } ${rightPanelCollapsed ? 'hidden' : 'lg:col-span-5'}`}
            >
              {/* Gradient Blue Header (Exact Reference UI) */}
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-500 text-white p-2.5 sm:p-3 flex items-start justify-between shrink-0 shadow-2xs">
                <div className="flex items-start gap-2">
                  <Sparkles size={16} className="text-blue-200 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-xs sm:text-sm text-white tracking-wide">
                      Clinical Phrases
                    </h3>
                    <p className="text-[10px] text-blue-100/90 font-normal">
                      Predefined phrases for quick insertion
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRightPanelCollapsed(true)}
                  className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition-colors cursor-pointer"
                  title="Collapse panel"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search Bar with Sliders Icon */}
              <div className="px-3 pt-2 pb-1 shrink-0">
                <div className="relative flex items-center">
                  <Search
                    size={14}
                    className="absolute left-2.5 text-slate-400 pointer-events-none"
                  />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search phrases..."
                    className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-blue-400 focus:ring-1 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-400 text-slate-800 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setIsManagerOpen(true)}
                    className="absolute right-2 p-1 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                    title="Manage phrases"
                  >
                    <SlidersHorizontal size={13} />
                  </button>
                </div>
              </div>

              {/* Meta Row: "X of Y phrases" + "+ Add new phrase" */}
              <div className="px-3 py-1 flex items-center justify-between text-[11px] shrink-0 select-none">
                <span className="text-slate-400 font-medium">
                  {filtered.length} of {phrases.length} phrase{phrases.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAddingNew(true);
                    setQuery('');
                  }}
                  className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors cursor-pointer"
                >
                  <Plus size={11} />
                  <span>Add new phrase</span>
                </button>
              </div>

              {/* Quick Add Phrase Input Form */}
              {addingNew && (
                <div className="px-3 pb-2 shrink-0">
                  <div className="flex gap-1.5 p-1.5 rounded-xl bg-blue-50/80 border border-blue-200">
                    <input
                      type="text"
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      placeholder={`New phrase for ${displayTitle}...`}
                      className="flex-1 h-6 px-2 text-xs rounded-lg border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium text-slate-800"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddNewPhrase();
                        if (e.key === 'Escape') {
                          setAddingNew(false);
                          setNewText('');
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddNewPhrase}
                      disabled={!newText.trim()}
                      className="h-6 px-2.5 text-[10.5px] font-semibold bg-blue-600 text-white rounded-lg disabled:opacity-40 hover:bg-blue-700 transition-colors cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddingNew(false);
                        setNewText('');
                      }}
                      className="h-6 px-1.5 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {/* Scrollable Phrase List */}
              <div className="px-3 py-1 flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 min-h-0">
                {filtered.length === 0 ? (
                  <div className="text-center py-6">
                    <Search size={20} className="mx-auto text-slate-300 mb-1.5" />
                    <p className="text-xs text-slate-500 font-medium">No matching phrases</p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      Try searching with different terms or{' '}
                      <button
                        type="button"
                        onClick={() => setAddingNew(true)}
                        className="text-blue-600 underline font-semibold cursor-pointer"
                      >
                        add a new one
                      </button>
                    </p>
                  </div>
                ) : (
                  filtered.map(({ text, idx }) => {
                    const dotColor = DOT_COLORS[idx % DOT_COLORS.length];
                    const isEditing = editingIdx === idx;

                    if (isEditing) {
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 p-1.5 rounded-xl bg-blue-50 border border-blue-200"
                        >
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-1 h-6 px-2 text-xs rounded-lg border border-blue-300 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 font-medium text-slate-800"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditPhrase(idx);
                              if (e.key === 'Escape') setEditingIdx(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEditPhrase(idx)}
                            className="p-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                          >
                            <Check size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingIdx(null)}
                            className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={idx}
                        onClick={() => insertTemplatePhrase(text)}
                        className="group flex items-start justify-between p-2 sm:p-2.5 rounded-xl border border-slate-100 hover:border-blue-200 bg-white hover:bg-blue-50/40 shadow-2xs transition-all cursor-pointer"
                        title="Click to insert"
                      >
                        {/* Colored Dot + Phrase Text */}
                        <div className="flex items-start gap-2 min-w-0 flex-1 pr-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0 mt-1"
                            style={{ backgroundColor: dotColor }}
                          />
                          <span className="text-[11.5px] sm:text-xs text-slate-800 font-medium leading-relaxed group-hover:text-blue-950 transition-colors">
                            {text}
                          </span>
                        </div>

                        {/* Right: Copy/Insert Icon + Hover action buttons */}
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {/* Hover Edit & Delete */}
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingIdx(idx);
                                setEditText(text);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeletePhrase(e, idx)}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>

                          {/* Copy / Insert icon (from Reference UI) */}
                          <div className="p-0.5 text-slate-400 group-hover:text-blue-600 transition-colors">
                            <Copy size={12} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Helper Bar (Matching Reference UI) */}
              <div className="px-3 py-1.5 border-t border-slate-100 bg-blue-50/30 flex items-center justify-between text-xs shrink-0 select-none">
                <div className="flex items-center gap-1 text-blue-700 font-medium text-[10.5px] truncate">
                  <Sparkles size={12} className="text-blue-600 shrink-0" />
                  <span className="truncate">Click a phrase to insert it into the document</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-white border border-blue-200 text-blue-700 text-[9.5px] font-mono font-semibold shadow-2xs shrink-0 ml-1">
                  ⌘ + Enter
                </span>
              </div>
            </div>
          </div>

          {/* ────────────────────────────────────────────────────────
              5. MODAL BOTTOM ACTIONS BAR
             ──────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 mt-2 shrink-0">
            <div className="text-[11px] text-slate-400 hidden sm:block">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-[9.5px] text-slate-600 font-semibold">
                Ctrl + Enter
              </kbd>{' '}
              to save immediately
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold px-3.5 h-8 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5 px-4 h-8 text-xs shadow-sm hover:shadow transition-all cursor-pointer"
              >
                <Check size={14} />
                <span>Save to Prescription</span>
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Full Clinical Phrase Manager Modal */}
      <ClinicalPhraseManagerModal
        open={isManagerOpen}
        onOpenChange={setIsManagerOpen}
        initialSection={sectionKey}
        onSelectPhrase={(phrase) => insertTemplatePhrase(phrase)}
      />
    </>
  );
}
