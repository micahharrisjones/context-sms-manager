import { useEffect, useRef, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { KnowledgePreferences } from "@shared/knowledge";

interface KnowledgePreferencesPanelProps {
  onSettingsChange: (preferences: KnowledgePreferences) => void;
}

export function KnowledgePreferencesPanel({ onSettingsChange }: KnowledgePreferencesPanelProps) {
  const onSettingsChangeRef = useRef(onSettingsChange);
  onSettingsChangeRef.current = onSettingsChange;
  const [preferences, setPreferences] = useState<KnowledgePreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const refresh = () => setReloadKey(key => key + 1);
    window.addEventListener("aside-knowledge-settings-changed", refresh);
    return () => window.removeEventListener("aside-knowledge-settings-changed", refresh);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    apiRequest("/api/knowledge/settings", { signal: controller.signal })
      .then((response) => response.json() as Promise<KnowledgePreferences>)
      .then((value) => {
        setPreferences(value);
        onSettingsChangeRef.current(value);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError("Preferences could not be loaded. Try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  async function update(next: { enabled: boolean; photoEnabled: boolean }) {
    if (!preferences || saving) return;
    const optimistic = { ...preferences, ...next };
    setPreferences(optimistic);
    onSettingsChange(optimistic);
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/knowledge/settings", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      try {
        const response = await apiRequest("/api/knowledge/settings");
        const updated = await response.json() as KnowledgePreferences;
        setPreferences(updated);
        onSettingsChange(updated);
      } catch {
        // The PUT succeeded; retain its known values if the confirming read is unavailable.
      }
    } catch {
      setPreferences(preferences);
      onSettingsChange(preferences);
      setError("Your preference wasn't saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-9 items-center gap-2 text-xs text-[#64717b]" role="status"><LoaderCircle className="h-3.5 w-3.5 animate-spin" />Loading photo preference…</div>;
  }

  if (!preferences) {
    return (
      <div className="text-xs text-[#6c4738]">
        <div className="flex items-center gap-2" role="alert"><AlertCircle className="h-4 w-4" />{error}</div>
        <button type="button" className="mt-2 min-h-9 underline underline-offset-2" onClick={() => setReloadKey((key) => key + 1)}>Reload preferences</button>
      </div>
    );
  }

  return (
    <div role="group" aria-label="Photo preferences">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 text-sm font-medium text-[#263d57]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#526650] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#526650]"
            checked={preferences.photoEnabled}
            disabled={saving}
            onChange={(event) => update({ enabled: preferences.enabled, photoEnabled: event.target.checked })}
            aria-label="Include photos"
            aria-describedby="photo-analysis-description"
          />
          Include photos
        </label>
        {saving && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#526650]" aria-label="Saving preference" />}
        <span id="photo-analysis-description" className="text-[11px] text-[#64717b]">Allow OpenAI to analyze saved photos. This preference applies across your library, not just this search.</span>
      </div>
      {!preferences.available && <p className="mt-1 text-xs text-[#7c6954]">Library answers aren’t currently available for this account.</p>}
      {error && <p className="mt-1 flex items-center gap-2 text-xs text-[#9b4934]" role="alert"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
    </div>
  );
}
