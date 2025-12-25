import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X as XIcon } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(year, month, day);
    const dateString = selectedDate.toISOString().split('T')[0];

    if (selectingStart) {
      onStartDateChange(dateString);
      setSelectingStart(false);
    } else {
      if (startDate && new Date(dateString) < new Date(startDate)) {
        onStartDateChange(dateString);
        onEndDateChange('');
      } else {
        onEndDateChange(dateString);
        setIsOpen(false);
        setSelectingStart(true);
      }
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1));
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);

    onStartDateChange(start.toISOString().split('T')[0]);
    onEndDateChange(end.toISOString().split('T')[0]);
    setIsOpen(false);
    setSelectingStart(true);
  };

  const handleClear = () => {
    onClear();
    setSelectingStart(true);
    setIsOpen(false);
  };

  const isDateInRange = (day: number) => {
    if (!startDate || !endDate) return false;
    const date = new Date(year, month, day);
    return date >= new Date(startDate) && date <= new Date(endDate);
  };

  const isStartDate = (day: number) => {
    if (!startDate) return false;
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0] === startDate;
  };

  const isEndDate = (day: number) => {
    if (!endDate) return false;
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0] === endDate;
  };

  const formatDisplayDate = () => {
    if (!startDate && !endDate) return 'Select date range';
    if (startDate && !endDate) return `${new Date(startDate).toLocaleDateString()} - Select end`;
    if (startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
    }
    return 'Select date range';
  };

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="text-gray-700">{formatDisplayDate()}</span>
        {(startDate || endDate) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <XIcon className="h-3 w-3" />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 w-80">
          <div className="flex gap-2 mb-4 pb-4 border-b border-gray-200">
            <button
              onClick={() => handleQuickSelect(7)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Last 7 days
            </button>
            <button
              onClick={() => handleQuickSelect(30)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Last 30 days
            </button>
            <button
              onClick={() => handleQuickSelect(90)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Last 90 days
            </button>
          </div>

          <div className="flex items-center justify-between mb-4">
            <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {monthNames[month]} {year}
            </span>
            <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const inRange = isDateInRange(day);
              const isStart = isStartDate(day);
              const isEnd = isEndDate(day);
              const isSelected = isStart || isEnd;

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={`
                    h-8 w-8 text-sm rounded-lg transition-colors
                    ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold'
                        : inRange
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600 text-center">
            {selectingStart ? 'Select start date' : 'Select end date'}
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
