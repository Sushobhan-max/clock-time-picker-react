'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import './styles.css';

export interface ClockTimePickerChangeEvent {
  target: {
    name?: string;
    value: string;
  };
}

export interface ClockTimePickerProps {
  /** Current value. Accepts "HH:mm" (24hr) or "hh:mm AM/PM" (12hr) */
  value?: string;
  /**
   * Fires with a synthetic-like event containing { target: { name, value } }.
   * Handy if you're wiring this into existing form state that expects a
   * native-input-shaped event. Optional if you use `onValueChange` instead.
   */
  onChange?: (e: ClockTimePickerChangeEvent) => void;
  /**
   * Fires with just the new "HH:mm" string. Simpler signature for new code —
   * use this if you don't need the event-object wrapper.
   */
  onValueChange?: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  id?: string;
  name?: string;
  placeholder?: string;
  /**
   * Controlled open state. When provided, the component renders no input —
   * the consumer controls the trigger (e.g. their own button).
   */
  open?: boolean;
  /**
   * Called when the picker wants to open or close itself.
   * Use together with `open` for fully controlled mode.
   */
  onOpenChange?: (open: boolean) => void;
  /** Extra class applied to the input, merges with (doesn't replace) internal styling */
  className?: string;
  /** Extra class applied to the popup/modal wrapper */
  popupClassName?: string;
}

type Tab = 'hour' | 'minute';

function parseValue(value?: string) {
  let hour = 12;
  let minute = 0;
  let ampm: 'AM' | 'PM' = 'AM';

  if (!value) return { hour, minute, ampm };

  if (value.includes('AM') || value.includes('PM')) {
    const [time, period] = value.split(' ');
    const [h, m] = time.split(':');
    const hourNum = parseInt(h, 10);
    const minuteNum = parseInt(m, 10);
    if (
      isNaN(hourNum) || isNaN(minuteNum) ||
      hourNum < 1 || hourNum > 12 ||
      minuteNum < 0 || minuteNum > 59
    ) return { hour, minute, ampm };
    ampm = period as 'AM' | 'PM';
    hour = hourNum;
    minute = minuteNum;
  } else {
    const [h, m] = value.split(':');
    const hourNum = parseInt(h, 10);
    const minuteNum = parseInt(m, 10);
    if (
      isNaN(hourNum) || isNaN(minuteNum) ||
      hourNum < 0 || hourNum > 23 ||
      minuteNum < 0 || minuteNum > 59
    ) return { hour, minute, ampm };
    ampm = hourNum >= 12 ? 'PM' : 'AM';
    hour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    minute = minuteNum;
  }
  return { hour, minute, ampm };
}

