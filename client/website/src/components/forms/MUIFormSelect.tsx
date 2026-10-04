'use client';

import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  FormHelperText,
  SelectProps,
} from '@mui/material';

export interface SelectOption {
  value: string;
  label: string;
}

export interface MUIFormSelectProps extends Omit<SelectProps, 'variant'> {
  icon?: React.ReactNode;
  label: string;
  options: SelectOption[];
  helperText?: string;
}

export const MUIFormSelect: React.FC<MUIFormSelectProps> = ({
  icon,
  label,
  options,
  error,
  helperText,
  value,
  onChange,
  id,
  ...props
}) => {
  const labelId = `${id || 'mui-select'}-label`;

  return (
    <FormControl fullWidth error={error} variant="outlined">
      <InputLabel id={labelId} shrink>
        {label}
      </InputLabel>
      <Select
        labelId={labelId}
        label={label}
        value={value}
        onChange={onChange}
        startAdornment={
          icon ? (
            <InputAdornment position="start" sx={{ mr: 1 }}>
              {icon}
            </InputAdornment>
          ) : undefined
        }
        notched
        {...props}
      >
        {options.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};

export default MUIFormSelect;
