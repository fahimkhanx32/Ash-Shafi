import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Plus,
  Edit3,
  Trash2,
  RotateCcw,
  Check,
  X,
  Layers,
  HeartPulse,
  Activity,
  History,
  User,
  Cigarette,
  Pill,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  FileSearch,
  FlaskConical,
  Stethoscope,
  Info,
} from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import {
  clinicalPhraseStore,
  SECTION_METADATA,
} from '../../services/clinicalPhraseStore.js';

const ICON_MAP = {
  Activity,
  HeartPulse,
  History,
  User,
  Cigarette,
  Pill,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  FileSearch,
  FlaskConical,
  Stethoscope,
};

export default function ClinicalPhraseManagerModal({
  open,
  onOpenChange,
  initialSection = 'chiefComplaint',
  onSelectPhrase,
}) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [phrasesMap, setPhrasesMap] = useState(clinicalPhraseStore.getAllPhrases());
  const [searchQuery, setSearchQuery] = useState('');
  const [newPhraseInput, setNewPhraseInput] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Sync with store on open or updates
  useEffect(() => {
    if (open) {
      setActiveSection(initialSection);
      setPhrasesMap(clinicalPhraseStore.getAllPhrases());
      setSearchQuery('');
      setNewPhraseInput('');
      setEditingIndex(null);
      setEditingText('');
    }
  }, [open, initialSection]);

  useEffect(() => {
    const unsub = clinicalPhraseStore.subscribe((updated) => {
      setPhrasesMap({ ...updated });
    });
    return () => unsub();
  }, []);

  const showNotification = (msg, type = 'success') => {
    setFeedbackMsg({ msg, type });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const currentSectionMeta = SECTION_METADATA[activeSection] || {
    label: activeSection,
    bangla: '',
    color: 'indigo',
    icon: 'Activity',
  };

  const SectionIcon = ICON_MAP[currentSectionMeta.icon] || Activity;

  const activePhrases = phrasesMap[activeSection] || [];

  const filteredPhrases = useMemo(() => {
    if (!searchQuery.trim()) return activePhrases;
    const q = searchQuery.toLowerCase();
    return activePhrases.filter((p) => p.toLowerCase().includes(q));
  }, [activePhrases, searchQuery]);

  // Handle Create
  const handleAddPhrase = (e) => {
    e?.preventDefault();
    const text = newPhraseInput.trim();
    if (!text) return;
    const ok = clinicalPhraseStore.addPhrase(activeSection, text);
    if (ok) {
      setNewPhraseInput('');
      showNotification('Phrase added to ' + currentSectionMeta.label);
    } else {
      showNotification('Phrase already exists or could not be added', 'error');
    }
  };

  // Handle Edit Start
  const handleStartEdit = (idx, text) => {
    setEditingIndex(idx);
    setEditingText(text);
  };

  // Handle Edit Save
  const handleSaveEdit = (idx) => {
    const text = editingText.trim();
    if (!text) return;
    clinicalPhraseStore.updatePhrase(activeSection, idx, text);
    setEditingIndex(null);
    setEditingText('');
    showNotification('Phrase updated');
  };

  // Handle Delete
  const handleDeletePhrase = (idx) => {
    clinicalPhraseStore.deletePhrase(activeSection, idx);
    showNotification('Phrase removed');
  };

  // Handle Reset Section
  const handleResetSection = () => {
    if (window.confirm(`Reset default medical phrases for "${currentSectionMeta.label}"?`)) {
      clinicalPhraseStore.resetSection(activeSection);
      showNotification('Restored default phrases for ' + currentSectionMeta.label);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-4xl w-full p-0 overflow-hidden rounded-3xl border border-slate-200/80 shadow-2xl bg-white"
    >
      <DialogCloseButton onClose={() => onOpenChange(false)} />

      {/* Header Banner - Soft Gentle Gradient */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
          <Sparkles size={160} />
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
            <Sparkles size={20} />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <span>Clinical Phrases & Snippets</span>
              <span className="text-xs font-normal text-indigo-200/80 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30">
                Customizable
              </span>
            </DialogTitle>
            <p className="text-xs text-slate-300/80 mt-0.5">
              Add, update, or remove rapid clinical phrase shortcuts tailored to your consultation workflow.
            </p>
          </div>
        </div>
      </div>

      {/* Notification Toast Bar */}
      {feedbackMsg && (
        <div
          className={`px-6 py-2 text-xs font-semibold flex items-center justify-between transition-all ${
            feedbackMsg.type === 'error'
              ? 'bg-rose-50 text-rose-700 border-b border-rose-200'
              : 'bg-emerald-50 text-emerald-700 border-b border-emerald-200'
          }`}
        >
          <span>{feedbackMsg.msg}</span>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area - 2 Columns (Categories left, Phrases right) */}
      <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-[460px] max-h-[72vh] overflow-hidden">
        {/* Left: Category Sidebar */}
        <div className="bg-slate-50/70 border-r border-slate-200/80 p-3.5 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-1">
            <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Clinical Categories
            </div>
            {Object.entries(SECTION_METADATA)
              .filter(([secKey]) => secKey !== 'vitals' && secKey !== 'investigations')
              .map(([secKey, meta]) => {
              const Icon = ICON_MAP[meta.icon] || Activity;
              const count = (phrasesMap[secKey] || []).length;
              const isActive = activeSection === secKey;
              return (
                <button
                  key={secKey}
                  type="button"
                  onClick={() => {
                    setActiveSection(secKey);
                    setSearchQuery('');
                    setEditingIndex(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100 ring-1 ring-indigo-200/50'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      size={15}
                      className={isActive ? 'text-indigo-600' : 'text-slate-400'}
                    />
                    <span className="truncate">{meta.label}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-200/60 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-200/60 mt-4 px-1">
            <button
              type="button"
              onClick={handleResetSection}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50/60 rounded-xl transition-all font-medium border border-slate-200/60"
              title="Reset current category to factory defaults"
            >
              <RotateCcw size={12} />
              <span>Reset this category</span>
            </button>
          </div>
        </div>

        {/* Right: Active Section Phrase CRUD */}
        <div className="p-5 flex flex-col justify-between overflow-hidden bg-white">
          <div className="space-y-4 overflow-hidden flex flex-col flex-1">
            {/* Active Header & Live Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100/80">
                  <SectionIcon size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span>{currentSectionMeta.label}</span>
                    {currentSectionMeta.bangla && (
                      <span className="text-xs font-normal text-slate-400">
                        ({currentSectionMeta.bangla})
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {activePhrases.length} total phrase{activePhrases.length === 1 ? '' : 's'} available
                  </p>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative w-full sm:w-60">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="text"
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-xl bg-slate-50 border border-slate-200/80 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  placeholder="Filter phrases..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Quick Add Phrase Input */}
            <form onSubmit={handleAddPhrase} className="flex gap-2 shrink-0">
              <input
                type="text"
                value={newPhraseInput}
                onChange={(e) => setNewPhraseInput(e.target.value)}
                placeholder={`+ Add a new phrase to ${currentSectionMeta.label}...`}
                className="flex-1 h-9 px-3.5 text-xs rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newPhraseInput.trim()}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm hover:shadow gap-1.5"
              >
                <Plus size={14} />
                <span>Add Phrase</span>
              </Button>
            </form>

            {/* Phrases Scrollable List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {filteredPhrases.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <Info size={28} className="mb-2 text-slate-300" />
                  <p className="text-xs font-medium">No phrases found</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {searchQuery
                      ? 'Try a different keyword or clear search'
                      : 'Type above to add your first clinical phrase for this section'}
                  </p>
                </div>
              ) : (
                filteredPhrases.map((phrase, idx) => {
                  const originalIndex = activePhrases.indexOf(phrase);
                  const isEditing = editingIndex === originalIndex;

                  if (isEditing) {
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-xl bg-indigo-50/70 border border-indigo-200"
                      >
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="flex-1 h-8 px-3 text-xs bg-white rounded-lg border border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-400 font-medium text-slate-800"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(originalIndex);
                            if (e.key === 'Escape') setEditingIndex(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(originalIndex)}
                          className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-semibold shadow-xs"
                          title="Save change (Enter)"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold"
                          title="Cancel (Esc)"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="group flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-indigo-100 bg-white hover:bg-indigo-50/30 transition-all shadow-2xs hover:shadow-xs"
                    >
                      <div
                        className="flex items-start gap-2.5 flex-1 cursor-pointer pr-3 select-text"
                        onClick={() => {
                          if (onSelectPhrase) {
                            onSelectPhrase(phrase);
                            onOpenChange(false);
                          }
                        }}
                        title={onSelectPhrase ? 'Click to insert into document' : undefined}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 shrink-0 group-hover:scale-125 transition-transform" />
                        <span className="text-xs text-slate-800 font-medium leading-relaxed group-hover:text-indigo-900 transition-colors">
                          {phrase}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {onSelectPhrase && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectPhrase(phrase);
                              onOpenChange(false);
                            }}
                            className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors mr-1"
                          >
                            + Insert
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEdit(originalIndex, phrase)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit phrase"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePhrase(originalIndex)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete phrase"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Bar */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <span className="text-[11px] text-slate-400">
              💡 Tip: Click any phrase to immediately copy or insert into your prescription notes.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
