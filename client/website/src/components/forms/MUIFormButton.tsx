'use client';

import React from 'react';
import { Button, CircularProgress, ButtonProps } from '@mui/material';

export interface MUIFormButtonProps extends ButtonProps {
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const MUIFormButton: React.FC<MUIFormButtonProps> = ({
  children,
  loading = false,
  disabled,
  startIcon,
  endIcon,
  sx,
  ...props
}) => {
  return (
    <Button
      variant="contained"
      color="primary"
      disabled={disabled || loading}
      startIcon={!loading ? startIcon : undefined}
      endIcon={!loading ? endIcon : undefined}
      sx={{
        py: 1.6,
        px: 3.5,
        fontSize: '0.95rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #159b89 0%, #20aaa0 100%)',
        boxShadow: '0 6px 20px rgba(21, 155, 137, 0.25)',
        transition: 'all 0.3s ease',
        '&:hover': {
          background: 'linear-gradient(135deg, #128b7b 0%, #179c93 100%)',
          boxShadow: '0 8px 25px rgba(21, 155, 137, 0.35)',
          transform: 'translateY(-1px)',
        },
        '&.Mui-disabled': {
          background: 'rgba(21, 155, 137, 0.3)',
          color: 'rgba(244, 241, 233, 0.5)',
        },
        ...sx,
      }}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <CircularProgress size={18} sx={{ color: '#f4f1e9' }} />
          <span>Processing...</span>
        </span>
      ) : (
        children
      )}
    </Button>
  );
};

export default MUIFormButton;
