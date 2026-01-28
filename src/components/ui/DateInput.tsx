'use client';

import { forwardRef, useState, useEffect } from 'react';

interface DateInputProps {
  label?: string;
  error?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  name?: string;
  required?: boolean;
}

// Converte YYYY-MM-DD para DD/MM/YYYY
const isoToBr = (isoDate: string): string => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

// Converte DD/MM/YYYY para YYYY-MM-DD
const brToIso = (brDate: string): string => {
  if (!brDate || brDate.length < 10) return '';
  const [day, month, year] = brDate.split('/');
  return `${year}-${month}-${day}`;
};

// Formata input enquanto digita
const formatDateInput = (value: string): string => {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  }
};

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(
  ({ label, error, value = '', onChange, name = '', required }, ref) => {
    const [displayValue, setDisplayValue] = useState(isoToBr(value));

    useEffect(() => {
      setDisplayValue(isoToBr(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatDateInput(e.target.value);
      setDisplayValue(formatted);

      // Se a data está completa, converte para ISO e notifica
      if (formatted.length === 10) {
        const isoValue = brToIso(formatted);
        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: {
              ...e.target,
              name,
              value: isoValue,
            },
          } as React.ChangeEvent<HTMLInputElement>;
          onChange(syntheticEvent);
        }
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          placeholder="DD/MM/AAAA"
          value={displayValue}
          onChange={handleChange}
          maxLength={10}
          required={required}
          className={`
            w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5
            text-white placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
            transition
            ${error ? 'border-red-500' : ''}
          `}
        />
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
    );
  }
);

DateInput.displayName = 'DateInput';
