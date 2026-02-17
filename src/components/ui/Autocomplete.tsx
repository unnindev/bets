'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

// Normaliza texto: remove acentos, cedilha e converte para minúsculas
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove diacríticos (acentos, til, cedilha, etc.)
};

interface AutocompleteProps {
  label?: string;
  placeholder?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onCreateNew?: (name: string) => void;
  allowCreate?: boolean;
  required?: boolean;
}

export function Autocomplete({
  label,
  placeholder = 'Buscar...',
  options,
  value,
  onChange,
  onCreateNew,
  allowCreate = false,
  required,
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearch(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch(value);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const filteredOptions = options.filter((opt) =>
    normalizeText(opt.name).includes(normalizeText(search))
  );

  const showCreateOption =
    allowCreate &&
    search.length > 0 &&
    !options.some((opt) => normalizeText(opt.name) === normalizeText(search));

  const handleSelect = (optionName: string) => {
    onChange(optionName);
    setSearch(optionName);
    setIsOpen(false);
  };

  const handleCreate = () => {
    if (onCreateNew && search.trim()) {
      onCreateNew(search.trim());
      handleSelect(search.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 + (showCreateOption ? 1 : 0) ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1 + (showCreateOption ? 1 : 0)
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex < filteredOptions.length) {
          handleSelect(filteredOptions[highlightedIndex].name);
        } else if (showCreateOption) {
          handleCreate();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearch(value);
        break;
    }
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
    inputRef.current?.focus();
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 pr-16 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-500 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>

        {isOpen && (filteredOptions.length > 0 || showCreateOption) && (
          <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-auto">
            {filteredOptions.map((option, index) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option.name)}
                className={`w-full px-4 py-2 text-left text-white hover:bg-gray-700 transition ${
                  index === highlightedIndex ? 'bg-gray-700' : ''
                }`}
              >
                {option.name}
              </button>
            ))}
            {showCreateOption && (
              <button
                type="button"
                onClick={handleCreate}
                className={`w-full px-4 py-2 text-left text-emerald-400 hover:bg-gray-700 transition border-t border-gray-700 ${
                  highlightedIndex === filteredOptions.length ? 'bg-gray-700' : ''
                }`}
              >
                + Criar "{search}"
              </button>
            )}
          </div>
        )}

        {isOpen && filteredOptions.length === 0 && !showCreateOption && search && (
          <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4 text-gray-400 text-sm">
            Nenhum resultado encontrado
          </div>
        )}
      </div>
    </div>
  );
}
