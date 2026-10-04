import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Droplet,
  EyeOff,
  HeartPulse,
  Languages,
  Mail,
  MessageCircle,
  MessagesSquare,
  Minus,
  Phone,
  Save,
  Smartphone,
  User,
  UserRound,
  Users,
} from 'lucide-react';


export const controlClass =
  'w-full min-w-0 bg-transparent py-3.5 text-base sm:text-sm text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60 [color-scheme:dark]';

export function FormHero({ icon: Icon, title, description }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10 text-primary">
          {Icon ? <Icon size={30} aria-hidden="true" /> : null}
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="hidden shrink-0 items-center gap-3 text-primary/80 md:flex" aria-hidden="true">
        <span className="-rotate-6 text-right text-lg italic leading-tight"> Better Care <br /> Starts With You </span>
        <HeartPulse size={44} strokeWidth={1.5} />
      </div>
    </div>
  );
}

export function FormSection({ icon: Icon, title, children, columns = 2 }) {
  return (
    <section className="mb-9">
      <div className="mb-6 flex items-center gap-3">
        {Icon ? <Icon size={22} className="shrink-0 text-primary" aria-hidden="true" /> : null}
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className={`grid gap-x-8 gap-y-6 ${columns === 1 ? '' : 'sm:grid-cols-2'}`}>{children}</div>
    </section>
  );
}

/** Bordered pill with the label sitting on the top border. */
const SURFACES = { background: 'bg-background', card: 'bg-card' };

export function FloatField({
  label,
  icon: Icon,
  children,
  hint,
  className = '',
  alignTop = false,
  surface = 'background',
  htmlFor,
}) {
  return (
    <div className={className}>
      <div className="relative">
        <label htmlFor={htmlFor} className={`absolute -top-2.5 left-5 z-10 px-2 text-xs font-medium text-foreground ${SURFACES[surface] || SURFACES.background}`}>
          {label}
        </label>
        <div className={`flex gap-3 rounded-2xl border border-primary/40 bg-card/40 px-4 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 ${ alignTop ? 'items-start' : 'items-center' }`} > {Icon ? ( <Icon size={18} className={`shrink-0 text-primary ${alignTop ? 'mt-4' : ''}`} aria-hidden="true" /> ) : null} {children} </div>
      </div>
      {hint ? <p className="mt-1.5 px-2 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FloatInput({ label, icon, hint, className, ...props }) {
  return (
    <FloatField label={label} icon={icon} hint={hint} className={className}>
      <input className={controlClass} {...props} />
    </FloatField>
  );
}

// ---------------------------------------------------------------------------
// FloatSelect — custom dropdown (replaces the native <select>, whose popup
// the browser draws and CSS cannot style or put icons in).
//
// Drop-in compatible with the old API: callers can keep passing <option>
// children and an `onChange` that reads `e.target.value`. Icons come from
// OPTION_ICONS (keyed by option value) or, per option, from the optional
// `options` prop: [{ value, label, icon, disabled }] which wins over children.
// ---------------------------------------------------------------------------

const BLOOD_GROUP = /^(A|B|AB|O)[+-]$/;

const OPTION_ICONS = {
  // gender
  MALE: User,
  FEMALE: UserRound,
  OTHER: Users,
  PREFER_NOT_TO_SAY: EyeOff,
  // blood group
  UNKNOWN: Droplet,
  // preferred contact method
  EMAIL: Mail,
  SMS: Smartphone,
  PHONE: Phone,
  WHATSAPP: MessageCircle,
  MESSENGER: MessagesSquare,
  // language
  en: Languages,
  bn: Languages,
  hi: Languages,
  ur: Languages,
};

const iconFor = (value) => (BLOOD_GROUP.test(value) ? Droplet : OPTION_ICONS[value] || null);
const toneFor = (value) => (BLOOD_GROUP.test(value) || value === 'UNKNOWN' ? 'text-red-400' : 'text-primary');

const textOf = (node) =>
  Children.toArray(node)
    .map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : ''))
    .join('');

function normalizeOptions(options, children) {
  const list = Array.isArray(options)
    ? options
    : Children.toArray(children)
        .filter((c) => isValidElement(c) && c.type === 'option')
        .map((c) => ({
          value: c.props.value ?? textOf(c.props.children),
          label: textOf(c.props.children),
          disabled: Boolean(c.props.disabled),
        }));
  return list.map((o) => {
    const value = String(o.value ?? '');
    return {
      value,
      label: o.label ?? value,
      disabled: Boolean(o.disabled),
      icon: value === '' ? Minus : o.icon || iconFor(value),
    };
  });
}

