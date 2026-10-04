'use client';

import React from 'react';
import { TextField, InputAdornment, OutlinedTextFieldProps } from '@mui/material';

export interface MUIFormFieldProps extends Omit<OutlinedTextFieldProps, 'variant'> {
  icon?: React.ReactNode;
  label: string;
}

export const MUIFormField: React.FC<MUIFormFieldProps> = ({
  icon,
  label,
  slotProps,
  ...props
}) => {
  return (
    <TextField
      fullWidth
      variant="outlined"
      label={label}
      slotProps={{
        input: {
          startAdornment: icon ? (
            <InputAdornment position="start">{icon}</InputAdornment>
          ) : undefined,
          ...(slotProps?.input || {}),
        },
        inputLabel: {
          shrink: true,
          ...(slotProps?.inputLabel || {}),
        } as any,
      }}
      {...props}
    />
  );
};

export default MUIFormField;
