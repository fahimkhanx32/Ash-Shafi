'use client';

import React from 'react';
import { TextField, InputAdornment, OutlinedTextFieldProps } from '@mui/material';
import { CalendarMonth as CalendarMonthIcon } from '@mui/icons-material';

export interface MUIFormDateFieldProps extends Omit<OutlinedTextFieldProps, 'variant' | 'type'> {
  label: string;
  icon?: React.ReactNode;
}

export const MUIFormDateField: React.FC<MUIFormDateFieldProps> = ({
  label,
  icon = <CalendarMonthIcon sx={{ color: '#20aaa0' }} />,
  slotProps,
  ...props
}) => {
  return (
    <TextField
      fullWidth
      type="date"
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

export default MUIFormDateField;
