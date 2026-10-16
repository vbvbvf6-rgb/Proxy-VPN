import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { VPNProfile } from '@/lib/profiles';
import { createProfile } from '@/lib/profiles';

const METADATA_KEY = 'nexa-vpn-profile-metadata-v1';
const SELECTED_PROFILE_KEY = 'nexa-vpn-selected-profile-v1';
const SECRET_KEY_PREFIX = 'nexa-vpn-profile-secret-';

type ProfileDraft = Omit<VPNProfile, 'id' | 'addedAt'>;

interface ProfileContextValue {
  profiles: VPNProfile[];
  selectedId: string | null;
  selectedProfile: VPNProfile | null;
  loading: boolean;
  addProfiles: (drafts: ProfileDraft[]) => Promise<number>;
  selectProfile: (id: string) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  clearProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<VPNProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadProfiles() {
      try {
        const [metadataValue, selectedValue] = await Promise.all([
          AsyncStorage.getItem(METADATA_KEY),
          AsyncStorage.getItem(SELECTED_PROFILE_KEY),
        ]);
        const metadata = metadataValue
          ? (JSON.parse(metadataValue) as Array<Omit<VPNProfile, 'raw'>>)
          : [];
        const restored = await Promise.all(
          metadata.map(async (item) => {
            const raw = await SecureStore.getItemAsync(
              `${SECRET_KEY_PREFIX}${item.id}`,
            );
            return raw ? ({ ...item, raw } as VPNProfile) : null;
          }),
        );
        const usable = restored.filter(
          (item): item is VPNProfile => item !== null,
        );
        if (!active) return;
        setProfiles(usable);
        setSelectedId(
          selectedValue && usable.some((item) => item.id === selectedValue)
            ? selectedValue
            : (usable[0]?.id ?? null),
        );
      } catch {
        if (active) {
          setProfiles([]);
          setSelectedId(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfiles();
    return () => {
      active = false;
    };
  }, []);

  const persistMetadata = useCallback(async (next: VPNProfile[]) => {
    const metadata = next.map(({ raw: _raw, ...item }) => item);
    await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  }, []);

  const addProfiles = useCallback(
    async (drafts: ProfileDraft[]) => {
      const existing = new Set(profiles.map((profile) => profile.raw));
      const newProfiles = drafts
        .filter((draft) => !existing.has(draft.raw))
        .map(createProfile);
      if (newProfiles.length === 0) return 0;

      try {
        await Promise.all(
          newProfiles.map((profile) =>
            SecureStore.setItemAsync(
              `${SECRET_KEY_PREFIX}${profile.id}`,
              profile.raw,
            ),
          ),
        );
        const next = [...profiles, ...newProfiles];
        await persistMetadata(next);
        setProfiles(next);
        if (!selectedId) {
          setSelectedId(newProfiles[0].id);
          await AsyncStorage.setItem(
            SELECTED_PROFILE_KEY,
            newProfiles[0].id,
          );
        }
        return newProfiles.length;
      } catch {
        await Promise.all(
          newProfiles.map((profile) =>
            SecureStore.deleteItemAsync(`${SECRET_KEY_PREFIX}${profile.id}`),
          ),
        );
        throw new Error(
          'Не удалось безопасно сохранить профиль. Возможно, ссылка слишком длинная.',
        );
      }
    },
    [persistMetadata, profiles, selectedId],
  );

  const selectProfile = useCallback(async (id: string) => {
    setSelectedId(id);
    await AsyncStorage.setItem(SELECTED_PROFILE_KEY, id);
  }, []);

  const removeProfile = useCallback(
    async (id: string) => {
      const next = profiles.filter((profile) => profile.id !== id);
      await SecureStore.deleteItemAsync(`${SECRET_KEY_PREFIX}${id}`);
      await persistMetadata(next);
      setProfiles(next);
      if (selectedId === id) {
        const nextId = next[0]?.id ?? null;
        setSelectedId(nextId);
        if (nextId) {
          await AsyncStorage.setItem(SELECTED_PROFILE_KEY, nextId);
        } else {
          await AsyncStorage.removeItem(SELECTED_PROFILE_KEY);
        }
      }
    },
    [persistMetadata, profiles, selectedId],
  );

  const clearProfiles = useCallback(async () => {
    await Promise.all(
      profiles.map((profile) =>
        SecureStore.deleteItemAsync(`${SECRET_KEY_PREFIX}${profile.id}`),
      ),
    );
    await AsyncStorage.multiRemove([METADATA_KEY, SELECTED_PROFILE_KEY]);
    setProfiles([]);
    setSelectedId(null);
  }, [profiles]);

  const selectedProfile =
    profiles.find((profile) => profile.id === selectedId) ?? null;
  const value = useMemo(
    () => ({
      profiles,
      selectedId,
      selectedProfile,
      loading,
      addProfiles,
      selectProfile,
      removeProfile,
      clearProfiles,
    }),
    [
      profiles,
      selectedId,
      selectedProfile,
      loading,
      addProfiles,
      selectProfile,
      removeProfile,
      clearProfiles,
    ],
  );

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfiles() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfiles must be used inside ProfileProvider');
  }
  return context;
}
