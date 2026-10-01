'use client';

import React, { useState, useRef, useEffect, useId } from 'react';
import { Icon } from './Icon';

export interface SelectOption {
  value: string | number;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectProps {
  id?: string;
  name?: string;
  value: string | number;
  onChange: (value: any) => void;
  options: SelectOption[] | string[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  error?: boolean;
  required?: boolean;
}

export default function Select({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  label,
  disabled = false,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  size = 'md',
  error = false,
  required = false,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Normalize options array
  const normalizedOptions: SelectOption[] = options.map((opt) => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: opt, label: String(opt) };
    }
    return opt;
  });

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = normalizedOptions.findIndex((opt) => String(opt.value) === String(value));
        const nextIndex = (currentIndex + 1) % normalizedOptions.length;
        if (!normalizedOptions[nextIndex].disabled) {
          onChange(normalizedOptions[nextIndex].value);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = normalizedOptions.findIndex((opt) => String(opt.value) === String(value));
        const prevIndex = (currentIndex - 1 + normalizedOptions.length) % normalizedOptions.length;
        if (!normalizedOptions[prevIndex].disabled) {
          onChange(normalizedOptions[prevIndex].value);
        }
      }
    }
  };

  const sizeClasses = {
    sm: 'py-1.5 px-3 text-[12px] rounded-lg',
    md: 'py-2.5 px-3.5 text-sm rounded-xl',
    lg: 'py-3 px-4 text-base rounded-xl',
  };

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {label && (
        <label htmlFor={selectId} className="field-label">
          {label} {required && <span className="text-stop">*</span>}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full flex items-center justify-between text-left transition-all duration-150 cursor-pointer ${
          sizeClasses[size]
        } bg-panel border ${
          error
            ? 'border-stop focus:border-stop ring-1 ring-stop/30'
            : isOpen
            ? 'border-brass ring-2 ring-brass/20 shadow-sm'
            : 'border-line hover:border-brass/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-raised' : ''} ${buttonClassName}`}
      >
        <span className={`truncate block font-medium ${selectedOption ? 'text-text' : 'text-faint'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`ml-2 text-muted transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-brass' : ''}`}>
          <Icon name="chevronDown" size={16} />
        </span>
      </button>

      {/* Hidden native input for form compatibility */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
        />
      )}

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className={`absolute left-0 right-0 z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-line bg-panel p-1.5 shadow-xl shadow-black/10 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${dropdownClassName}`}
        >
          {normalizedOptions.length === 0 ? (
            <div className="py-3 px-4 text-center text-xs text-muted">No options available</div>
          ) : (
            normalizedOptions.map((option) => {
              const isSelected = String(option.value) === String(value);
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => {
                    if (!option.disabled) {
                      onChange(option.value);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left rounded-lg transition-colors text-[13px] font-medium cursor-pointer ${
                    isSelected
                      ? 'bg-brass/15 text-brass font-bold'
                      : 'text-text hover:bg-raised'
                  } ${option.disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="text-[11px] text-muted font-normal truncate mt-0.5">
                        {option.description}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <span className="text-brass shrink-0">
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
