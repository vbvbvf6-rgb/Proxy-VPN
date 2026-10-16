import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';
import type {
  ExpoXrayVpnState,
} from 'expo-xray-vpn';
import type { VPNProfile } from '@/lib/profiles';

type NativeVpnModule = typeof import('expo-xray-vpn')['default'];
type NativeAvailability = 'loading' | 'ready' | 'unavailable';

interface VpnContextValue {
  state: ExpoXrayVpnState;
  nativeAvailability: NativeAvailability;
  connect: (profile: VPNProfile) => Promise<void>;
  disconnect: () => Promise<void>;
}

const initialState: ExpoXrayVpnState = { state: 'disconnected' };
const VpnContext = createContext<VpnContextValue | null>(null);

export function VpnProvider({ children }: { children: ReactNode }) {
  const nativeModuleRef = useRef<NativeVpnModule | null>(null);
  const [state, setState] = useState<ExpoXrayVpnState>(initialState);
  const [nativeAvailability, setNativeAvailability] =
    useState<NativeAvailability>(
      Platform.OS === 'android' ? 'loading' : 'unavailable',
    );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let active = true;
    let stateSubscription: { remove: () => void } | undefined;

    async function loadNativeModule() {
      try {
        const nativeModule = await import('expo-xray-vpn');
        if (!active) return;
        nativeModuleRef.current = nativeModule.default;
        setNativeAvailability('ready');
        const currentState = await nativeModule.default.getState();
        if (active) setState(currentState);
        stateSubscription = nativeModule.default.addListener(
          'onStateChange',
          (nextState) => {
            if (active) setState(nextState);
          },
        );
      } catch {
        if (active) setNativeAvailability('unavailable');
      }
    }

    void loadNativeModule();
    return () => {
      active = false;
      stateSubscription?.remove();
    };
  }, []);

  const connect = useCallback(async (profile: VPNProfile) => {
    if (Platform.OS !== 'android') {
      throw new Error(
        'Настоящее VPN-подключение работает в Android APK, не в веб-предпросмотре.',
      );
    }
    const nativeModule = nativeModuleRef.current;
    if (!nativeModule) {
      throw new Error(
        'Сборка без Android VPN-модуля. Установи APK с нативным VPN-движком.',
      );
    }

    const raw = profile.raw.trim();
    let xrayConfigJson: string;
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        JSON.parse(raw);
        xrayConfigJson = raw;
      } catch {
        throw new Error('В сохранённом JSON-профиле есть ошибка.');
      }
    } else {
      xrayConfigJson =
        await nativeModule.convertShareLinksToXrayJson(profile.raw);
    }

    const permission = await nativeModule.requestPermission();
    if (!permission.granted) {
      throw new Error('Разрешение Android на VPN-подключение не выдано.');
    }

    const nextState = await nativeModule.connect({
      dnsServer: '1.1.1.1',
      mtu: 1500,
      profileId: profile.id,
      profileName: profile.name,
      xrayConfigJson,
    });
    setState(nextState);
  }, []);

  const disconnect = useCallback(async () => {
    const nativeModule = nativeModuleRef.current;
    if (!nativeModule) {
      throw new Error('Нативный Android VPN-модуль не загружен.');
    }
    const nextState = await nativeModule.disconnect();
    setState(nextState);
  }, []);

  const value = useMemo(
    () => ({ state, nativeAvailability, connect, disconnect }),
    [state, nativeAvailability, connect, disconnect],
  );

  return <VpnContext.Provider value={value}>{children}</VpnContext.Provider>;
}

export function useVpn() {
  const context = useContext(VpnContext);
  if (!context) throw new Error('useVpn must be used inside VpnProvider');
  return context;
}