function formatDisplayValue(value?: string) {
  if (!value) return '';
  if (value.includes('AM') || value.includes('PM')) {
    const [time, period] = value.split(' ');
    const [h, m] = time.split(':');
    const hourNum = parseInt(h, 10);
    const minuteNum = parseInt(m, 10);
    if (
      isNaN(hourNum) || isNaN(minuteNum) ||
      hourNum < 1 || hourNum > 12 ||
      minuteNum < 0 || minuteNum > 59
    ) return '';
    return value;
  }
  const [h, m] = value.split(':');
  const hourNum = parseInt(h, 10);
  const minuteNum = parseInt(m, 10);
  if (
    isNaN(hourNum) || isNaN(minuteNum) ||
    hourNum < 0 || hourNum > 23 ||
    minuteNum < 0 || minuteNum > 59
  ) return '';
  const period = hourNum >= 12 ? 'PM' : 'AM';
  const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
  return `${displayHour.toString().padStart(2, '0')}:${m} ${period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5);

const ClockTimePicker: React.FC<ClockTimePickerProps> = ({
  value,
  onChange,
  onValueChange,
  onBlur,
  id,
  name,
  placeholder = 'Select time',
  open: controlledOpen,
  onOpenChange,
  className = '',
  popupClassName = '',
}) => {
  const isControlled = controlledOpen !== undefined;
  const initial = parseValue(value);
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('hour');
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(initial.ampm);
  const [isDragging, setIsDragging] = useState(false);

  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (val: boolean) => {
    if (!isControlled) setInternalOpen(val);
    onOpenChange?.(val);
  };

  const clockFaceRef = useRef<SVGSVGElement | null>(null);
  const activeTabRef = useRef<Tab>(activeTab);
  activeTabRef.current = activeTab;

  // Re-sync internal state whenever the external value changes (e.g. editing an existing entry)
  useEffect(() => {
    if (!value) return;
    const parsed = parseValue(value);
    setHour(parsed.hour);
    setMinute(parsed.minute);
    setAmpm(parsed.ampm);
  }, [value]);

  const getHourFromPosition = useCallback((clientX: number, clientY: number) => {
    const rect = clockFaceRef.current?.getBoundingClientRect();
    if (!rect) return hour;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let angle = Math.atan2(dy, dx);
    angle = angle < -Math.PI / 2 ? angle + 2 * Math.PI : angle;
    let h = Math.round(((angle + Math.PI / 2) / (2 * Math.PI)) * 12);
    if (h <= 0) h = 12;
    if (h > 12) h = 1;
    return h;
  }, [hour]);

  const getMinuteFromPosition = useCallback((clientX: number, clientY: number) => {
    const rect = clockFaceRef.current?.getBoundingClientRect();
    if (!rect) return minute;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let angle = Math.atan2(dy, dx);
    angle = angle < -Math.PI / 2 ? angle + 2 * Math.PI : angle;
    let m = Math.round(((angle + Math.PI / 2) / (2 * Math.PI)) * 12) * 5;
    if (m >= 60) m = 0;
    if (m < 0) m = 55;
    return m;
  }, [minute]);

  const updateFromPosition = useCallback((clientX: number, clientY: number) => {
    if (activeTabRef.current === 'minute') {
      setMinute(getMinuteFromPosition(clientX, clientY));
    } else {
      setHour(getHourFromPosition(clientX, clientY));
    }
  }, [getHourFromPosition, getMinuteFromPosition]);

  // Global listeners so dragging keeps working even if the pointer leaves the SVG
  useEffect(() => {
    if (!isDragging) return;

    const handleUp = () => setIsDragging(false);
    const handleMove = (e: MouseEvent) => updateFromPosition(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) updateFromPosition(touch.clientX, touch.clientY);
    };

    window.addEventListener('mouseup', handleUp);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchend', handleUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isDragging, updateFromPosition]);

  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    updateFromPosition(clientX, clientY);
  };

  const handleHourClick = (h: number) => {
    setHour(h);
    setActiveTab('minute');
  };

  const handleAmpmToggle = (val: 'AM' | 'PM') => setAmpm(val);

  const handleOk = () => {
    const formattedHour = hour.toString().padStart(2, '0');
    const formattedMinute = minute.toString().padStart(2, '0');
    const formatted = `${formattedHour}:${formattedMinute} ${ampm}`;

    // 24hr version for onChange consumers
    let hour24 = hour;
    if (ampm === 'PM' && hour !== 12) hour24 = hour + 12;
    else if (ampm === 'AM' && hour === 12) hour24 = 0;
    const formatted24 = `${hour24.toString().padStart(2, '0')}:${formattedMinute}`;

    onChange?.({ target: { name, value: formatted24 } });
    onValueChange?.(formatted);
    setOpen(false);
  };

  const handleCancel = () => setOpen(false);

  return (
    <>
      {!isControlled && (
        <input
          type="text"
          id={id}
          name={name}
          readOnly
          value={formatDisplayValue(value)}
          placeholder={placeholder}
          className={`ctp-input ${className}`.trim()}
          onClick={() => setOpen(true)}
          onBlur={onBlur}
        />
      )}
      {open && (
        <div className="ctp-overlay">
          <div className={`ctp-popup ${popupClassName}`.trim()}>
            <div className="ctp-header">
              <div className="ctp-time-display">
                <span
                  className={`ctp-time-segment ${activeTab === 'hour' ? 'ctp-time-segment--active' : ''}`}
                  onClick={() => setActiveTab('hour')}
                >
                  {hour.toString().padStart(2, '0')}
                </span>
                <span className="ctp-time-colon">:</span>
                <span
                  className={`ctp-time-segment ${activeTab === 'minute' ? 'ctp-time-segment--active' : ''}`}
                  onClick={() => setActiveTab('minute')}
                >
                  {minute.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="ctp-ampm">
                <button
                  type="button"
                  className={`ctp-ampm-btn ${ampm === 'AM' ? 'ctp-ampm-btn--active' : ''}`}
                  onClick={() => handleAmpmToggle('AM')}
                >
                  AM
                </button>
                <button
                  type="button"
                  className={`ctp-ampm-btn ${ampm === 'PM' ? 'ctp-ampm-btn--active' : ''}`}
                  onClick={() => handleAmpmToggle('PM')}
                >
                  PM
                </button>
              </div>
            </div>

            <div className="ctp-subtitle">
              {activeTab === 'hour' ? 'Select hour' : 'Select minute'}
            </div>

            <div className="ctp-face-wrap">
              <svg
                ref={clockFaceRef}
                className="ctp-face"
                width="270"
                height="270"
                viewBox="0 0 270 270"
                style={{ touchAction: 'none' }}
                onMouseDown={(e) => handlePointerDown(e.clientX, e.clientY)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  if (touch) handlePointerDown(touch.clientX, touch.clientY);
                }}
              >
                <circle cx="135" cy="135" r="125" className="ctp-face-bg" />

                {activeTab === 'hour'
                  ? HOURS.map((h) => {
                      const angle = ((h % 12) / 12) * 2 * Math.PI - Math.PI / 2;
                      const x = 135 + Math.cos(angle) * 100;
                      const y = 135 + Math.sin(angle) * 100;
                      const highlight = h === hour;
                      return (
                        <g
                          key={h}
                          className="ctp-tick"
                          onClick={() => handleHourClick(h)}
                        >
                          {highlight && <circle cx={x} cy={y} r={16} className="ctp-tick-highlight" />}
                          <text
                            x={x}
                            y={y + 6}
                            textAnchor="middle"
                            fontSize={17}
                            className={highlight ? 'ctp-tick-text--active' : 'ctp-tick-text'}
                          >
                            {h}
                          </text>
                        </g>
                      );
                    })
                  : MINUTE_STEPS.map((m) => {
                      const angle = (m / 60) * 2 * Math.PI - Math.PI / 2;
                      const x = 135 + Math.cos(angle) * 100;
                      const y = 135 + Math.sin(angle) * 100;
                      const highlight = m === minute;
                      return (
                        <g
                          key={m}
                          className="ctp-tick"
                          onClick={() => setMinute(m)}
                        >
                          {highlight && <circle cx={x} cy={y} r={16} className="ctp-tick-highlight" />}
                          <text
                            x={x}
                            y={y + 6}
                            textAnchor="middle"
                            fontSize={17}
                            className={highlight ? 'ctp-tick-text--active' : 'ctp-tick-text'}
                          >
                            {m.toString().padStart(2, '0')}
                          </text>
                        </g>
                      );
                    })}

                <circle cx="135" cy="135" r="6" className="ctp-center-dot" />

                {activeTab === 'hour' ? (
                  <line
                    x1="135"
                    y1="135"
                    x2={135 + Math.cos(((hour % 12) / 12) * 2 * Math.PI - Math.PI / 2) * 84}
                    y2={135 + Math.sin(((hour % 12) / 12) * 2 * Math.PI - Math.PI / 2) * 84}
                    className="ctp-hand"
                  />
                ) : (
                  <line
                    x1="135"
                    y1="135"
                    x2={135 + Math.cos((minute / 60) * 2 * Math.PI - Math.PI / 2) * 84}
                    y2={135 + Math.sin((minute / 60) * 2 * Math.PI - Math.PI / 2) * 84}
                    className="ctp-hand"
                  />
                )}
              </svg>
            </div>

            <div className="ctp-actions">
              <button type="button" className="ctp-btn ctp-btn--ghost" onClick={handleCancel}>
                Cancel
              </button>
              <button type="button" className="ctp-btn ctp-btn--solid" onClick={handleOk}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClockTimePicker;
