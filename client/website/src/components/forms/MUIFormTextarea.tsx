'use client';

import React from 'react';
import { TextField, InputAdornment, OutlinedTextFieldProps } from '@mui/material';

export interface MUIFormTextareaProps extends Omit<OutlinedTextFieldProps, 'variant' | 'multiline'> {
  icon?: React.ReactNode;
  label: string;
  minRows?: number;
  maxRows?: number;
}

export const MUIFormTextarea: React.FC<MUIFormTextareaProps> = ({
  icon,
  label,
  minRows = 4,
  maxRows = 8,
  slotProps,
  ...props
}) => {
  return (
    <TextField
      fullWidth
      multiline
      minRows={minRows}
      maxRows={maxRows}
      variant="outlined"
      label={label}
      slotProps={{
        input: {
          startAdornment: icon ? (
            <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
              {icon}
            </InputAdornment>
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

export default MUIFormTextarea;
