import { useState, useRef, useEffect, ReactNode } from 'react';
import { LineStyle } from '../../types';
import { COLOR_PALETTE } from './palette';
import { Icons } from './Icons';

export interface CollapsibleSectionProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}

export function CollapsibleSection({ title, icon, children, defaultOpen = false, badge }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-700/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
      >
        <span className="text-gray-400">{icon}</span>
        <span className="flex-1 text-sm font-medium text-gray-200">{title}</span>
        {badge !== undefined && (
          <span className="px-1.5 py-0.5 text-xs bg-accent-cyan/20 text-accent-cyan rounded">
            {badge}
          </span>
        )}
        <span className={`text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          {Icons.chevronDown}
        </span>
      </button>
      {isOpen && (
        <div className="p-3 space-y-3 bg-gray-900/30">
          {children}
        </div>
      )}
    </div>
  );
}

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  suffix?: string;
}

export function Slider({ label, value, min, max, step, onChange, suffix = '' }: SliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-500 font-mono">{value.toFixed(step < 1 ? 2 : 0)}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent-cyan"
      />
    </div>
  );
}

export interface SliderWithInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

export function SliderWithInput({ label, value, min, max, step, onChange }: SliderWithInputProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-400">{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="w-14 px-2 py-0.5 bg-gray-800 border border-gray-600 rounded text-gray-200 text-xs text-center focus:outline-none focus:border-accent-cyan"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-accent-cyan"
      />
    </div>
  );
}

export interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

export function Toggle({ label, value, onChange, description }: ToggleProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-9 h-5 rounded-full transition-colors ${value ? 'bg-accent-cyan' : 'bg-gray-600'}`}>
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
        </div>
      </div>
      <div className="flex-1">
        <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

// ============================================================================
// CENTRALIZED COLOR PICKER MODAL
// ============================================================================
export interface ColorPickerModalProps {
  isOpen: boolean;
  label: string;
  value: string;
  onClose: () => void;
  onColorChange: (color: string) => void;
}

export function ColorPickerModal({ isOpen, label, value, onClose, onColorChange }: ColorPickerModalProps) {
  // Draft value for the hex field, seeded from `value` on mount. The modal is
  // mounted only while open (see call site), so each open reseeds the draft.
  const [customColor, setCustomColor] = useState(value || '#000000');
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Blur background */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Centered modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
        <div
          ref={modalRef}
          className="bg-gray-800 border border-gray-600 rounded-2xl shadow-2xl p-6 w-96 pointer-events-auto"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-100">{label}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-200 transition-colors"
              title="Close (or click outside)"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Preset Palette */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-400 mb-2">Preset Colors</p>
            <div className="grid grid-cols-8 gap-2">
              {COLOR_PALETTE.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    setCustomColor(color);
                    onColorChange(color);
                  }}
                  className={`w-8 h-8 rounded-lg cursor-pointer transition-all hover:scale-110 ${
                    value && value.toLowerCase() === color.toLowerCase()
                      ? 'ring-2 ring-accent-cyan ring-offset-2 ring-offset-gray-800'
                      : 'border border-gray-600 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700 my-4" />

          {/* Custom Color */}
          <div>
            <p className="text-xs font-medium text-gray-400 mb-3">Custom Color</p>
            <div className="space-y-3">
              {/* Color Picker + Hex Input */}
              <div className="flex gap-3">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => {
                    setCustomColor(e.target.value);
                    onColorChange(e.target.value);
                  }}
                  className="w-12 h-12 rounded-lg cursor-pointer border border-gray-600"
                  title="Click to pick a color"
                />
                <div className="flex-1">
                  <input
                    type="text"
                    value={customColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomColor(val);
                      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
                        onColorChange(val);
                      }
                    }}
                    placeholder="#000000"
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-300 text-sm font-mono focus:outline-none focus:border-accent-cyan transition-colors"
                    title="Enter hex color code"
                  />
                  <p className="text-[10px] text-gray-500 mt-1 italic">Format: #RRGGBB</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-[10px] text-gray-500 text-center">
              Click outside or close button to dismiss
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  onOpenModal?: () => void;
}

export function ColorPicker({ value, label, onOpenModal }: ColorPickerProps) {
  // This component is now just a button that opens the modal
  return (
    <button
      onClick={onOpenModal}
      className="w-7 h-7 rounded cursor-pointer border-2 border-gray-600 hover:border-gray-400 transition-all hover:scale-110 shadow-sm active:scale-95"
      style={{ backgroundColor: value }}
      title={label ? `Click to pick ${label}` : 'Click to pick a color'}
    />
  );
}

export interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onOpenModal?: () => void;
}

export function ColorInput({ label, value, onChange, onOpenModal }: ColorInputProps) {
  return (
    <div className="flex items-center gap-2">
      <ColorPicker value={value} onChange={onChange} label={label} onOpenModal={onOpenModal} />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

export interface LineStyleSelectProps {
  value: LineStyle;
  onChange: (value: LineStyle) => void;
}

export function LineStyleSelect({ value, onChange }: LineStyleSelectProps) {
  const styles: LineStyle[] = ['solid', 'dashed', 'dotted'];
  const dashArrays = { solid: 'none', dashed: '6,3', dotted: '2,3' };

  return (
    <div className="flex gap-1">
      {styles.map((style) => (
        <button
          key={style}
          onClick={() => onChange(style)}
          className={`flex-1 py-1.5 rounded transition-all ${
            value === style
              ? 'bg-accent-cyan text-gray-900'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-400'
          }`}
          title={style.charAt(0).toUpperCase() + style.slice(1)}
        >
          <svg width="100%" height="8" viewBox="0 0 40 8" preserveAspectRatio="xMidYMid meet">
            <line
              x1="4" y1="4" x2="36" y2="4"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={dashArrays[style]}
              strokeLinecap="round"
            />
          </svg>
        </button>
      ))}
    </div>
  );
}

export interface SelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}

export function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-gray-400 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-gray-300 text-xs focus:outline-none focus:border-accent-cyan"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function Button({ children, onClick, variant = 'secondary', icon, disabled, className = '', title }: ButtonProps) {
  const variants = {
    primary: 'bg-accent-cyan hover:bg-cyan-500 text-gray-900 font-medium',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200',
    danger: 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50',
    ghost: 'bg-transparent hover:bg-gray-700/50 text-gray-400 hover:text-gray-200',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}

export interface IconButtonProps {
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
}

export function IconButton({ icon, onClick, disabled, title, active }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-accent-cyan text-gray-900'
          : 'bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-gray-200'
      }`}
    >
      {icon}
    </button>
  );
}
