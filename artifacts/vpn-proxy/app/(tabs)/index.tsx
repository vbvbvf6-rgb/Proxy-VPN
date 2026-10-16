import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { getProtocolLabel, type VPNProfile } from '@/lib/profiles';
import { useProfiles } from '@/contexts/ProfileContext';
import { useVpn } from '@/contexts/VpnContext';

const countryCodes: Array<[string, string]> = [
  ['netherlands|nederland|нидерланд', 'NL'],
  ['germany|deutschland|герман', 'DE'],
  ['finland|suomi|финлянд', 'FI'],
  ['poland|polska|польш', 'PL'],
  ['russia|росси', 'RU'],
  ['austria|österreich|австри', 'AT'],
  ['france|france|франц', 'FR'],
];

function getServerCode(name: string): string {
  const normalized = name.toLowerCase();
  return (
    countryCodes.find(([pattern]) => new RegExp(pattern, 'i').test(normalized))?.[1] ??
    'VPN'
  );
}

function getServerDescription(profile: VPNProfile): string {
  if (profile.protocol === 'xray-json') return 'XRAY / JSON';
  let network = '';
  let security = '';
  try {
    if (profile.raw.startsWith('{') || profile.raw.startsWith('[')) {
      const config = JSON.parse(profile.raw) as {
        outbounds?: Array<{
          protocol?: string;
          streamSettings?: { network?: string; security?: string };
        }>;
      };
      const outbound = config.outbounds?.[0];
      network = outbound?.streamSettings?.network ?? '';
      security = outbound?.streamSettings?.security ?? '';
    } else {
      const url = new URL(profile.raw);
      network = url.searchParams.get('type') ?? url.searchParams.get('network') ?? '';
      security = url.searchParams.get('security') ?? '';
    }
  } catch {
    // Keep the protocol label if the optional transport details are absent.
  }

  const details = [
    getProtocolLabel(profile.protocol),
    network,
    security,
  ]
    .filter(Boolean)
    .map((value) => value.toUpperCase());
  return details.join(' / ');
}

