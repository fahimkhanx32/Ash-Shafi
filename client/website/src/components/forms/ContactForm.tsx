'use client';

import React, { useState } from 'react';
import {
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  EditNote as EditNoteIcon,
  Message as MessageIcon,
  Send as SendIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

import { MUIFormField } from './MUIFormField';
import { MUIFormTextarea } from './MUIFormTextarea';
import { MUIFormButton } from './MUIFormButton';
import { submitContactInquiry } from '@/lib/api';
import { useI18n } from '@/lib/i18nContext';

export interface ContactFormProps {
  className?: string;
  title?: string;
  subtitle?: string;
}

export const ContactForm: React.FC<ContactFormProps> = ({
  className = '',
  title,
  subtitle,
}) => {
  const { t } = useI18n();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    website: '', // honeypot
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = t.forms.requiredField;
    if (!formData.email.trim()) {
      errs.email = t.forms.requiredField;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errs.email = t.forms.invalidEmail;
    }
    if (!formData.message.trim()) errs.message = t.forms.requiredField;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || loading) return;

    setLoading(true);
    setStatusMessage(null);

    const res = await submitContactInquiry({
      name: formData.name.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      subject: formData.subject.trim(),
      message: formData.message.trim(),
      website: formData.website,
    });

    setLoading(false);

    if (res.success) {
      setStatusMessage({ type: 'success', text: res.message || t.forms.successMessage });
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
        website: '',
      });
    } else {
      setStatusMessage({ type: 'error', text: res.message || t.forms.errorMessage });
    }
  };

  return (
    <div
      className={`rounded-2xl border border-white/[0.08] bg-[#07171d]/90 p-6 sm:p-8 lg:p-10 shadow-[0_15px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl ${className}`}
    >
      {(title || subtitle) && (
        <div className="mb-8 text-center sm:text-left">
          {title && (
            <h3 className="font-serif text-2xl font-medium text-[#f4f1e9] sm:text-3xl">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-2 text-sm text-[#aab9bd]">{subtitle}</p>
          )}
        </div>
      )}

      {statusMessage && (
        <div
          className={`mb-6 flex items-start gap-3 rounded-xl p-4 text-sm font-medium ${
            statusMessage.type === 'success'
              ? 'border border-emerald-500/30 bg-emerald-950/40 text-emerald-300'
              : 'border border-red-500/30 bg-red-950/40 text-red-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircleIcon className="h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <ErrorIcon className="h-5 w-5 shrink-0 text-red-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Honeypot field (hidden from real users) */}
        <input
          type="text"
          name="website"
          value={formData.website}
          onChange={handleChange('website')}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Full Name */}
          <MUIFormField
            label={t.forms.fullName}
            value={formData.name}
            onChange={handleChange('name')}
            error={!!errors.name}
            helperText={errors.name}
            required
            icon={<PersonIcon sx={{ color: '#20aaa0' }} />}
            placeholder="e.g. Sarah Jenkins"
          />

          {/* Email Address */}
          <MUIFormField
            label={t.forms.emailAddress}
            type="email"
            value={formData.email}
            onChange={handleChange('email')}
            error={!!errors.email}
            helperText={errors.email}
            required
            icon={<EmailIcon sx={{ color: '#20aaa0' }} />}
            placeholder="name@example.com"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Phone Number */}
          <MUIFormField
            label={t.forms.phoneNumber}
            type="tel"
            value={formData.phone}
            onChange={handleChange('phone')}
            icon={<PhoneIcon sx={{ color: '#20aaa0' }} />}
            placeholder="+880 1700 000000"
          />

          {/* Subject */}
          <MUIFormField
            label={t.forms.subject}
            value={formData.subject}
            onChange={handleChange('subject')}
            icon={<EditNoteIcon sx={{ color: '#20aaa0' }} />}
            placeholder="e.g. Consultation Question"
          />
        </div>

        {/* Message / Query */}
        <MUIFormTextarea
          label={t.forms.message}
          value={formData.message}
          onChange={handleChange('message')}
          error={!!errors.message}
          helperText={errors.message}
          required
          minRows={4}
          icon={<MessageIcon sx={{ color: '#20aaa0' }} />}
          placeholder="Please describe how we can assist you with your health and care..."
        />

        <div className="pt-2">
          <MUIFormButton
            type="submit"
            loading={loading}
            fullWidth
            endIcon={<SendIcon />}
          >
            {t.forms.submit}
          </MUIFormButton>
        </div>
      </form>
    </div>
  );
};

export default ContactForm;
