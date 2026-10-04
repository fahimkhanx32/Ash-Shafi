import { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, MessageSquareHeart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button.jsx';

const COMMON_ADVICE = [
  'পানি মেপে খাবেন (১.৫ - ২ লিটার/দিন)',
  'লবণ কম খাবেন',
  'ডায়াবেটিসের খাদ্যতালিকা মেনে চলুন',
  'নিয়মিত রক্তচাপ ও রক্তের শর্করা পরীক্ষা করুন',
  'HOSPITAL ADMISSION IN FEMALE PAYING NEPHROLOGY WARD',
  'পরবর্তী সাক্ষাতের পূর্বে রক্ত ও প্রস্রাবের রিপোর্ট করিয়ে আনবেন',
  'ভারী কাজ ও অতিরিক্ত পরিশ্রম থেকে বিরত থাকুন',
  'ধূমপান ও জর্দা সম্পূর্ণ বর্জন করুন',
];

const generateId = () => `adv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export default function AdviceBuilder({ advice = [], onChange, disabled = false }) {
  const { t } = useTranslation();
  const [customText, setCustomText] = useState('');

  // Normalize advice list to array of objects { id, text, displayOrder }
  const normalizedList = Array.isArray(advice)
    ? advice.map((a, i) => (typeof a === 'string' ? { id: generateId(), text: a, displayOrder: i + 1 } : a))
    : typeof advice === 'string' && advice.trim()
    ? [{ id: generateId(), text: advice, displayOrder: 1 }]
    : [];

  const addAdvice = (text) => {
    if (!text || !text.trim()) return;
    const item = {
      id: generateId(),
      text: text.trim(),
      displayOrder: normalizedList.length + 1,
    };
    onChange([...normalizedList, item]);
    setCustomText('');
  };

  const updateAdvice = (index, newText) => {
    const next = normalizedList.map((adv, i) => (i === index ? { ...adv, text: newText } : adv));
    onChange(next);
  };

  const removeAdvice = (index) => {
    const next = normalizedList.filter((_, i) => i !== index);
    onChange(next);
  };

  const moveAdvice = (from, to) => {
    if (to < 0 || to >= normalizedList.length) return;
    const next = [...normalizedList];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-1.5">
        <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
          <MessageSquareHeart size={15} className="text-emerald-600" />
          <span>{t('clinical.prescription.advice', 'Advice (উপদেশ)')}</span>
          <span className="text-[10px] text-muted-foreground">({normalizedList.length})</span>
        </div>
      </div>

      {/* Preset Quick Chips */}
      {!disabled && (
        <div className="space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground">
            {t('clinical.prescription.frequentAdvice', 'Quick Select Common Advice:')}
          </span>
          <div className="flex flex-wrap gap-1">
            {COMMON_ADVICE.map((adv) => {
              const alreadyAdded = normalizedList.some((a) => a.text?.toLowerCase() === adv.toLowerCase());
              return (
                <button
                  key={adv}
                  type="button"
                  disabled={alreadyAdded}
                  className={`px-2 py-0.5 rounded-md text-[10px] border transition-colors ${
                    alreadyAdded
                      ? 'bg-muted text-muted-foreground/50 border-border cursor-not-allowed'
                      : 'bg-card hover:bg-accent hover:border-primary text-foreground border-border'
                  }`}
                  onClick={() => addAdvice(adv)}
                >
                  + {adv}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Advice Input Bar */}
      {!disabled && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder={t('clinical.prescription.customAdvicePlaceholder', 'Type custom advice and press Enter or Add...')}
            className="w-full h-8 px-3 rounded-lg border border-border bg-background text-xs"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addAdvice(customText);
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 px-3 text-xs"
            onClick={() => addAdvice(customText)}
            disabled={!customText.trim()}
          >
            <Plus size={13} /> {t('common.add', 'Add')}
          </Button>
        </div>
      )}

      {/* Active Advice List */}
      <div className="space-y-1.5">
        {normalizedList.map((adv, index) => (
          <div
            key={adv.id || adv._id || `adv_${index}`}
            className="flex items-center justify-between gap-2 p-2 rounded-lg border border-border bg-card shadow-xs text-xs"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="font-bold text-muted-foreground text-[10px]">{index + 1}.</span>
              <input
                type="text"
                disabled={disabled}
                className="w-full bg-transparent border-0 font-medium text-foreground text-xs p-0 focus:ring-0"
                value={adv.text || ''}
                onChange={(e) => updateAdvice(index, e.target.value)}
              />
            </div>

            {!disabled && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  disabled={index === 0}
                  onClick={() => moveAdvice(index, index - 1)}
                >
                  <ArrowUp size={11} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground"
                  disabled={index === normalizedList.length - 1}
                  onClick={() => moveAdvice(index, index + 1)}
                >
                  <ArrowDown size={11} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAdvice(index)}
                >
                  <Trash2 size={11} />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
