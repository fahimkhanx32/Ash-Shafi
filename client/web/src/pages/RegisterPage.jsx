import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeProvider, CssBaseline } from '@mui/material';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import { User, AtSign, Phone, Mail, Key, Eye, EyeOff, UserPlus, LogIn, } from 'lucide-react';

import * as authService from '../services/authService.js';
import { extractApiError } from '../services/apiClient.js';
import { buildRegisterSchema } from '../schemas/authSchemas.js';
import { muiFormTheme } from '../themes/muiFormTheme.js';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import FormError from '../components/auth/FormError.jsx';

const LOGIN_BG_URL =
  'https://res.cloudinary.com/fhsrf5ps/image/upload/v1789912197/signupbg1.webp';

const compactFieldSx = {
  '& .MuiOutlinedInput-root': { minHeight: 44, backgroundColor: 'transparent' },
  '& .MuiOutlinedInput-input': { padding: '10px 8px 10px 4px' },
  '& .MuiInputAdornment-root': { marginRight: 0 },
};


const FieldError = ({ message }) => 
{ 
  if (!message) return null; return ( 
  <span className=" absolute z-10 right-3 -top-[9px] bg-red-500 text-white px-1 text-xs rounded whitespace-nowrap " > {message} </span> ); 
};


const IconDivider = ({ icon: Icon }) => (
  <InputAdornment position="start">
    <Icon size={18} aria-hidden="true" />
    <span className="ml-1.5 mr-1.5 h-5 w-px bg-black/40" aria-hidden="true" />
  </InputAdornment>
);

export default function RegisterPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const registerSchema = useMemo(() => buildRegisterSchema(t), [t, i18n.language]);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', username: '', phone: '', email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const result = await authService.registerPatient({
        name: values.name,
        username: values.username,
        phone: values.phone,
        email: values.email || undefined,
        password: values.password,
      });
      setSuccessMessage(result.message || t('auth.register.defaultSuccess'));
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (error) {
      const apiError = extractApiError(error);
      // Show "username taken" (and phone/email in use) on the field itself.
      const fieldByCode = {
        USERNAME_ALREADY_EXISTS: 'username',
        PHONE_ALREADY_EXISTS: 'phone',
        EMAIL_ALREADY_EXISTS: 'email',
      };
      const field = fieldByCode[apiError.code];
      if (field) {
        setError(field, { type: 'server', message: apiError.message });
        setServerError('');
      } else {
        setServerError(apiError.message);
      }
    }
  };

  return (
    <ThemeProvider theme={muiFormTheme}>
      <CssBaseline />
      <div className="force-light min-h-screen flex items-center justify-center bg-cover bg-center p-6" style={{ backgroundImage: `url(${LOGIN_BG_URL})`, backgroundColor: '#e6e6e6' }} >
        {/* max-w-md (wider than LoginPage's max-w-sm) — kept from when
            this had a username/phone row; still comfortable now that
            it's back to single-column fields, no need to narrow it. */}
        <div className="w-full max-w-md translate-y-4"> 
          <div className="bg-[#bfbfbf] rounded-2xl overflow-hidden border border-black shadow-[8px_8px_16px_#a1a1a1,-8px_-8px_16px_#dcdcdc]">
            

            {successMessage ? (
              <div className="px-4 pb-5 pt-2">
                <Alert variant="success">
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-4 py-5">
                <FormError message={serverError} />

                <div className="flex flex-col gap-5 mb-6">
                  <Controller name="name" control={control} render={({ field }) => ( <div className="relative"> <TextField {...field} label={t('auth.register.nameLabel')} autoComplete="name" autoFocus sx={compactFieldSx} error={Boolean(errors.name)} helperText={null} InputProps={{ startAdornment: <IconDivider icon={User} />, }} /> <FieldError message={errors.name?.message} /> </div> )} />
                  <Controller name="username" control={control} render={({ field }) => ( <div className="relative"> <TextField {...field} label={t('auth.register.usernameLabel')} autoComplete="username" sx={compactFieldSx} error={Boolean(errors.username)} helperText={null} InputProps={{ startAdornment: <IconDivider icon={AtSign} />, }} /> <FieldError message={errors.username?.message} /> </div> )} />

                  <Controller name="phone" control={control} render={({ field }) => ( <div className="relative"> <TextField {...field} label={t('auth.register.phoneLabel')} autoComplete="tel" sx={compactFieldSx} error={Boolean(errors.phone)} helperText={null} InputProps={{ startAdornment: <IconDivider icon={Phone} />, }} /> <FieldError message={errors.phone?.message} /> </div> )} />

                  <Controller name="email" control={control} render={({ field }) => ( <div className="relative"> <TextField {...field} label={t('auth.register.emailLabel')} type="email" autoComplete="email" sx={compactFieldSx} error={Boolean(errors.email)} helperText={null} InputProps={{ startAdornment: <IconDivider icon={Mail} />, }} /> <FieldError message={errors.email?.message} /> </div> )} />

                  <Controller name="password" control={control} render={({ field }) => ( <div className="relative"> <TextField {...field} label={t('auth.password.label')} type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder={t('auth.register.passwordHelper')} sx={compactFieldSx} error={Boolean(errors.password)} helperText={null} InputProps={{ startAdornment: <IconDivider icon={Key} />, endAdornment: ( <InputAdornment position="end"> <IconButton onClick={() => setShowPassword((v) => !v)} edge="end" size="small" aria-label={ showPassword ? t('auth.password.hide') : t('auth.password.show') } > {showPassword ? ( <EyeOff size={18} aria-hidden="true" /> ) : ( <Eye size={18} aria-hidden="true" /> )} </IconButton> </InputAdornment> ), }} /> <FieldError message={errors.password?.message} /> </div> )} />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full flex items-center justify-center gap-2 text-black font-medium px-2 py-1.5 rounded-md transition-all tracking-wide bg-transparent hover:bg-[#a6a6a6] border border-black cursor-pointer shadow-[8px_8px_16px_#a1a1a1,-8px_-8px_16px_#dcdcdc] active:shadow-[inset_6px_6px_12px_#a1a1a1,inset_-6px_-6px_12px_#dcdcdc] disabled:opacity-60 disabled:pointer-events-none" > {isSubmitting ? t('auth.register.submitting') : t('auth.register.submit')} <UserPlus size={17} aria-hidden="true" /> </button>
              </form>
            )}

            {/* Bottom login button */} 
            <div className="px-4 pb-4"> <Link to="/login" className="group w-full flex items-center justify-center gap-2 bg-[#bfbfbf] text-black text-sm py-2 px-3 rounded-full border border-black/10 shadow-[8px_8px_16px_#a1a1a1,-8px_-8px_16px_#dcdcdc] hover:bg-[#a6a6a6] transition-all duration-200" > <span className="font-medium"> {t('auth.register.haveAccount')} {t('auth.register.signIn')} </span> 
            {/* Login icon */}
             <LogIn size={17} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" /> 
             </Link> </div>


          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
