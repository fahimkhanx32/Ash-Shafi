'use client';

import { createTheme } from '@mui/material/styles';

export const darkMedicalTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#20aaa0',
      light: '#42c9bf',
      dark: '#159c92',
      contrastText: '#030b0e',
    },
    secondary: {
      main: '#e5ad7c',
      light: '#f3bf67',
      dark: '#d39a70',
      contrastText: '#030b0e',
    },
    background: {
      default: '#030b0e',
      paper: '#08161c',
    },
    text: {
      primary: '#f4f1e9',
      secondary: '#aab9bd',
      disabled: '#617276',
    },
    error: {
      main: '#ef4444',
      light: '#f87171',
    },
    success: {
      main: '#10b981',
      light: '#34d399',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  typography: {
    fontFamily: 'var(--font-secondary, "Inter"), "Roboto", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(6, 20, 25, 0.65)',
          borderRadius: '12px',
          color: '#f4f1e9',
          transition: 'all 0.25s ease-in-out',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(32, 170, 160, 0.25)',
            transition: 'all 0.25s ease-in-out',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(32, 170, 160, 0.65)',
          },
          '&.Mui-focused': {
            backgroundColor: 'rgba(8, 27, 32, 0.85)',
            boxShadow: '0 0 20px rgba(32, 170, 160, 0.18)',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: '#20aaa0',
              borderWidth: '1.5px',
            },
          },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': {
            borderColor: '#ef4444',
          },
          '& input': {
            padding: '14px 16px',
            fontSize: '0.95rem',
            color: '#f4f1e9',
            '&::placeholder': {
              color: 'rgba(170, 185, 189, 0.5)',
              opacity: 1,
            },
          },
          '& textarea': {
            color: '#f4f1e9',
            fontSize: '0.95rem',
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: '#9eafb3',
          fontSize: '0.92rem',
          '&.Mui-focused': {
            color: '#20aaa0',
          },
          '&.Mui-error': {
            color: '#ef4444',
          },
        },
        outlined: {
          transform: 'translate(14px, 14px) scale(1)',
          '&.MuiInputLabel-shrink': {
            transform: 'translate(14px, -8px) scale(0.75)',
            backgroundColor: '#08161c',
            padding: '0 6px',
            borderRadius: '4px',
          },
        },
      },
    },
    MuiInputAdornment: {
      styleOverrides: {
        root: {
          color: '#20aaa0',
          marginRight: '8px',
          '& .MuiSvgIcon-root': {
            fontSize: '1.25rem',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        icon: {
          color: '#20aaa0',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: '#081b20',
          backgroundImage: 'none',
          border: '1px solid rgba(32, 170, 160, 0.2)',
          color: '#f4f1e9',
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          fontSize: '0.92rem',
          padding: '10px 16px',
          '&:hover': {
            backgroundColor: 'rgba(32, 170, 160, 0.12)',
            color: '#35c0b7',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(32, 170, 160, 0.2)',
            color: '#20aaa0',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: 'rgba(32, 170, 160, 0.25)',
            },
          },
        },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: {
          marginLeft: '4px',
          marginTop: '5px',
          fontSize: '0.8rem',
          '&.Mui-error': {
            color: '#f87171',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '10px',
          padding: '12px 24px',
          fontWeight: 600,
          fontSize: '0.92rem',
          boxShadow: 'none',
        },
        contained: {
          backgroundColor: '#159b89',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#20aaa0',
            boxShadow: '0 6px 20px rgba(32, 170, 160, 0.3)',
          },
        },
        outlined: {
          borderColor: 'rgba(32, 170, 160, 0.6)',
          color: '#20aaa0',
          '&:hover': {
            borderColor: '#20aaa0',
            backgroundColor: 'rgba(32, 170, 160, 0.08)',
          },
        },
      },
    },
  },
});
