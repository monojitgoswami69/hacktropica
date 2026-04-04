import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../utils/helpers';

export function FilterDropdown({ value, onChange, options, disabled, placeholder = "Select..." }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  return (
    <div className={cn("relative w-full", disabled ? "opacity-60 cursor-not-allowed" : "")} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center px-3 py-2 text-[14px] bg-white border border-neutral-200 rounded-lg text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown size={16} className={cn("text-neutral-500 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.map((option, idx) => (
            <button
              key={idx}
              type="button"
              className={cn(
                "w-full text-left px-3 py-2 text-[14px] hover:bg-neutral-50 transition-colors",
                value === option.value ? "bg-primary-50 text-primary-600 font-medium" : "text-neutral-700"
              )}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
