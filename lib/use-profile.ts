import { useState, useEffect, useCallback } from 'react';
import { getProfile, upsertProfile, deleteProfile } from './api';
import type { UserProfile, UpsertProfileRequest } from './types';

type State = {
  profile: UserProfile | null;
  loading: boolean;
  saving: boolean;
};

export function useProfile(skip = false) {
  const [state, setState] = useState<State>({ profile: null, loading: !skip, saving: false });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const res = await getProfile();
    if (res.status === 204 || !res.data) {
      setState({ profile: null, loading: false, saving: false });
    } else if (res.data) {
      setState({ profile: res.data, loading: false, saving: false });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    if (!skip) load();
  }, [skip, load]);

  const save = useCallback(async (req: UpsertProfileRequest): Promise<boolean> => {
    setState((s) => ({ ...s, saving: true }));
    const res = await upsertProfile(req);
    if (res.data) {
      setState({ profile: res.data, loading: false, saving: false });
      return true;
    }
    setState((s) => ({ ...s, saving: false }));
    return false;
  }, []);

  const remove = useCallback(async (): Promise<boolean> => {
    setState((s) => ({ ...s, saving: true }));
    const res = await deleteProfile();
    if (res.status === 204 || !res.error) {
      setState({ profile: null, loading: false, saving: false });
      return true;
    }
    setState((s) => ({ ...s, saving: false }));
    return false;
  }, []);

  return { ...state, save, remove, reload: load };
}
