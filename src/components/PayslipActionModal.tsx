import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {
  X,
  Share2,
  Download,
  RefreshCw,
  Trash2,
  ChevronRight,
  FileText,
} from 'lucide-react-native';
import { Payslip, Employee } from '../types';

interface PayslipActionModalProps {
  visible: boolean;
  payslip: Payslip | null;
  employee: Employee | null;
  paidAmount?: number;
  onClose: () => void;
  onShareDirectly: () => Promise<void>;
  onSaveToPhone: () => Promise<void>;
  onRecalculate?: () => Promise<void>;
  onDelete?: () => void;
}

type BusyAction = 'share' | 'save' | 'recalculate' | null;

export default function PayslipActionModal({
  visible,
  payslip,
  employee,
  paidAmount = 0,
  onClose,
  onShareDirectly,
  onSaveToPhone,
  onRecalculate,
  onDelete,
}: PayslipActionModalProps) {
  const [busy, setBusy] = useState<BusyAction>(null);

  if (!payslip || !employee) return null;

  const remainingToPay = Math.max(0, payslip.netPayable - paidAmount);

  const handleSafeClose = () => {
    if (busy) return;
    onClose();
  };

  const runAction = async (type: BusyAction, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(type);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleSafeClose}
    >
      <View style={styles.overlay}>
        {/* Tap outside to dismiss */}
        <Pressable style={styles.backdrop} onPress={handleSafeClose} />

        {/* Bottom Sheet */}
        <View style={styles.sheet}>
          {/* Drag Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBox}>
                <FileText size={18} color="#4f46e5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Payslip Actions</Text>
                <Text style={styles.subtitle} numberOfLines={1}>
                  {employee.fullName} • {payslip.monthYear}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleSafeClose}
              disabled={busy !== null}
              activeOpacity={0.7}
            >
              <X size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          {/* Compact Payslip Summary Strip */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>GROSS</Text>
              <Text style={styles.summaryVal}>₹{payslip.grossEarnings.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>ADVANCE</Text>
              <Text style={[styles.summaryVal, { color: '#dc2626' }]}>
                -₹{payslip.advanceDeductions.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>PAID</Text>
              <Text style={[styles.summaryVal, { color: '#4338ca' }]}>
                -₹{paidAmount.toLocaleString()}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>REMAINING</Text>
              <Text style={styles.summaryNet}>₹{remainingToPay.toLocaleString()}</Text>
            </View>
          </View>

          {/* Action List */}
          <View style={styles.actionsList}>
            {/* 1. Share Directly */}
            <TouchableOpacity
              style={[styles.actionCard, busy !== null && styles.disabledCard]}
              disabled={busy !== null}
              activeOpacity={0.8}
              onPress={() => runAction('share', onShareDirectly)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#eef2ff' }]}>
                {busy === 'share' ? (
                  <ActivityIndicator size="small" color="#4f46e5" />
                ) : (
                  <Share2 size={18} color="#4f46e5" />
                )}
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Share Directly (WhatsApp / Apps)</Text>
                <Text style={styles.actionDesc}>
                  Send official PDF payslip via WhatsApp, Gmail, or other apps
                </Text>
              </View>
              <ChevronRight size={17} color="#94a3b8" />
            </TouchableOpacity>

            {/* 2. Save PDF to Phone */}
            <TouchableOpacity
              style={[styles.actionCard, busy !== null && styles.disabledCard]}
              disabled={busy !== null}
              activeOpacity={0.8}
              onPress={() => runAction('save', onSaveToPhone)}
            >
              <View style={[styles.actionIcon, { backgroundColor: '#ecfdf5' }]}>
                {busy === 'save' ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <Download size={18} color="#059669" />
                )}
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Save PDF to Phone</Text>
                <Text style={styles.actionDesc}>
                  Download payslip PDF directly to your phone storage
                </Text>
              </View>
              <ChevronRight size={17} color="#94a3b8" />
            </TouchableOpacity>

            {/* 3. Recalculate (Admin Only) */}
            {onRecalculate && (
              <TouchableOpacity
                style={[styles.actionCard, busy !== null && styles.disabledCard]}
                disabled={busy !== null}
                activeOpacity={0.8}
                onPress={() => runAction('recalculate', onRecalculate)}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#f0f9ff' }]}>
                  {busy === 'recalculate' ? (
                    <ActivityIndicator size="small" color="#0284c7" />
                  ) : (
                    <RefreshCw size={18} color="#0284c7" />
                  )}
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={styles.actionTitle}>Recalculate with Verified Punches</Text>
                  <Text style={styles.actionDesc}>
                    Refresh earnings & allowances from latest attendance logs
                  </Text>
                </View>
                <ChevronRight size={17} color="#94a3b8" />
              </TouchableOpacity>
            )}

            {/* 4. Delete Payslip (Admin Only) */}
            {onDelete && (
              <TouchableOpacity
                style={[
                  styles.actionCard,
                  styles.deleteCard,
                  busy !== null && styles.disabledCard,
                ]}
                disabled={busy !== null}
                activeOpacity={0.8}
                onPress={() => {
                  onClose();
                  onDelete();
                }}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#fef2f2' }]}>
                  <Trash2 size={18} color="#dc2626" />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[styles.actionTitle, { color: '#b91c1c' }]}>
                    Delete Payslip
                  </Text>
                  <Text style={[styles.actionDesc, { color: '#dc2626' }]}>
                    Remove slip and reset status back to Pending
                  </Text>
                </View>
                <ChevronRight size={17} color="#f87171" />
              </TouchableOpacity>
            )}
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleSafeClose}
            disabled={busy !== null}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 11,
    marginRight: 10,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.5,
  },
  summaryNet: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
    marginTop: 3,
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 3,
  },
  actionsList: {
    gap: 10,
    marginBottom: 14,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  deleteCard: {
    backgroundColor: '#fffafa',
    borderColor: '#fecaca',
  },
  disabledCard: {
    opacity: 0.6,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  actionDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 15,
  },
  cancelBtn: {
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
