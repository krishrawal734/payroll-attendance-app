import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
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

    // Next month filler days to complete rows (multiple of 7)
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

  // Formatted date string for preview: e.g. "Wed, 25 Nov 2026"
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
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTopRow}>
                  <View style={styles.headerTitleWrap}>
                    <CalendarIcon size={15} color="#c7d2fe" />
                    <Text style={styles.headerTitleText}>{title}</Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onClose}
                    style={styles.closeBtn}
                  >
                    <X size={15} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.headerDateText}>{formattedPickedDate || pickedDate}</Text>
              </View>

              {/* Month Navigator */}
              <View style={styles.navRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handlePrevMonth}
                  style={styles.navBtn}
                >
                  <ChevronLeft size={18} color="#334155" />
                </TouchableOpacity>

                <View style={styles.monthTitleWrap}>
                  <Text style={styles.monthTitleText}>
                    {MONTH_NAMES[viewMonth]} {viewYear}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleJumpToday}
                    style={styles.todayPill}
                  >
                    <Text style={styles.todayPillText}>Today</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleNextMonth}
                  style={styles.navBtn}
                >
                  <ChevronRight size={18} color="#334155" />
                </TouchableOpacity>
              </View>

              {/* Week Day Header */}
              <View style={styles.weekDaysRow}>
                {WEEK_DAYS.map((wd, i) => (
                  <View key={wd} style={styles.weekDayCell}>
                    <Text
                      style={[
                        styles.weekDayText,
                        (i === 0 || i === 6) && styles.weekEndText,
                      ]}
                    >
                      {wd}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Day Grid */}
              <View style={styles.gridContainer}>
                <View style={styles.gridWrap}>
                  {calendarGrid.map((item, idx) => {
                    const isSelected = item.isSelected;
                    const isToday = item.isToday;
                    const isDisabled = item.isDisabled;
                    const isCurrent = item.isCurrentMonth;

                    return (
                      <View key={`${item.dateStr}_${idx}`} style={styles.cellOuter}>
                        <TouchableOpacity
                          activeOpacity={0.7}
                          disabled={isDisabled}
                          onPress={() => handleSelectDay(item.dateStr, isDisabled)}
                          style={[
                            styles.cellInner,
                            isSelected && styles.cellSelected,
                            isToday && !isSelected && styles.cellToday,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayNumberText,
                              isSelected && styles.dayNumberSelected,
                              isDisabled && styles.dayNumberDisabled,
                              !isCurrent && !isDisabled && styles.dayNumberNotCurrent,
                              isToday && !isSelected && styles.dayNumberToday,
                            ]}
                          >
                            {item.dayNum}
                          </Text>

                          {/* Today Dot indicator if not selected */}
                          {isToday && !isSelected && <View style={styles.todayDot} />}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>

              {/* Quick Presets */}
              <View style={styles.presetsRow}>
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
                      style={[
                        styles.presetBtn,
                        active && styles.presetBtnActive,
                      ]}
                    >
                      <Text style={[styles.presetBtnText, active && styles.presetBtnTextActive]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={onClose}
                  style={styles.cancelBtn}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleConfirm}
                  style={styles.confirmBtn}
                >
                  <Check size={15} color="#ffffff" />
                  <Text style={styles.confirmBtnText}>Select Date</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitleText: {
    color: '#c7d2fe',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 6,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3730a3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDateText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginRight: 8,
  },
  todayPill: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  todayPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4f46e5',
  },
  weekDaysRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  weekEndText: {
    color: '#f43f5e',
  },
  gridContainer: {
    padding: 12,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cellOuter: {
    width: '14.28%',
    aspectRatio: 1,
    padding: 2,
  },
  cellInner: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  cellSelected: {
    backgroundColor: '#4f46e5',
  },
  cellToday: {
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#a5b4fc',
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
  dayNumberSelected: {
    color: '#ffffff',
    fontWeight: '900',
  },
  dayNumberDisabled: {
    color: '#cbd5e1',
    fontWeight: '400',
    textDecorationLine: 'line-through',
  },
  dayNumberNotCurrent: {
    color: '#cbd5e1',
    fontWeight: '500',
  },
  dayNumberToday: {
    color: '#4338ca',
    fontWeight: '800',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#4f46e5',
    position: 'absolute',
    bottom: 3,
  },
  presetsRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 6,
  },
  presetBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
  },
  presetBtnActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  presetBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  presetBtnTextActive: {
    color: '#ffffff',
  },
  actionRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  confirmBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 6,
  },
});
