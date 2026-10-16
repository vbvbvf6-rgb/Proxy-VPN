import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { getProtocolLabel, parseProfiles, type VPNProfile } from '@/lib/profiles';
import { useProfiles } from '@/contexts/ProfileContext';

function notify(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function ProfileRow({
  profile,
  active,
  onSelect,
  onDelete,
}: {
  profile: VPNProfile;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      testID={`profile-${profile.id}`}
      style={({ pressed }) => [
        styles.profileRow,
        {
          backgroundColor: colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={[styles.protocolBadge, { backgroundColor: colors.accent }]}>
        <MaterialCommunityIcons
          name="server-network"
          size={20}
          color={colors.primary}
        />
      </View>
      <View style={styles.profileDetails}>
        <View style={styles.profileNameLine}>
          <Text style={[styles.profileName, { color: colors.foreground }]} numberOfLines={1}>
            {profile.name}
          </Text>
          {active && <View style={[styles.activeDot, { backgroundColor: colors.primary }]} />}
        </View>
        <Text style={[styles.profileHost, { color: colors.mutedForeground }]} numberOfLines={1}>
          {profile.host}:{profile.port}
        </Text>
        <View style={[styles.protocolChip, { backgroundColor: colors.secondary }]}>
          <Text style={[styles.protocolText, { color: colors.mutedForeground }]}>
            {getProtocolLabel(profile.protocol)}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Удалить ${profile.name}`}
        testID={`delete-profile-${profile.id}`}
        hitSlop={10}
        style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.55 }]}
      >
        <Ionicons name="trash-outline" size={18} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

export default function ProfilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profiles, selectedId, loading, addProfiles, selectProfile, removeProfile } =
    useProfiles();
  const [modalVisible, setModalVisible] = useState(false);
  const [input, setInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [clipboardBusy, setClipboardBusy] = useState(false);
  const webInsets = Platform.OS === 'web';

  const pasteFromClipboard = async () => {
    setClipboardBusy(true);
    try {
      const value = await Clipboard.getStringAsync();
      if (!value.trim()) {
        notify('Буфер обмена пуст', 'Скопируй VPN-ссылку и попробуй ещё раз.');
      } else {
        setInput((current) => (current ? `${current}\n${value.trim()}` : value.trim()));
      }
    } catch {
      notify('Не удалось вставить', 'Вставь ссылку в поле вручную.');
    } finally {
      setClipboardBusy(false);
    }
  };

  const importProfiles = async () => {
    setImporting(true);
    try {
      const parsed = await parseProfiles(input);
      const count = await addProfiles(parsed);
      setInput('');
      setModalVisible(false);
      notify(
        count ? 'Профили добавлены' : 'Профили уже есть',
        count
          ? `Сохранено профилей: ${count}. Ключи останутся в защищённом хранилище устройства.`
          : 'Эти ссылки уже сохранены.',
      );
    } catch (error) {
      notify(
        'Не удалось добавить профиль',
        error instanceof Error ? error.message : 'Проверь ссылку и попробуй ещё раз.',
      );
    } finally {
      setImporting(false);
    }
  };

  const confirmDelete = (profile: VPNProfile) => {
    const remove = async () => {
      try {
        await removeProfile(profile.id);
      } catch {
        notify('Ошибка', 'Не удалось удалить профиль. Попробуй ещё раз.');
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Удалить профиль «${profile.name}»?`)) void remove();
      return;
    }
    Alert.alert('Удалить профиль?', profile.name, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => void remove() },
    ]);
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
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>ТВОИ ПОДКЛЮЧЕНИЯ</Text>
            <Text style={[styles.title, { color: colors.foreground }]}>Серверы</Text>
          </View>
          <Pressable
            onPress={() => setModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Добавить VPN-профиль"
            testID="open-import"
            style={({ pressed }) => [
              styles.addButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Ionicons name="add" size={23} color={colors.primaryForeground} />
          </Pressable>
        </View>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Импортируй конфиг или подписку — профили с ключами останутся на этом устройстве.
        </Text>

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
            СОХРАНЁННЫЕ ПРОФИЛИ
          </Text>
          <View style={[styles.countBadge, { backgroundColor: colors.secondary }]}>
            <Text style={[styles.countText, { color: colors.foreground }]}>
              {profiles.length}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={[styles.loadingBox, { backgroundColor: colors.card }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
              Загружаем профили
            </Text>
          </View>
        ) : profiles.length ? (
          <View style={styles.list}>
            {profiles.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                active={selectedId === profile.id}
                onSelect={() => void selectProfile(profile.id)}
                onDelete={() => confirmDelete(profile)}
              />
            ))}
          </View>
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <LinearGradient
              colors={['rgba(64,224,192,0.13)', 'rgba(64,224,192,0.02)']}
              style={styles.emptyIcon}
            >
              <MaterialCommunityIcons
                name="link-variant"
                size={25}
                color={colors.primary}
              />
            </LinearGradient>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Пока пусто
            </Text>
            <Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}>
              Вставь ссылку из VPN-клиента или добавь подписку, чтобы собрать профили здесь.
            </Text>
            <Pressable
              onPress={() => setModalVisible(true)}
              accessibilityRole="button"
              testID="empty-add-profile"
              style={({ pressed }) => [
                styles.emptyButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 },
              ]}
            >
              <Ionicons name="add" size={18} color={colors.primaryForeground} />
              <Text style={[styles.emptyButtonText, { color: colors.primaryForeground }]}>
                Добавить профиль
              </Text>
            </Pressable>
          </View>
        )}

        <View style={[styles.supportedBox, { borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle-outline" size={17} color={colors.primary} />
          <Text style={[styles.supportedText, { color: colors.mutedForeground }]}>
            Поддерживаются VLESS, VMess, Trojan, Shadowsocks и текстовые подписки.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={() => setModalVisible(false)}
            accessibilityLabel="Закрыть окно импорта"
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 22),
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                  Добавить профиль
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
                  Вставь конфиг или ссылку на подписку
                </Text>
              </View>
              <Pressable
                onPress={() => setModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Закрыть"
                hitSlop={10}
              >
                <Ionicons name="close" size={23} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <TextInput
              value={input}
              onChangeText={setInput}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="vless://… или ссылка подписки"
              placeholderTextColor={colors.mutedForeground}
              accessibilityLabel="VPN-ссылка или конфигурация"
              testID="profile-input"
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              textAlignVertical="top"
            />
            <Pressable
              onPress={() => void pasteFromClipboard()}
              disabled={clipboardBusy}
              accessibilityRole="button"
              testID="paste-profile"
              style={({ pressed }) => [
                styles.pasteButton,
                { borderColor: colors.border, opacity: pressed || clipboardBusy ? 0.65 : 1 },
              ]}
            >
              {clipboardBusy ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Ionicons name="clipboard-outline" size={18} color={colors.primary} />
              )}
              <Text style={[styles.pasteText, { color: colors.foreground }]}>
                Вставить из буфера
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void importProfiles()}
              disabled={importing || !input.trim()}
              accessibilityRole="button"
              testID="import-profile"
              style={({ pressed }) => [
                styles.importButton,
                {
                  backgroundColor: colors.primary,
                  opacity: importing || !input.trim() ? 0.48 : pressed ? 0.82 : 1,
                },
              ]}
            >
              {importing ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Ionicons name="arrow-down-circle-outline" size={20} color={colors.primaryForeground} />
              )}
              <Text style={[styles.importButtonText, { color: colors.primaryForeground }]}>
                {importing ? 'Импортируем…' : 'Сохранить профили'}
              </Text>
            </Pressable>
            <Text style={[styles.securityHint, { color: colors.mutedForeground }]}>
              Ключи не отправляются на сервер и сохраняются в защищённом хранилище устройства.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 22 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.7, marginBottom: 9 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -0.7 },
  subtitle: { fontSize: 13, lineHeight: 20, marginTop: 10, maxWidth: 325 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    marginTop: 31,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  countBadge: { minWidth: 27, height: 25, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  countText: { fontSize: 11, fontWeight: '700' },
  list: { gap: 10 },
  profileRow: {
    minHeight: 95,
    borderWidth: 1,
    borderRadius: 19,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  protocolBadge: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  profileDetails: { flex: 1, minWidth: 0, gap: 4 },
  profileNameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  profileName: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  profileHost: { fontSize: 11 },
  protocolChip: { alignSelf: 'flex-start', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 6, marginTop: 2 },
  protocolText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  deleteButton: { padding: 6 },
  loadingBox: { height: 150, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 12 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 23,
    alignItems: 'center',
    paddingHorizontal: 25,
    paddingVertical: 32,
    marginTop: 3,
  },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 17, overflow: 'hidden' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyDescription: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, maxWidth: 270 },
  emptyButton: { height: 44, borderRadius: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 20 },
  emptyButtonText: { fontSize: 12, fontWeight: '700' },
  supportedBox: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderTopWidth: 1, paddingTop: 16, marginTop: 22 },
  supportedText: { flex: 1, fontSize: 11, lineHeight: 16 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.64)',
  },
  sheet: { borderTopLeftRadius: 27, borderTopRightRadius: 27, borderTopWidth: 1, paddingHorizontal: 22, paddingTop: 12 },
  sheetHandle: { width: 38, height: 4, borderRadius: 4, alignSelf: 'center', marginBottom: 21 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 18 },
  sheetTitle: { fontSize: 21, fontWeight: '700' },
  sheetSubtitle: { fontSize: 12, marginTop: 5 },
  input: { minHeight: 142, maxHeight: 220, borderWidth: 1, borderRadius: 15, padding: 13, fontSize: 12, lineHeight: 18 },
  pasteButton: { height: 46, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 11 },
  pasteText: { fontSize: 12, fontWeight: '600' },
  importButton: { height: 51, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 11 },
  importButtonText: { fontSize: 13, fontWeight: '700' },
  securityHint: { fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 12 },
});
