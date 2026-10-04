import { useState } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PasswordField({
  label,
  autoComplete = 'current-password',
  ...props
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      label={label ?? t('auth.password.label')}
      type={visible ? 'text' : 'password'}
      autoComplete={autoComplete}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Lock size={18} aria-hidden="true" />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              aria-label={visible ? t('auth.password.hide') : t('auth.password.show')}
              onClick={() => setVisible((v) => !v)}
              edge="end"
              size="small"
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </IconButton>
          </InputAdornment>
        ),
      }}
      {...props}
    />
  );
}
