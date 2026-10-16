import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useProfiles } from '@/contexts/ProfileContext';

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profiles, clearProfiles } = useProfiles();
  const webInsets = Platform.OS === 'web';

  const clearAll = () => {
    const remove = async () => {
      try {
        await clearProfiles();
      } catch {
        if (Platform.OS === 'web') {
          window.alert('Не удалось удалить профили. Попробуй ещё раз.');
        } else {
          Alert.alert('Ошибка', 'Не удалось удалить профили. Попробуй ещё раз.');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Удалить все профили и сохранённые ключи с устройства?')) {
        void remove();
      }
      return;
    }
    Alert.alert(
      'Удалить все профили?',
      'Сохранённые профили и ключи будут удалены с этого устройства.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Удалить всё', style: 'destructive', onPress: () => void remove() },
      ],
    );
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: webInsets ? Math.max(insets.top, 67) : 18,
            paddingBottom: webInsets ? 124 : 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.eyebrow, { color: colors.primary }]}>ПАРАМЕТРЫ</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Настройки</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Управление профилями и приватностью.
        </Text>

        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            ПРОФИЛИ
          </Text>
          <View style={styles.settingRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
              <Ionicons name="server-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>
                Сохранённые серверы
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.mutedForeground }]}>
                {profiles.length} {profiles.length === 1 ? 'профиль' : 'профилей'}
              </Text>
            </View>
            <Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.settingRow}>
            <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
              <Ionicons name="key-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: colors.foreground }]}>
                Хранение ключей
              </Text>
              <Text style={[styles.settingSubtitle, { color: colors.mutedForeground }]}>
                Защищённая память устройства
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
            ПОДДЕРЖИВАЕМЫЕ ФОРМАТЫ
          </Text>
          {[
            'VLESS / REALITY',
            'VMess',
            'Trojan',
            'Shadowsocks',
            'SOCKS5 / HTTP',
            'Xray JSON',
            'Текстовые подписки',
          ].map(
            (item, index) => (
              <View key={item}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                <View style={styles.formatRow}>
                  <Text style={[styles.formatText, { color: colors.foreground }]}>{item}</Text>
                  <Ionicons name="checkmark" size={17} color={colors.primary} />
                </View>
              </View>
            ),
          )}
        </View>

        <View style={[styles.privacyCard, { backgroundColor: colors.card }]}>
          <View style={[styles.privacyIcon, { backgroundColor: colors.accent }]}>
            <Ionicons name="shield-checkmark-outline" size={19} color={colors.primary} />
          </View>
          <Text style={[styles.privacyTitle, { color: colors.foreground }]}>
            Приватность по умолчанию
          </Text>
          <Text style={[styles.privacyBody, { color: colors.mutedForeground }]}>
            Конфигурации хранятся локально в защищённом хранилище Android. Приложение не
            отправляет ключи на свой сервер.
          </Text>
        </View>

        <Pressable
          onPress={clearAll}
          disabled={!profiles.length}
          accessibilityRole="button"
          testID="clear-profiles"
          style={({ pressed }) => [
            styles.clearButton,
            {
              borderColor: colors.border,
              opacity: !profiles.length ? 0.42 : pressed ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="trash-outline" size={17} color={colors.destructive} />
          <Text style={[styles.clearText, { color: colors.destructive }]}>
            Удалить все профили
          </Text>
        </Pressable>

        <Text style={[styles.version, { color: colors.mutedForeground }]}>
          NEXA VPN · версия 1.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22 },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.7, marginBottom: 9 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.7 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 10 },
  section: { borderBottomWidth: 1, marginTop: 29, paddingBottom: 7 },
  sectionTitle: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4, marginBottom: 12 },
  settingRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 37, height: 37, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1 },
  settingTitle: { fontSize: 13, fontWeight: '600' },
  settingSubtitle: { fontSize: 11, marginTop: 4 },
  divider: { height: 1, marginLeft: 49 },
  formatRow: { minHeight: 43, alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  formatText: { fontSize: 12, fontWeight: '500' },
  privacyCard: { borderRadius: 20, padding: 17, marginTop: 25 },
  privacyIcon: { width: 39, height: 39, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  privacyTitle: { fontSize: 14, fontWeight: '700' },
  privacyBody: { fontSize: 11, lineHeight: 17, marginTop: 6 },
  clearButton: { height: 49, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 21 },
  clearText: { fontSize: 12, fontWeight: '600' },
  version: { fontSize: 10, textAlign: 'center', marginTop: 25, letterSpacing: 0.6 },
});
