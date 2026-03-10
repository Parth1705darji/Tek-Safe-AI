import { useState, useCallback } from 'react';
import type { BreachCheckResult, UrlScanResult, IpCheckResult } from '../types';

type ToolError = { error: string };

export function useTools() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callTool = useCallback(
    async <T>(endpoint: string, body: Record<string, string>): Promise<T | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/tools/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = (await res.json()) as T | ToolError;

        if (!res.ok) {
          const message =
            (data as ToolError).error ??
            (res.status === 429
              ? "We're checking too many requests right now. Please try again in a minute."
              : res.status === 408
              ? 'The scan is taking longer than expected. Please try again.'
              : 'Something went wrong. Please try again.');
          setError(message);
          return null;
        }

        return data as T;
      } catch {
        setError('Unable to connect to the scanning service. Check your internet connection.');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const checkBreach = useCallback(
    (email: string) => callTool<BreachCheckResult>('breach-check', { email }),
    [callTool]
  );

  const scanUrl = useCallback(
    (url: string) => callTool<UrlScanResult>('url-scan', { url }),
    [callTool]
  );

  const checkIp = useCallback(
    (ip: string) => callTool<IpCheckResult>('ip-check', { ip }),
    [callTool]
  );

  return { checkBreach, scanUrl, checkIp, isLoading, error };
}
