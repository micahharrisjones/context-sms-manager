export interface LinkPreviewData {
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
  isBlocked?: boolean;
  isFallback?: boolean;
  url?: string;
  skip?: boolean;
  error?: string;
}

// Old posts can repeat a URL. Share in-flight requests and successful results
// across cards rather than consume the account's request budget per card.
const requests = new Map<string, { expires: number; promise: Promise<LinkPreviewData> }>();

export function fetchLinkPreview(url: string): Promise<LinkPreviewData> {
  const key = new URL(url).href;
  const cached = requests.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = fetch(`/api/og-preview?url=${encodeURIComponent(key)}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`Preview request failed (${response.status})`);
      const data: LinkPreviewData = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    }).catch((error) => {
      if (requests.get(key)?.promise === promise) requests.delete(key);
      throw error;
    });
  if (requests.size >= 200) requests.delete(requests.keys().next().value!);
  requests.set(key, { expires: Date.now() + 5 * 60_000, promise });
  return promise;
}

export function clearLinkPreviewCache() { requests.clear(); }