export function FloatSelect({
  label,
  icon,
  hint,
  className,
  surface,
  children,
  options,
  value,
  onChange,
  name,
  id,
  disabled = false,
  required = false,
}) {
  const autoId = useId();
  const buttonId = id || `float-select-${autoId}`;
  const listId = `${buttonId}-list`;
  const items = normalizeOptions(options, children);
  const current = String(value ?? '');
  const selectedIndex = items.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;
  const isPlaceholder = !selected || selected.value === '';

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  // The menu is portalled to <body> with fixed positioning so it is never
  // clipped by a scrolling parent (e.g. the Register patient dialog body).
  // It is measured from the field's pill, opens upward when there is not
  // enough room below, and follows the field on scroll/resize.
  const place = () => {
    const pill = rootRef.current?.parentElement;
    if (!pill) return;
    const r = pill.getBoundingClientRect();
    const gap = 8;
    const below = window.innerHeight - r.bottom - gap - 8;
    const above = r.top - gap - 8;
    const openUp = below < 200 && above > below;
    const maxHeight = Math.max(120, Math.min(240, openUp ? above : below));
    setPos({
      left: r.left,
      width: r.width,
      maxHeight,
      ...(openUp ? { bottom: window.innerHeight - r.top + gap } : { top: r.bottom + gap }),
    });
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  // Close on outside click (the portalled list counts as inside).
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the keyboard-highlighted row visible.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const openMenu = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const choose = (index) => {
    const item = items[index];
    if (!item || item.disabled) return;
    onChange?.({ target: { name, value: item.value } });
    setOpen(false);
  };

  const step = (from, dir) => {
    let i = from;
    for (let n = 0; n < items.length; n += 1) {
      i = (i + dir + items.length) % items.length;
      if (!items[i].disabled) return i;
    }
    return from;
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        if (!open) openMenu();
        else setActive((a) => step(a, e.key === 'ArrowDown' ? 1 : -1));
        break;
      case 'Home':
        if (open) { e.preventDefault(); setActive(step(-1, 1)); }
        break;
      case 'End':
        if (open) { e.preventDefault(); setActive(step(items.length, -1)); }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (open) choose(active);
        else openMenu();
        break;
      case 'Escape':
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // don't also close a parent Dialog
          setOpen(false);
        }
        break;
      case 'Tab':
        setOpen(false);
        break;
      default:
    }
  };

  const SelectedIcon = selected?.icon;

  return (
    <FloatField label={label} icon={icon} hint={hint} className={className} surface={surface} htmlFor={buttonId}>
      <div ref={rootRef} className="min-w-0 flex-1">
        {name ? <input type="hidden" name={name} value={current} /> : null}
        <button
          type="button"
          id={buttonId}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-required={required || undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
          className={`flex w-full min-w-0 items-center gap-2 bg-transparent py-3.5 text-left text-base outline-none disabled:opacity-60 sm:text-sm ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          {SelectedIcon && !isPlaceholder ? (
            <SelectedIcon size={16} className={`shrink-0 ${toneFor(selected.value)}`} aria-hidden="true" />
          ) : null}
          <span className={`min-w-0 flex-1 truncate ${isPlaceholder ? 'text-muted-foreground/70' : 'text-foreground'}`}>
            {selected ? selected.label : ''}
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {open && pos
          ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={buttonId}
            style={pos}
            className="fixed z-[100] overflow-auto rounded-xl border border-border bg-card p-2 text-sm font-medium text-foreground shadow-xl"
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              const isSelected = i === selectedIndex;
              return (
                <li
                  key={`${item.value}-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={item.disabled || undefined}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => !item.disabled && setActive(i)}
                  onClick={() => choose(i)}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                    item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${i === active ? 'bg-primary/10' : ''} ${
                    item.value === '' ? 'text-muted-foreground' : ''
                  }`}
                >
                  {Icon ? (
                    <Icon size={16} className={`shrink-0 ${item.value === '' ? 'text-muted-foreground' : toneFor(item.value)}`} aria-hidden="true" />
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {isSelected ? <Check size={16} className="shrink-0 text-primary" aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ul>,
          document.body,
        )
          : null}
      </div>
    </FloatField>
  );
}

export function FloatTextarea({ label, icon, hint, className, rows = 3, ...props }) {
  return (
    <FloatField label={label} icon={icon} hint={hint} className={className} alignTop>
      <textarea rows={rows} className={`${controlClass} resize-y`} {...props} />
    </FloatField>
  );
}

/** Read-only value shown in the same pill (identity fields set by an admin). */
export function FloatReadOnly({ label, icon, value, className }) {
  return (
    <FloatField label={label} icon={icon} className={className}>
      <p className="w-full py-3.5 text-base sm:text-sm text-muted-foreground">{value || '—'}</p>
    </FloatField>
  );
}

export function SaveBar({ saving, onClick, label = 'Save Changes', savingLabel = 'Saving…', type = 'submit' }) {
  return (
    <div className="sticky bottom-4 z-20 mt-2 flex justify-end"> <button type={type} onClick={onClick} disabled={saving} className="inline-flex min-h-[48px] items-center gap-3 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:opacity-90 disabled:opacity-60" > <Save size={18} aria-hidden="true" /> {saving ? savingLabel : label} <ChevronRight size={18} aria-hidden="true" /> </button> </div>
  );
}
