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

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((opt) => opt.toLowerCase().includes(query));
  }, [options, searchQuery]);

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
      // Remove all filtered options from selectedValues
      const remaining = selectedValues.filter((val) => !filteredOptions.includes(val));
      onChange(remaining);
    } else {
      // Add all filtered options to selectedValues
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
    if (options.length > 0 && selectedValues.length === options.length) return 'All Selected';
    if (selectedValues.length === 1) return selectedValues[0];
    return `${selectedValues.length} Selected`;
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && <label className="form-label mb-1 block text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{label}</label>}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-9 px-3 text-left rounded-xl border border-solid transition-all flex items-center justify-between text-[12px] font-semibold cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed bg-[var(--surface-2)]' : 'bg-[var(--surface)] hover:border-[var(--accent)]'
        }`}
        style={{
          borderColor: isOpen ? 'var(--accent)' : 'var(--border)',
          color: selectedValues.length > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
          boxShadow: isOpen ? '0 0 0 2px var(--accent-light)' : 'none',
        }}
      >
        <span className="truncate pr-2 font-medium">{getDisplayText()}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedValues.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="p-0.5 rounded-full hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--danger)] cursor-pointer"
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 text-[var(--text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 right-0 mt-1 z-[9999] rounded-xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden animate-slide-up"
          style={{ minWidth: '220px', backgroundColor: 'var(--surface)' }}
        >
          {/* Search Box */}
          <div className="p-2 border-b border-[var(--border-soft)] bg-[var(--surface-2)]">
            <div className="relative flex items-center">
              <Search className="h-3.5 w-3.5 absolute left-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-[11.5px] pl-8 pr-2.5 py-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Select All Checkbox */}
          {filteredOptions.length > 0 && (
            <div
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2.5 px-3 py-2 border-b border-[var(--border-soft)] hover:bg-[var(--surface-2)] cursor-pointer select-none transition-colors"
            >
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isSomeSelected;
                }}
                onChange={() => {}} // Handled by parent div onClick
                className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
              />
              <span className="text-[11.5px] font-extrabold text-[var(--text-primary)]">Select all</span>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-[11px] text-center italic text-[var(--text-muted)]">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedValues.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => handleToggleOption(opt)}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-[var(--surface-2)] cursor-pointer select-none transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // Handled by parent div onClick
                      className="h-3.5 w-3.5 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                    />
                    <span className={`text-[12px] ${isChecked ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`}>
                      {opt}
                    </span>
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