function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function ServerRow({
  profile,
  active,
  onPress,
}: {
  profile: VPNProfile;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Выбрать сервер ${profile.name}`}
      testID={`home-server-${profile.id}`}
      style={({ pressed }) => [
        styles.serverRow,
        {
          backgroundColor: active ? colors.secondary : colors.card,
          borderColor: active ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.countryBadge,
          { backgroundColor: active ? colors.accent : colors.secondary },
        ]}
      >
        <Text style={[styles.countryCode, { color: colors.primary }]}>
          {getServerCode(profile.name)}
        </Text>
      </View>
      <View style={styles.serverCopy}>
        <Text
          numberOfLines={1}
          style={[styles.serverName, { color: colors.foreground }]}
        >
          {profile.name}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.serverSubline, { color: colors.mutedForeground }]}
        >
          {getServerDescription(profile)}
        </Text>
      </View>
      {active ? (
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
      ) : (
        <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

export default function ConnectionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profiles, selectedProfile, selectProfile } = useProfiles();
  const { state, nativeAvailability, connect, disconnect } = useVpn();
  const webInsets = Platform.OS === 'web';
  const connected = state.state === 'connected';
  const busy =
    state.state === 'preparing' ||
    state.state === 'connecting' ||
    state.state === 'disconnecting';

  const toggleConnection = async () => {
    if (!selectedProfile) {
      router.push('/profiles');
      return;
    }
    try {
      if (connected) {
        await disconnect();
      } else {
        await connect(selectedProfile);
      }
    } catch (error) {
      showMessage(
        'Не удалось подключиться',
        error instanceof Error ? error.message : 'Проверь настройки профиля и попробуй ещё раз.',
      );
    }
  };

  const statusLabel = connected
    ? 'ПОДКЛЮЧЕНО'
    : busy
      ? 'ПОДКЛЮЧАЕМСЯ'
      : state.state === 'error'
        ? 'ОШИБКА'
        : 'НЕ ПОДКЛЮЧЕНО';
  const statusText = connected
    ? 'Защищённое соединение активно'
    : busy
      ? 'Запускаем VPN-туннель…'
      : state.state === 'error'
        ? (state.error ?? 'Не удалось запустить VPN')
        : 'Нажмите для подключения';

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: webInsets ? Math.max(insets.top, 67) : 12,
            paddingBottom: webInsets ? 124 : 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <View style={[styles.brandMark, { backgroundColor: colors.accent }]}>
              <MaterialCommunityIcons
                name="shield-lock"
                size={20}
                color={colors.primary}
              />
            </View>
            <View>
              <Text style={[styles.brandName, { color: colors.foreground }]}>
                NEXA
              </Text>
              <Text style={[styles.brandCaption, { color: colors.mutedForeground }]}>
                VPN · X-RAY CORE
              </Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Настройки"
              testID="home-settings"
              style={({ pressed }) => [
                styles.headerButton,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="settings-outline" size={19} color={colors.foreground} />
            </Pressable>
            <Pressable
              onPress={() => router.push('/profiles')}
              accessibilityRole="button"
              accessibilityLabel="Добавить сервер"
              testID="home-add-server"
              style={({ pressed }) => [
                styles.headerButton,
                { borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="add" size={25} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroStatus}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: connected
                    ? colors.primary
                    : state.state === 'error'
                      ? colors.destructive
                      : colors.mutedForeground,
                },
              ]}
            />
            <Text style={[styles.heroEyebrow, { color: colors.mutedForeground }]}>
              {statusLabel}
            </Text>
          </View>
          <View style={styles.orbitWrap}>
            <View
              style={[
                styles.orbitOuter,
                { borderColor: connected ? colors.primary : colors.border },
              ]}
            />
            <View
              style={[
                styles.orbitInner,
                { borderColor: connected ? colors.accentForeground : colors.secondary },
              ]}
            />
            <Pressable
              onPress={() => void toggleConnection()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={connected ? 'Отключить VPN' : 'Подключить VPN'}
              testID="vpn-connect-button"
              style={({ pressed }) => [
                styles.connectOrb,
                pressed && !busy && styles.pressed,
                busy && styles.busyOrb,
              ]}
            >
              <LinearGradient
                colors={
                  connected
                    ? ['#11617b', '#0d344f', '#0b223a']
                    : ['#142e49', '#0d2037', '#0a1a2e']
                }
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={[
                  styles.orbGradient,
                  { borderColor: connected ? colors.primary : colors.border },
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={connected ? 'power' : 'power-outline'}
                    size={61}
                    color={connected ? colors.primary : colors.foreground}
                  />
                )}
              </LinearGradient>
            </Pressable>
            <View
              style={[
                styles.orbitSpark,
                { backgroundColor: connected ? colors.primary : colors.accentForeground },
              ]}
            />
          </View>
          <Text style={[styles.statusText, { color: colors.foreground }]}>
            {statusText}
          </Text>
        </View>

        <View style={styles.providerHeading}>
          <Text style={[styles.sectionEyebrow, { color: colors.mutedForeground }]}>
            ТЕКУЩИЙ ПРОФИЛЬ
          </Text>
          <Pressable
            onPress={() => router.push('/profiles')}
            accessibilityRole="button"
            testID="manage-profiles"
          >
            <Text style={[styles.manageText, { color: colors.primary }]}>
              Все серверы
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/profiles')}
          accessibilityRole="button"
          testID="selected-profile-card"
          style={({ pressed }) => [
            styles.providerCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          <View style={styles.providerTop}>
            <View style={[styles.providerIcon, { backgroundColor: colors.accent }]}>
              <Ionicons name="globe-outline" size={19} color={colors.primary} />
            </View>
            <View style={styles.providerCopy}>
              <Text
                numberOfLines={1}
                style={[styles.providerName, { color: colors.foreground }]}
              >
                {selectedProfile?.name ?? 'Профиль не выбран'}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.providerMeta, { color: colors.mutedForeground }]}
              >
                {selectedProfile
                  ? `${getProtocolLabel(selectedProfile.protocol)} · ${selectedProfile.host}${selectedProfile.port ? `:${selectedProfile.port}` : ''}`
                  : profiles.length
                    ? 'Выбери сервер из списка'
                    : 'Добавь ссылку или подписку'}
              </Text>
            </View>
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} />
          </View>
          <View style={[styles.providerFooter, { borderTopColor: colors.border }]}>
            <Ionicons
              name={connected ? 'shield-checkmark' : 'information-circle-outline'}
              size={16}
              color={connected ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.providerFooterText, { color: colors.mutedForeground }]}>
              {connected
                ? `Подключено: ${state.profileName ?? selectedProfile?.name ?? 'сервер'}`
                : 'Ключи хранятся только на устройстве'}
            </Text>
          </View>
        </Pressable>

        <View style={styles.serverHeading}>
          <View>
            <Text style={[styles.sectionEyebrow, { color: colors.mutedForeground }]}>
              ДОСТУПНЫЕ СЕРВЕРЫ
            </Text>
            <Text style={[styles.serverCount, { color: colors.foreground }]}>
              {profiles.length} {profiles.length === 1 ? 'сервер' : 'серверов'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/profiles')}
            accessibilityRole="button"
            accessibilityLabel="Импортировать сервер"
            testID="import-server"
            style={({ pressed }) => [
              styles.smallAdd,
              { backgroundColor: colors.secondary, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="add" size={20} color={colors.primary} />
          </Pressable>
        </View>

        {profiles.length ? (
          <View style={styles.serverList}>
            {profiles.map((profile) => (
              <ServerRow
                key={profile.id}
                profile={profile}
                active={profile.id === selectedProfile?.id}
                onPress={() => void selectProfile(profile.id)}
              />
            ))}
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/profiles')}
            accessibilityRole="button"
            testID="empty-add-profile"
            style={({ pressed }) => [
              styles.emptyServerCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
              <MaterialCommunityIcons name="link-variant" size={21} color={colors.primary} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Добавить VPN-сервер
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
                VLESS, VMess, Trojan, Shadowsocks или JSON
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}

        {nativeAvailability !== 'ready' && (
          <View style={[styles.nativeNotice, { backgroundColor: colors.secondary }]}>
            <Ionicons name="phone-portrait-outline" size={17} color={colors.primary} />
            <Text style={[styles.nativeNoticeText, { color: colors.mutedForeground }]}>
              {Platform.OS === 'web'
                ? 'Подключение к VPN доступно в Android APK; в предпросмотре работают импорт и управление профилями.'
                : 'Для туннеля нужен установленный Android APK с Xray-движком.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: {
    width: 37,
    height: 37,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { fontSize: 16, fontWeight: '800', letterSpacing: 2.1 },
  brandCaption: { fontSize: 8, fontWeight: '600', letterSpacing: 0.9, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 9 },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { alignItems: 'center', paddingTop: 10 },
  heroStatus: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  heroEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  orbitWrap: {
    height: 270,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 1,
  },
  orbitOuter: {
    position: 'absolute',
    width: 238,
    height: 238,
    borderWidth: 1,
    borderRadius: 119,
    opacity: 0.7,
  },
  orbitInner: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderWidth: 5,
    borderRadius: 100,
    opacity: 0.55,
  },
  connectOrb: { width: 156, height: 156, borderRadius: 78, padding: 1 },
  orbGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 78,
    borderWidth: 1,
  },
  orbitSpark: {
    position: 'absolute',
    right: '17%',
    top: 43,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  busyOrb: { opacity: 0.8 },
  statusText: { fontSize: 15, fontWeight: '500', marginBottom: 27 },
  providerHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.3 },
  manageText: { fontSize: 11, fontWeight: '600' },
  providerCard: { borderWidth: 1, borderRadius: 19, padding: 13, marginBottom: 22 },
  providerTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  providerIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  providerCopy: { flex: 1, minWidth: 0 },
  providerName: { fontSize: 14, fontWeight: '700' },
  providerMeta: { fontSize: 10, marginTop: 4 },
  providerFooter: { borderTopWidth: 1, marginTop: 12, paddingTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  providerFooterText: { flex: 1, fontSize: 10 },
  serverHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  serverCount: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  smallAdd: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  serverList: { gap: 7 },
  serverRow: { minHeight: 67, borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 11 },
  countryBadge: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  countryCode: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  serverCopy: { flex: 1, minWidth: 0, gap: 5 },
  serverName: { fontSize: 13, fontWeight: '700' },
  serverSubline: { fontSize: 9, fontWeight: '600', letterSpacing: 0.45 },
  emptyServerCard: { borderWidth: 1, borderRadius: 18, minHeight: 74, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 11 },
  emptyIcon: { width: 41, height: 41, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyCopy: { flex: 1 },
  emptyTitle: { fontSize: 12, fontWeight: '700' },
  emptySubtitle: { fontSize: 10, marginTop: 4 },
  nativeNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 14, padding: 12, marginTop: 18 },
  nativeNoticeText: { flex: 1, fontSize: 10, lineHeight: 15 },
});
