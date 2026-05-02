import { useCallback, useEffect, useState } from 'react';
import type { ApiDataSource, ServiceResult } from '../types/staff';

interface UseAsyncResourceOptions<T> {
  loader: () => Promise<ServiceResult<T>>;
  enabled?: boolean;
  initialData: T;
  deps: ReadonlyArray<unknown>;
}

export function useAsyncResource<T>({
  loader,
  enabled = true,
  initialData,
  deps,
}: UseAsyncResourceOptions<T>) {
  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');
  const [source, setSource] = useState<ApiDataSource>('live');

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await loader();
      setData(response.data);
      setSource(response.source);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  }, [enabled, loader]);

  useEffect(() => {
    void load();
  }, [load, ...deps]);

  return {
    data,
    setData,
    loading,
    error,
    source,
    reload: load,
  };
}
