'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface MultiSelectDropdownProps {
  label?: string;
  placeholder?: string;
  options: string[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function MultiSelectDropdown({
  label,
  placeholder = 'Select options...',
  options = [],
  selectedValues = [],
  onChange,
  disabled = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter out any empty option strings
  const cleanOptions = useMemo(() => options.filter(Boolean), [options]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return cleanOptions;
    const query = searchQuery.toLowerCase().trim();
    return cleanOptions.filter((opt) => opt.toLowerCase().includes(query));
  }, [cleanOptions, searchQuery]);

  // Determine "Select all" state for filtered options
  const isAllSelected = useMemo(() => {
    if (filteredOptions.length === 0) return false;
    return filteredOptions.every((opt) => selectedValues.includes(opt));
  }, [filteredOptions, selectedValues]);

  const isSomeSelected = useMemo(() => {
    if (isAllSelected) return false;
    return filteredOptions.some((opt) => selectedValues.includes(opt));
  }, [filteredOptions, selectedValues, isAllSelected]);

  // Toggle "Select all"
  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const remaining = selectedValues.filter((val) => !filteredOptions.includes(val));
      onChange(remaining);
    } else {
      const newSelected = Array.from(new Set([...selectedValues, ...filteredOptions]));
      onChange(newSelected);
    }
  };

  // Toggle single option
  const handleToggleOption = (opt: string) => {
    if (selectedValues.includes(opt)) {
      onChange(selectedValues.filter((val) => val !== opt));
    } else {
      onChange([...selectedValues, opt]);
    }
  };

  // Trigger button label display
  const getDisplayText = () => {
    if (selectedValues.length === 0) return placeholder;
    if (cleanOptions.length > 0 && selectedValues.length === cleanOptions.length) return 'All Selected';
    if (selectedValues.length === 1) return selectedValues[0];
    if (selectedValues.length === 2) return `${selectedValues[0]}, ${selectedValues[1]}`;
    return `${selectedValues.length} Selected`;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="form-label mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full min-h-[38px] h-[38px] px-3 text-left rounded-xl border transition-all flex items-center justify-between text-[12px] font-semibold cursor-pointer shadow-xs ${
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800'
            : isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
            : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-200'
        }`}
      >
        <div className="flex items-center gap-1.5 truncate pr-1">
          <span className="truncate">{getDisplayText()}</span>
          {selectedValues.length > 1 && cleanOptions.length > 0 && selectedValues.length !== cleanOptions.length && (
            <span className="px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-[10px] font-black">
              {selectedValues.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {selectedValues.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 mt-1.5 z-[9999] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 overflow-hidden animate-slide-up"
          style={{ minWidth: '100%', width: 'max-content', maxWidth: '320px' }}
        >
          {/* Search Box */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/50">
            <div className="relative flex items-center">
              <Search className="h-3.5 w-3.5 absolute left-3 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[12px] font-medium pl-8.5 pr-7 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Select All Row */}
          {filteredOptions.length > 0 && (
            <div
              onClick={handleToggleSelectAll}
              className="group flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-4 h-4 rounded-[5px] flex items-center justify-center transition-all flex-shrink-0 ${
                    isAllSelected || isSomeSelected
                      ? 'bg-gradient-to-br from-indigo-600 to-blue-600 border border-indigo-600 text-white shadow-xs'
                      : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-indigo-400'
                  }`}
                >
                  {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  {!isAllSelected && isSomeSelected && <div className="w-2 h-0.5 bg-white rounded-full" />}
                </div>
                <span className="text-[12px] font-extrabold text-slate-900 dark:text-white">Select all</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {filteredOptions.length}
              </span>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-52 overflow-y-auto py-1.5">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-[11px] text-center italic text-slate-400 dark:text-slate-500">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedValues.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => handleToggleOption(opt)}
                    className={`group flex items-center gap-2.5 px-3 py-2 mx-1.5 my-0.5 rounded-lg cursor-pointer select-none transition-all ${
                      isChecked
                        ? 'bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-semibold'
                        : 'hover:bg-slate-100/90 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-medium'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-[5px] flex items-center justify-center transition-all flex-shrink-0 ${
                        isChecked
                          ? 'bg-gradient-to-br from-indigo-600 to-blue-600 border border-indigo-600 text-white shadow-xs'
                          : 'border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 group-hover:border-indigo-400'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[12px] leading-tight truncate">{opt}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiSelectDropdown;
