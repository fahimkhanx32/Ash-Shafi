'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useI18n } from '@/lib/i18nContext';

export interface MUITimePickerProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  className?: string;
}

const COMMON_SLOTS = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '12:00 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
  '04:30 PM',
  '05:00 PM',
  '05:30 PM',
  '06:00 PM',
];

export const MUITimePicker: React.FC<MUITimePickerProps> = ({
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

  // Close popup on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSlotClick = (slot: string) => {
    onChange(slot);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <TextField
        fullWidth
        label={label || t.forms.preferredTime}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        helperText={
          helperText || (
            <span className="text-gray-400 text-[11px]">
              {t.forms.manualInputHint}
            </span>
          )
        }
        placeholder={t.forms.timePlaceholder}
        required={required}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <AccessTimeIcon sx={{ color: '#20aaa0' }} />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="Select Consultation Time Slot">
                  <IconButton
                    size="small"
                    onClick={() => setIsOpen(!isOpen)}
                    sx={{
                      color: isOpen ? '#20aaa0' : '#aab9bd',
                      bgcolor: isOpen ? 'rgba(32,170,160,0.15)' : 'transparent',
                      '&:hover': { color: '#20aaa0', bgcolor: 'rgba(32,170,160,0.12)' },
                    }}
                  >
                    <ScheduleIcon fontSize="small" />
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

      {/* TIME SLOTS POPUP */}
      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:w-[320px] top-[calc(100%+6px)] z-50 rounded-2xl border border-[#20aaa0]/30 bg-[#07181f]/95 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl animate-fadeIn">
          <div className="mb-2.5 flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="font-serif text-xs font-semibold text-[#f4f1e9]">
              {language === 'bn' ? 'পছন্দের সময় স্লট বেছে নিন' : 'Select Time Slot'}
            </span>
            <span className="text-[10px] text-[#20aaa0]">
              {language === 'bn' ? 'সরাসরি লিখেও দিতে পারেন' : 'or type custom'}
            </span>
          </div>

          {/* MORNING SLOTS */}
          <div className="mb-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">
              {language === 'bn' ? 'সকাল / দুপুর' : 'Morning / Midday'}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {COMMON_SLOTS.slice(0, 7).map((slot) => {
                const isSelected = value.toLowerCase() === slot.toLowerCase();
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleSlotClick(slot)}
                    className={`rounded-lg py-1.5 text-center text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#20aaa0] text-[#030b0e] font-bold shadow-[0_0_10px_rgba(32,170,160,0.5)]'
                        : 'border border-white/[0.08] bg-white/[0.03] text-gray-200 hover:border-[#20aaa0]/50 hover:bg-[#20aaa0]/10 hover:text-white'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AFTERNOON / EVENING SLOTS */}
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-1.5">
              {language === 'bn' ? 'বিকাল / সন্ধ্যা' : 'Afternoon / Evening'}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {COMMON_SLOTS.slice(7).map((slot) => {
                const isSelected = value.toLowerCase() === slot.toLowerCase();
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleSlotClick(slot)}
                    className={`rounded-lg py-1.5 text-center text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#20aaa0] text-[#030b0e] font-bold shadow-[0_0_10px_rgba(32,170,160,0.5)]'
                        : 'border border-white/[0.08] bg-white/[0.03] text-gray-200 hover:border-[#20aaa0]/50 hover:bg-[#20aaa0]/10 hover:text-white'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-3 border-t border-white/[0.08] pt-2 flex items-center justify-between text-[10px] text-gray-400">
            <span>{language === 'bn' ? 'প্রতি রোগী সময়: ১৫-৩০ মিনিট' : 'Slots: 15-30 min per patient'}</span>
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

export default MUITimePicker;
