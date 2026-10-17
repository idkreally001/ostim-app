import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { logService, LogEntry } from '../services/logService';

export const LogsScreen: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error'>('all');

  useEffect(() => {
    setLogs(logService.getLogs());
    const unsubscribe = logService.subscribe(() => {
      setLogs(logService.getLogs());
    });
    return unsubscribe;
  }, []);

  const filteredLogs = filter === 'error' ? logs.filter((l) => l.level === 'error') : logs;

  const handleClear = () => {
    logService.clear();
  };

  const getLevelStyle = (lvl: string) => {
    switch (lvl) {
      case 'error':
        return { bg: '#451a1a', text: '#f87171', border: '#7f1d1d' };
      case 'warn':
        return { bg: '#422006', text: '#fbbf24', border: '#78350f' };
      default:
        return { bg: '#172554', text: '#60a5fa', border: '#1e3a8a' };
    }
  };

  return (
    <View style={styles.container}>
      {/* Control Header */}
      <View style={styles.topBar}>
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
            onPress={() => setFilter('all')}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              Tümü ({logs.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterBtn, filter === 'error' && styles.filterBtnActive]}
            onPress={() => setFilter('error')}
          >
            <Text style={[styles.filterText, filter === 'error' && styles.filterTextActive]}>
              Hatalar ({logs.filter((l) => l.level === 'error').length})
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearText}>Temizle</Text>
        </TouchableOpacity>
      </View>

      {/* Log Feed */}
      <ScrollView style={styles.list}>
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>Kayıtlı sistem hatası yok</Text>
            <Text style={styles.emptyDesc}>Tüm API istekleri normal görünüyor.</Text>
          </View>
        ) : (
          filteredLogs.map((item) => {
            const st = getLevelStyle(item.level);
            return (
              <View
                key={item.id}
                style={[styles.logCard, { borderColor: st.border, backgroundColor: '#121826' }]}
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.badge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.badgeText, { color: st.text }]}>
                      {item.level.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.tagText}>{item.tag}</Text>
                  <Text style={styles.timeText}>{item.timestamp}</Text>
                </View>

                <Text style={styles.messageText}>{item.message}</Text>

                {item.details ? (
                  <View style={styles.detailsBox}>
                    <Text style={styles.detailsText} selectable>
                      {item.details}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e17',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#121826',
  },
  filterRow: {
    flexDirection: 'row',
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    marginRight: 8,
  },
  filterBtnActive: {
    backgroundColor: '#2563eb',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  clearText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f8fafc',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  logCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f8fafc',
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    color: '#64748b',
  },
  messageText: {
    fontSize: 13,
    color: '#e2e8f0',
    lineHeight: 18,
  },
  detailsBox: {
    marginTop: 8,
    backgroundColor: '#090d16',
    borderRadius: 8,
    padding: 8,
  },
  detailsText: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748b',
  },
});
