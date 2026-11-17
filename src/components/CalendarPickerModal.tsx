import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check, X } from 'lucide-react-native';

interface CalendarPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (dateStr: string) => void;
  selectedDate?: string; // YYYY-MM-DD
  minDate?: string; // YYYY-MM-DD
  title?: string;
}

const MONTH_NAMES = [
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
  'December',
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
  visible,
  onClose,
  onSelectDate,
  selectedDate,
  minDate,
  title = 'Select Date',
}) => {
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const initialDate = selectedDate || todayStr;

  const [pickedDate, setPickedDate] = useState<string>(initialDate);
  const [viewYear, setViewYear] = useState<number>(() => {
    const parts = initialDate.split('-');
    return parts.length === 3 ? parseInt(parts[0], 10) : new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const parts = initialDate.split('-');
    return parts.length === 3 ? parseInt(parts[1], 10) - 1 : new Date().getMonth();
  });

  useEffect(() => {
    if (visible) {
      const target = selectedDate || todayStr;
      setPickedDate(target);
      const parts = target.split('-');
      if (parts.length === 3) {
        setViewYear(parseInt(parts[0], 10));
        setViewMonth(parseInt(parts[1], 10) - 1);
      }
    }
  }, [visible, selectedDate, todayStr]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setPickedDate(todayStr);
  };

  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isDisabled: boolean;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: false,
        isDisabled: minDate ? dateStr < minDate : false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === pickedDate,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        isDisabled: minDate ? dateStr < minDate : false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === pickedDate,
      });
    }

    // Next month filler days to complete rows (up to multiple of 7)
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: false,
        isDisabled: minDate ? dateStr < minDate : false,
        isToday: dateStr === todayStr,
        isSelected: dateStr === pickedDate,
      });
    }

    return cells;
  }, [viewYear, viewMonth, pickedDate, minDate, todayStr]);

  const handleSelectDay = (dateStr: string, disabled: boolean) => {
    if (disabled) return;
    setPickedDate(dateStr);
  };

  const handleConfirm = () => {
    onSelectDate(pickedDate);
    onClose();
  };

  // Formatted date string for header preview: e.g. "Wed, 25 Nov 2026"
  const formattedPickedDate = useMemo(() => {
    if (!pickedDate) return '';
    try {
      const parts = pickedDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        });
      }
    } catch {}
    return pickedDate;
  }, [pickedDate]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View
          style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 }}
        >
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-3xl w-full max-w-sm overflow-hidden border border-slate-200">
              {/* Header */}
              <View className="bg-indigo-600 px-5 pt-5 pb-4">
                <View className="flex-row justify-between items-center mb-1.5">
                  <View className="flex-row items-center">
                    <CalendarIcon size={16} color="#c7d2fe" />
                    <Text className="text-indigo-200 text-xs font-bold uppercase tracking-wider ml-1.5">
                      {title}
                    </Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onClose}
                    className="w-7 h-7 rounded-full bg-indigo-800 items-center justify-center"
                  >
                    <X size={15} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                <Text className="text-white text-xl font-black">{formattedPickedDate || pickedDate}</Text>
              </View>

              {/* Month Navigator */}
              <View className="flex-row justify-between items-center px-4 py-3 border-b border-slate-100">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handlePrevMonth}
                  className="w-9 h-9 rounded-xl bg-slate-100 items-center justify-center"
                >
                  <ChevronLeft size={18} color="#334155" />
                </TouchableOpacity>

                <View className="flex-row items-center">
                  <Text className="text-sm font-black text-slate-900 mr-2">
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleJumpToday}
                    className="bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full"
                  >
                    <Text className="text-[10px] font-black text-indigo-700">Today</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleNextMonth}
                  className="w-9 h-9 rounded-xl bg-slate-100 items-center justify-center"
                >
                  <ChevronRight size={18} color="#334155" />
                </TouchableOpacity>
              </View>

              {/* Week Day Header */}
              <View className="flex-row px-3 pt-2 pb-1 border-b border-slate-100 bg-slate-50">
                {WEEK_DAYS.map((wd, i) => (
                  <View key={wd} className="flex-1 items-center">
                    <Text
                      className={`text-[11px] font-extrabold ${
                        i === 0 || i === 6 ? 'text-rose-400' : 'text-slate-500'
                      }`}
                    >
                      {wd}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Day Grid */}
              <View className="p-3">
                <View className="flex-row flex-wrap">
                  {calendarGrid.map((item, idx) => {
                    const isSelected = item.isSelected;
                    const isToday = item.isToday;
                    const isDisabled = item.isDisabled;
                    const isCurrent = item.isCurrentMonth;

                    return (
                      <View key={`${item.dateStr}_${idx}`} className="w-[14.28%] aspect-square p-0.5">
                        <TouchableOpacity
                          activeOpacity={0.7}
                          disabled={isDisabled}
                          onPress={() => handleSelectDay(item.dateStr, isDisabled)}
                          className={`w-full h-full rounded-2xl items-center justify-center relative ${
                            isSelected
                              ? 'bg-indigo-600'
                              : isToday
                              ? 'bg-indigo-50 border border-indigo-300'
                              : 'bg-white'
                          }`}
                        >
                          <Text
                            className={`text-xs ${
                              isSelected
                                ? 'text-white font-black'
                                : isDisabled
                                ? 'text-slate-300 font-normal line-through'
                                : !isCurrent
                                ? 'text-slate-300 font-medium'
                                : isToday
                                ? 'text-indigo-700 font-extrabold'
                                : 'text-slate-800 font-bold'
                            }`}
                          >
                            {item.dayNum}
                          </Text>

                          {/* Today Dot indicator if not selected */}
                          {isToday && !isSelected && (
                            <View className="w-1 h-1 rounded-full bg-indigo-600 absolute bottom-1" />
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Quick Presets */}
              <View className="flex-row px-4 pb-3 justify-between space-x-1.5">
                {[
                  { label: 'Today', days: 0 },
                  { label: 'Tomorrow', days: 1 },
                  { label: '+2 Days', days: 2 },
                  { label: '+3 Days', days: 3 },
                ].map((preset) => {
                  const targetD = new Date();
                  targetD.setDate(targetD.getDate() + preset.days);
                  const targetStr = targetD.toISOString().split('T')[0];
                  const active = pickedDate === targetStr;

                  return (
                    <TouchableOpacity
                      key={preset.label}
                      activeOpacity={0.7}
                      onPress={() => {
                        setPickedDate(targetStr);
                        setViewYear(targetD.getFullYear());
                        setViewMonth(targetD.getMonth());
                      }}
                      className={`flex-1 py-1.5 rounded-xl border items-center mr-1 last:mr-0 ${
                        active
                          ? 'bg-indigo-600 border-indigo-600'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <Text
                        className={`text-[10px] font-bold ${
                          active ? 'text-white' : 'text-slate-600'
                        }`}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action Buttons */}
              <View className="flex-row p-3 bg-slate-50 border-t border-slate-100">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 mr-2 items-center bg-white"
                >
                  <Text className="text-xs font-bold text-slate-700">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 items-center justify-center flex-row"
                >
                  <Check size={14} color="#ffffff" />
                  <Text className="text-xs font-black text-white ml-1.5">Select Date</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
