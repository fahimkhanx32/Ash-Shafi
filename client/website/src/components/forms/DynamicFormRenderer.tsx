'use client';

import React, { useState } from 'react';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Message as MessageIcon,
  CalendarMonth as CalendarMonthIcon,
  AccessTime as AccessTimeIcon,
  Send as SendIcon,
  MedicalServices as MedicalServicesIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

import { MUIFormField } from './MUIFormField';
import { MUIFormTextarea } from './MUIFormTextarea';
import { MUIFormSelect, SelectOption } from './MUIFormSelect';
import { MUIFormDateField } from './MUIFormDateField';
import { MUIFormTimeField } from './MUIFormTimeField';
import { MUIFormButton } from './MUIFormButton';

export interface FormFieldSchema {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'textarea' | 'select' | 'date' | 'time';
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  defaultValue?: string;
}

export interface DynamicFormRendererProps {
  fields: FormFieldSchema[];
  title?: string;
  subtitle?: string;
  submitLabel?: string;
  onSubmit?: (data: Record<string, any>) => Promise<boolean>;
  className?: string;
}

export const DynamicFormRenderer: React.FC<DynamicFormRendererProps> = ({
  fields,
  title,
  subtitle,
  submitLabel = 'Submit',
  onSubmit,
  className = '',
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    fields.forEach((f) => {
      init[f.name] = f.defaultValue || '';
    });
    return init;
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const getIconForType = (type: string, name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('name') || lowerName.includes('patient')) return <PersonIcon sx={{ color: '#20aaa0' }} />;
    if (type === 'email' || lowerName.includes('email')) return <EmailIcon sx={{ color: '#20aaa0' }} />;
    if (type === 'tel' || lowerName.includes('phone')) return <PhoneIcon sx={{ color: '#20aaa0' }} />;
    if (type === 'date' || lowerName.includes('date')) return <CalendarMonthIcon sx={{ color: '#20aaa0' }} />;
    if (type === 'time' || lowerName.includes('time')) return <AccessTimeIcon sx={{ color: '#20aaa0' }} />;
    if (type === 'select' || lowerName.includes('service')) return <MedicalServicesIcon sx={{ color: '#20aaa0' }} />;
    if (type === 'textarea' || lowerName.includes('message')) return <MessageIcon sx={{ color: '#20aaa0' }} />;
    return undefined;
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.required && !formData[field.name]?.toString().trim()) {
        errs[field.name] = `${field.label} is required`;
      } else if (field.type === 'email' && formData[field.name]) {
        if (!/\S+@\S+\.\S+/.test(formData[field.name])) {
          errs[field.name] = 'Invalid email address';
        }
      }
    });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (name: string) => (e: any) => {
    const val = e?.target ? e.target.value : e;
    setFormData((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || loading) return;

    setLoading(true);
    if (onSubmit) {
      const ok = await onSubmit(formData);
      setLoading(false);
      if (ok) setSubmitted(true);
    } else {
      setTimeout(() => {
        setLoading(false);
        setSubmitted(true);
      }, 700);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#07171d]/95 p-6 sm:p-8 lg:p-10 shadow-[0_15px_40px_rgba(0,0,0,0.4)] backdrop-blur-xl ${className}`}
    >
      {(title || subtitle) && (
        <div className="mb-8 text-center sm:text-left">
          {title && (
            <h3 className="font-serif text-2xl font-medium text-[#f4f1e9] sm:text-3xl">
              {title}
            </h3>
          )}
          {subtitle && <p className="mt-2 text-sm text-[#aab9bd]">{subtitle}</p>}
        </div>
      )}

      {submitted ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-950/50 text-emerald-400">
            <CheckCircleIcon sx={{ fontSize: 32 }} />
          </div>
          <h4 className="font-serif text-xl font-medium text-[#f4f1e9]">
            Submission Received
          </h4>
          <p className="mt-2 max-w-md text-sm text-[#aab9bd]">
            Thank you. Your submission has been processed.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {fields.map((field) => {
              const isFullWidth = field.type === 'textarea';
              const icon = getIconForType(field.type, field.name);

              if (field.type === 'textarea') {
                return (
                  <div key={field.name} className="col-span-1 sm:col-span-2">
                    <MUIFormTextarea
                      label={field.label}
                      value={formData[field.name] || ''}
                      onChange={handleChange(field.name)}
                      error={!!errors[field.name]}
                      helperText={errors[field.name]}
                      required={field.required}
                      icon={icon}
                      placeholder={field.placeholder}
                    />
                  </div>
                );
              }

              if (field.type === 'select') {
                return (
                  <div
                    key={field.name}
                    className={isFullWidth ? 'col-span-1 sm:col-span-2' : 'col-span-1'}
                  >
                    <MUIFormSelect
                      label={field.label}
                      value={formData[field.name] || ''}
                      onChange={handleChange(field.name)}
                      options={field.options || []}
                      error={!!errors[field.name]}
                      helperText={errors[field.name]}
                      icon={icon}
                    />
                  </div>
                );
              }

              if (field.type === 'date') {
                return (
                  <div key={field.name} className="col-span-1">
                    <MUIFormDateField
                      label={field.label}
                      value={formData[field.name] || ''}
                      onChange={handleChange(field.name)}
                      error={!!errors[field.name]}
                      helperText={errors[field.name]}
                      required={field.required}
                      icon={icon}
                    />
                  </div>
                );
              }

              if (field.type === 'time') {
                return (
                  <div key={field.name} className="col-span-1">
                    <MUIFormTimeField
                      label={field.label}
                      value={formData[field.name] || ''}
                      onChange={handleChange(field.name)}
                      error={!!errors[field.name]}
                      helperText={errors[field.name]}
                      required={field.required}
                      icon={icon}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={field.name}
                  className={isFullWidth ? 'col-span-1 sm:col-span-2' : 'col-span-1'}
                >
                  <MUIFormField
                    label={field.label}
                    type={field.type}
                    value={formData[field.name] || ''}
                    onChange={handleChange(field.name)}
                    error={!!errors[field.name]}
                    helperText={errors[field.name]}
                    required={field.required}
                    icon={icon}
                    placeholder={field.placeholder}
                  />
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <MUIFormButton
              type="submit"
              loading={loading}
              fullWidth
              endIcon={<SendIcon />}
            >
              {submitLabel}
            </MUIFormButton>
          </div>
        </form>
      )}
    </div>
  );
};

export default DynamicFormRenderer;
