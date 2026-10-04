import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeProvider, CssBaseline } from '@mui/material';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import {
  Mail,
  Key,
  Eye,
  EyeOff,
  LogIn,
  NotebookPen,
  CircleUserRound,
  CircleCheckBig,
} from 'lucide-react';

import { useAuth } from '../providers/AuthProvider.jsx';
import { extractApiError } from '../services/apiClient.js';
import { buildLoginSchema } from '../schemas/authSchemas.js';
import { muiFormTheme } from '../themes/muiFormTheme.js';
import FormError from '../components/auth/FormError.jsx';

const REMEMBER_KEY = 'ashshafi.rememberedIdentifier';

// muiFormTheme.js sets a shared minHeight:56 + white background on
// every outlined field app-wide (SecurityPage, RestoreBackupDialog,
// Forgot/Reset password all use it too) — deliberately not touched
// here since that'd change fields on pages nobody asked to change.
// This overrides height/background locally for just this page's
// fields, and tightens the built-in MUI adornment gap right down so
// the icon+divider sits close to the input text, matching the
// reference code's compact spacing instead of MUI's default roomy gap.
const compactFieldSx = {
  '& .MuiOutlinedInput-root': { minHeight: 44, backgroundColor: 'transparent' },
  '& .MuiOutlinedInput-input': { padding: '10px 8px 10px 4px' },
  '& .MuiInputAdornment-root': { marginRight: 0 },
};

// FieldError 
const FieldError = ({ message }) => { if (!message) return null; return ( <span className=" absolute z-10 right-3 -top-[9px] bg-red-500 text-white px-1 text-xs rounded whitespace-nowrap " > {message} </span> ); };

// Icon + thin vertical divider bar, reused as every field's start
// adornment — the divider itself is the reference code's visual
// separator between the icon and the input text.
const IconDivider = ({ icon: Icon }) => (
  <InputAdornment position="start">
    <Icon size={18} aria-hidden="true" />
    <span className="ml-1.5 mr-1.5 h-5 w-px bg-black/40" aria-hidden="true" />
  </InputAdornment>
);

// Same host loginbg.webp was uploaded to when this page was designed.
// Referenced directly (not copied into src/assets) since it's already
// on a CDN — swap to a local `import loginBg from '../assets/...'` if
// you'd rather bundle it with the app instead of hotlinking it.
const LOGIN_BG_URL =
  'https://res.cloudinary.com/fhsrf5ps/image/upload/v1789805492/loginbg.webp';

export default function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loginSchema = useMemo(() => buildLoginSchema(t), [t, i18n.language]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: localStorage.getItem(REMEMBER_KEY) || '',
      password: '',
      rememberMe: Boolean(localStorage.getItem(REMEMBER_KEY)),
    },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      if (values.rememberMe) {
        localStorage.setItem(REMEMBER_KEY, values.identifier);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
      await login({ identifier: values.identifier, password: values.password });
      const redirectTo = location.state?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setServerError(extractApiError(error).message);
    }
  };

  const pillButtonClass =
    'flex items-center justify-center gap-2 text-sm px-3 py-1.5 rounded-md transition-all tracking-wide ' +
    'bg-transparent hover:bg-[#a6a6a6] border border-black cursor-pointer text-black';

  return (
    <ThemeProvider theme={muiFormTheme}>
      <CssBaseline />
      <div className="force-light min-h-screen flex items-center justify-center bg-cover bg-center p-6" style={{ backgroundImage: `url(${LOGIN_BG_URL})`, backgroundColor: '#e6e6e6' }} >
        <div className="w-full max-w-sm translate-y-9">
          <div className="bg-[#bfbfbf] rounded-2xl overflow-hidden border border-black shadow-[8px_8px_16px_#a1a1a1,-8px_-8px_16px_#dcdcdc]">
            
            {/* Form area */}
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-4 py-5">
              <FormError message={serverError} />

              <div className="flex flex-col gap-5 mb-2">
                <Controller name="identifier" control={control} render={({ field }) => ( <div className="relative"> <TextField {...field} label={t('auth.login.identifierLabel')} placeholder={t('auth.login.identifierPlaceholder')} autoComplete="username" autoFocus sx={compactFieldSx} error={Boolean(errors.identifier)} helperText={null} InputProps={{ startAdornment: <IconDivider icon={Mail} />, }} /> <FieldError message={errors.identifier?.message} /> </div> )} />

                <Controller name="password" control={control} render={({ field }) => ( <div className="relative"> <TextField {...field} label={t('auth.password.label')} type={showPassword ? 'text' : 'password'} autoComplete="current-password" sx={compactFieldSx} error={Boolean(errors.password)} helperText={null} InputProps={{ startAdornment: <IconDivider icon={Key} />, endAdornment: ( <InputAdornment position="end"> <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small" aria-label={ showPassword ? t('auth.password.hide') : t('auth.password.show') } > {showPassword ? ( <EyeOff size={18} aria-hidden="true" /> ) : ( <Eye size={18} aria-hidden="true" /> )} </IconButton> </InputAdornment> ), }} /> <FieldError message={errors.password?.message} /> </div> )} />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap mt-5 mb-5"> 
                <Controller name="rememberMe" control={control} render={({ field }) => ( <button type="button" role="checkbox" aria-checked={Boolean(field.value)} onClick={() => field.onChange(!field.value)} className={pillButtonClass} > {field.value ? ( <CircleCheckBig size={18} className="text-black" aria-hidden="true" /> ) : ( <CircleUserRound size={18} className="text-black" aria-hidden="true" /> )} {t('auth.login.rememberMe')} </button> )} /> 
                
                <Link to="/forgot-password" className={pillButtonClass}> {t('auth.login.forgotPassword')} <Key size={15} aria-hidden="true" /> </Link> </div>

              <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 text-black font-medium px-2 py-1.5 rounded-md transition-all tracking-wide bg-transparent hover:bg-[#a6a6a6] border border-black cursor-pointer shadow-[8px_8px_16px_#a1a1a1,-8px_-8px_16px_#dcdcdc] active:shadow-[inset_6px_6px_12px_#a1a1a1,inset_-6px_-6px_12px_#dcdcdc] disabled:opacity-60 disabled:pointer-events-none" > {isSubmitting ? t('auth.login.submitting') : t('auth.login.submit')} <LogIn size={17} aria-hidden="true" /> </button>
            </form>

            {/* Bottom registration area */} 
            <div className="px-4 pb-4"> 
              
              {/* Don't have an account text */} 
              <div className="flex items-center gap-3 my-2"> <div className="flex-1 h-[2px] bg-black/20" /> <span className="text-black text-sm whitespace-nowrap"> {t('auth.login.noAccount')} {t('auth.login.createOne')} </span> <div className="flex-1 h-[2px] bg-black/20" /> </div> 
              {/* Register button */} 
              <Link to="/register" className="w-full flex items-center justify-center gap-2 bg-[#bfbfbf] text-black text-sm py-1.5 px-2 rounded-full border border-black/10 shadow-[8px_8px_16px_#a1a1a1,-8px_-8px_16px_#dcdcdc] hover:bg-[#a6a6a6] transition-all duration-200" > <span className="font-medium"> Register </span> <NotebookPen size={17} aria-hidden="true" /> </Link> 
              </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
