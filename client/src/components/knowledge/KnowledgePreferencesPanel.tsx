import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, LoaderCircle, Sparkles } from "lucide-react";
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
    return <div className="h-24 animate-pulse rounded-2xl border border-[#e6d8c8] bg-[#f5efe6]" aria-label="Loading knowledge preferences" />;
  }

  if (!preferences) {
    return (
      <div className="rounded-2xl border border-[#e8c9bd] bg-[#fff8f3] p-4 text-sm text-[#6c4738]">
        <div className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{error}</div>
        <button className="mt-2 underline underline-offset-2" onClick={() => setReloadKey((key) => key + 1)}>Reload preferences</button>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[#e6d8c8] bg-[#fffdf9] p-4 md:p-5" aria-labelledby="knowledge-preferences-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e9eee5] text-[#526650]">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 id="knowledge-preferences-title" className="font-semibold text-[#263d57]">Your library, understood</h2>
          </div>
        </div>
        {saving && <LoaderCircle className="h-4 w-4 animate-spin text-[#526650]" aria-label="Saving preference" />}
      </div>
      {!preferences.available && <p className="mt-3 text-xs text-[#7c6954]">Library answers aren’t currently available for this account.</p>}
      <div className="mt-4 border-t border-[#eee6dc] pt-4">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-[#f7f4ec] px-3 py-3">
          <span>
            <span className="block text-sm font-medium text-[#263d57]">Include photos</span>
            <span className="mt-0.5 block text-xs text-[#64717b]">Let OpenAI read text and details in saved photos.</span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#526650]"
            checked={preferences.photoEnabled}
            disabled={saving}
            onChange={(event) => update({ enabled: preferences.enabled, photoEnabled: event.target.checked })}
            aria-label="Include photos"
            aria-describedby="photo-reading-limit"
          />
        </label>
        <p id="photo-reading-limit" className="mt-2 text-[11px] leading-relaxed text-[#7c847e]">Private, paywalled and blocked pages may not be readable.</p>
      </div>
      {error && <p className="mt-3 flex items-center gap-2 text-xs text-[#9b4934]" role="alert"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
      {preferences.enabled && <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#637566]"><Check className="h-3.5 w-3.5" />You can change this preference any time.</p>}
    </section>
  );
}
