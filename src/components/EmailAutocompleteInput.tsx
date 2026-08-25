import React, { useState, useRef, useEffect } from 'react';
import { Mail, Check, UserCheck, Building } from 'lucide-react';
import { COMPANY_DIRECTORY, type CompanyEmployee } from '../data/companyDirectory';

interface EmailAutocompleteInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string, employee?: CompanyEmployee) => void;
  onSelectEmployee?: (employee: CompanyEmployee) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  label?: string;
  hint?: string;
  autoFocus?: boolean;
}

export default function EmailAutocompleteInput({
  id = 'email-autocomplete-input',
  name = 'email',
  value,
  onChange,
  onSelectEmployee,
  placeholder = 'usuario@dimer.com.mx',
  required = false,
  disabled = false,
  className = '',
  label,
  hint,
  autoFocus = false,
}: EmailAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter suggestions based on typed value
  const query = (value || '').trim().toLowerCase();
  const suggestions: CompanyEmployee[] = query.length >= 1
    ? COMPANY_DIRECTORY.filter(emp => {
        const full = `${emp.name} ${emp.email} ${emp.department}`.toLowerCase();
        return full.includes(query);
      }).slice(0, 8)
    : [];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (emp: CompanyEmployee) => {
    onChange(emp.email, emp);
    if (onSelectEmployee) {
      onSelectEmployee(emp);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <Mail className="w-4 h-4" />
        </div>

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete="off"
          className={`w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition font-sans ${className}`}
        />

        {value && !disabled && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            &times;
          </button>
        )}
      </div>

      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}

      {/* Predictive Dropdown Suggestions */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto py-1 animate-in fade-in-50 duration-100 divide-y divide-slate-100">
          <div className="px-3 py-1 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Directorio de Personal Dimer ({suggestions.length})</span>
            <span className="text-[9px] text-indigo-600 font-mono">Usa ↑ ↓ y Enter</span>
          </div>

          {suggestions.map((emp, idx) => {
            const isHighlighted = idx === highlightedIndex;
            const isExact = emp.email.toLowerCase() === (value || '').trim().toLowerCase();

            return (
              <div
                key={emp.email}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelect(emp)}
                className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                  isHighlighted ? 'bg-indigo-50 text-indigo-950' : 'hover:bg-slate-50 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {emp.firstName.charAt(0)}
                    {emp.lastName.charAt(0)}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {emp.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {emp.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1">
                    <Building className="w-2.5 h-2.5 text-slate-400" />
                    {emp.department}
                  </span>
                  {isExact && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
