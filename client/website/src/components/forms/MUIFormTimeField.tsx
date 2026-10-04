'use client';

import React from 'react';
import { TextField, InputAdornment, OutlinedTextFieldProps } from '@mui/material';
import { AccessTime as AccessTimeIcon } from '@mui/icons-material';

export interface MUIFormTimeFieldProps extends Omit<OutlinedTextFieldProps, 'variant' | 'type'> {
  label: string;
  icon?: React.ReactNode;
}

export const MUIFormTimeField: React.FC<MUIFormTimeFieldProps> = ({
  label,
  icon = <AccessTimeIcon sx={{ color: '#20aaa0' }} />,
  slotProps,
  ...props
}) => {
  return (
    <TextField
      fullWidth
      type="time"
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

export default MUIFormTimeField;
