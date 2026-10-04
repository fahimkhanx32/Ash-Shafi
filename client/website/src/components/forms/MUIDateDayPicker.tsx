'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  CalendarMonth as CalendarMonthIcon,
  Today as TodayIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { useI18n } from '@/lib/i18nContext';

export interface MUIDateDayPickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  className?: string;
}

export const MUIDateDayPicker: React.FC<MUIDateDayPickerProps> = ({
  label,
  value,
  onChange,
  error,
  helperText,
  required = false,
  className = '',
}) => {
  const { t, language } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current date or default to today
  const parseDate = (val: string): Date | null => {
    if (!val) return null;
    const directDate = new Date(val);
    if (!isNaN(directDate.getTime())) return directDate;

    // Try DD/MM/YYYY or DD-MM-YYYY
    const parts = val.split(/[-/.]/);
    if (parts.length === 3) {
      // If first part is 4 digits -> YYYY/MM/DD
      if (parts[0].length === 4) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        if (!isNaN(d.getTime())) return d;
      } else {
        // Assume DD/MM/YYYY
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (!isNaN(d.getTime())) return d;
      }
    }
    return null;
  };

  const selectedDateObj = parseDate(value);
  const [viewDate, setViewDate] = useState<Date>(selectedDateObj || new Date());

  // Close calendar popup on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format Day name
  const getDayName = (date: Date): string => {
    const dayIndex = date.getDay();
    return t.forms.daysOfWeek?.[dayIndex] || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayIndex];
  };

  // Format standard YYYY-MM-DD
  const formatYMD = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDateSelect = (date: Date) => {
    const formatted = formatYMD(date);
    onChange(formatted);
    setIsOpen(false);
  };

  // Calendar matrix calculations
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const bnMonthNames = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];

  const currentMonthLabel = language === 'bn' 
    ? `${bnMonthNames[month]} ${year}` 
    : `${monthNames[month]} ${year}`;

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Quick preset shortcuts
  const selectToday = () => {
    const d = new Date();
    setViewDate(d);
    handleDateSelect(d);
  };

  const selectTomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setViewDate(d);
    handleDateSelect(d);
  };

  const selectNextClinicDay = () => {
    const d = new Date();
    // In BD clinic, Friday is off, Saturday is active. Find next non-Friday day.
    d.setDate(d.getDate() + (d.getDay() === 5 ? 1 : 1));
    setViewDate(d);
    handleDateSelect(d);
  };

  // Day columns header
  const dayHeaders = language === 'bn'
    ? ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* TEXT INPUT WITH TYPE-MANUALLY AND PICKER TOGGLE */}
      <TextField
        fullWidth
        label={label || t.forms.preferredDate}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        helperText={
          helperText || (
            selectedDateObj ? (
              <span className="flex items-center gap-1.5 text-[#20aaa0] font-medium mt-1">
                <EventNoteIcon sx={{ fontSize: 14 }} />
                <span>
                  {t.forms.dayLabel}: <strong className="text-white">{getDayName(selectedDateObj)}</strong> ({selectedDateObj.toLocaleDateString(language === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
                </span>
              </span>
            ) : (
              <span className="text-gray-400 text-[11px]">
                {t.forms.manualInputHint}
              </span>
            )
          )
        }
        placeholder={t.forms.dateDayPlaceholder}
        required={required}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <CalendarMonthIcon sx={{ color: '#20aaa0' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Open Calendar Picker">
                  <IconButton
                    size="small"
                    onClick={() => setIsOpen(!isOpen)}
                    sx={{
                      color: isOpen ? '#20aaa0' : '#aab9bd',
                      bgcolor: isOpen ? 'rgba(32,170,160,0.15)' : 'transparent',
                      '&:hover': { color: '#20aaa0', bgcolor: 'rgba(32,170,160,0.12)' },
                    }}
                  >
                    <TodayIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          },
          inputLabel: {
            shrink: true,
          } as any,
        }}
      />

      {/* INTERACTIVE CALENDAR DROPDOWN POPUP */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-[340px] top-[calc(100%+6px)] z-50 rounded-2xl border border-[#20aaa0]/30 bg-[#07181f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-fadeIn">
          {/* POPUP HEADER */}
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-gray-300 transition hover:border-[#20aaa0]/50 hover:bg-[#20aaa0]/10 hover:text-white"
              aria-label="Previous Month"
            >
              <ChevronLeftIcon fontSize="small" />
            </button>

            <span className="font-serif text-sm font-semibold tracking-wide text-[#f4f1e9]">
              {currentMonthLabel}
            </span>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-gray-300 transition hover:border-[#20aaa0]/50 hover:bg-[#20aaa0]/10 hover:text-white"
              aria-label="Next Month"
            >
              <ChevronRightIcon fontSize="small" />
            </button>
          </div>

          {/* QUICK SHORTCUT PRESETS */}
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
            <button
              type="button"
              onClick={selectToday}
              className="shrink-0 rounded-full border border-[#20aaa0]/30 bg-[#20aaa0]/[0.08] px-2.5 py-1 text-[#20aaa0] transition hover:bg-[#20aaa0]/20"
            >
              {language === 'bn' ? 'আজ' : 'Today'}
            </button>
            <button
              type="button"
              onClick={selectTomorrow}
              className="shrink-0 rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-gray-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              {language === 'bn' ? 'আগামীকাল' : 'Tomorrow'}
            </button>
            <button
              type="button"
              onClick={selectNextClinicDay}
              className="shrink-0 rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-1 text-gray-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              {language === 'bn' ? 'পরবর্তী চেম্বার দিন' : 'Next Clinic Day'}
            </button>
          </div>

          {/* DAY OF WEEK COLUMNS */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-gray-400 mb-1">
            {dayHeaders.map((dh, idx) => (
              <div key={idx} className={idx === 5 ? 'text-amber-400/80' : ''}>
                {dh}
              </div>
            ))}
          </div>

          {/* DAYS GRID */}
          <div className="grid grid-cols-7 gap-1">
            {/* Prev month fill */}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => {
              const dayNum = daysInPrevMonth - firstDayOfMonth + idx + 1;
              return (
                <div
                  key={`prev-${idx}`}
                  className="flex h-8 w-full items-center justify-center text-[11px] text-gray-600 select-none"
                >
                  {dayNum}
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateCell = new Date(year, month, dayNum);
              const isSelected = selectedDateObj && formatYMD(selectedDateObj) === formatYMD(dateCell);
              const isToday = formatYMD(new Date()) === formatYMD(dateCell);
              const dayOfWeek = dateCell.getDay();
              const isFriday = dayOfWeek === 5;

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => handleDateSelect(dateCell)}
                  className={`flex h-8 w-full items-center justify-center rounded-lg text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-[#20aaa0] text-[#030b0e] font-bold shadow-[0_0_12px_rgba(32,170,160,0.6)]'
                      : isToday
                      ? 'border border-[#20aaa0] text-[#20aaa0] bg-[#20aaa0]/10 hover:bg-[#20aaa0]/20'
                      : isFriday
                      ? 'text-amber-400/70 hover:bg-white/[0.06] hover:text-white'
                      : 'text-gray-200 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>

          {/* FOOTER NOTICE */}
          <div className="mt-3 border-t border-white/[0.08] pt-2 text-[10px] text-gray-400 flex items-center justify-between">
            <span>{language === 'bn' ? 'চেম্বার: শনি - বৃহস্পতি' : 'Clinic: Sat - Thu (9 AM - 6 PM)'}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[#20aaa0] hover:underline"
            >
              {language === 'bn' ? 'বন্ধ করুন' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MUIDateDayPicker;
