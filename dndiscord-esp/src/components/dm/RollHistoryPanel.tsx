import { createSignal, createEffect, onMount, For, Show } from "solid-js";
import { sessionState } from "../../stores/session.store";
import { diceRequestsState } from "../../stores/diceRequests.store";
import { getApiUrl } from "../../services/config";

interface RollHistoryEntry {
  id: string;
  requestId: string;
  userId: string;
  userName: string | null;
  diceType: "d20";
  value: number;
  label: string | null;
  rolledAt: string; // ISO date from server
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function RollHistoryPanel() {
  const [rolls, setRolls] = createSignal<RollHistoryEntry[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const campaignId = () => sessionState.session?.campaignId ?? null;

  async function fetchHistory(): Promise<void> {
    const cid = campaignId();
    if (!cid) {
      setRolls([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const apiBase = getApiUrl();
      const res = await fetch(
        `${apiBase}/api/campaigns/${cid}/rolls?limit=50`,
        { headers: authHeaders() },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RollHistoryEntry[];
      setRolls(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => {
    void fetchHistory();
  });

  // Live update: re-fetch when new roll results land in the store.
  // Tracking total result count across all requests detects new RollResultBroadcast
  // events without adding a dedicated SignalR subscription. For POC scope this
  // refetch-on-change approach keeps the panel in sync with server ordering.
  let lastSeen = 0;
  createEffect(() => {
    const total = Object.values(diceRequestsState).reduce(
      (acc, r) => acc + Object.keys(r.results).length,
      0,
    );
    if (total > lastSeen) {
      lastSeen = total;
      void fetchHistory();
    }
  });

  return (
    <div class="mt-2 space-y-1.5">
      <Show when={loading()}>
        <p class="text-[10px] text-purple-300/50 text-center py-2">Loading…</p>
      </Show>
      <Show when={error()}>
        <p class="text-rose-400 text-xs">{error()}</p>
      </Show>
      <Show when={!loading() && !error() && rolls().length === 0}>
        <p class="text-[10px] text-purple-300/50 text-center py-2">
          Aucun jet pour le moment.
        </p>
      </Show>
      <div class="space-y-0.5 max-h-64 overflow-y-auto">
        <For each={rolls()}>
          {(r) => {
            const tone =
              r.value === 20
                ? "text-amber-300"
                : r.value === 1
                  ? "text-rose-400"
                  : "text-purple-100";
            const time = new Date(r.rolledAt).toLocaleTimeString();
            return (
              <div class="flex items-center gap-2 text-[10px] bg-purple-500/5 rounded-lg px-2 py-1 border border-purple-500/15">
                <span class="text-purple-300/60 font-mono">{time}</span>
                <span class="flex-1 truncate">
                  {r.userName ?? r.userId.slice(0, 8)}
                </span>
                <span class={`font-bold tabular-nums ${tone}`}>{r.value}</span>
                <Show when={r.label}>
                  <span class="text-purple-400/40 truncate max-w-[60px]">
                    {r.label}
                  </span>
                </Show>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}
