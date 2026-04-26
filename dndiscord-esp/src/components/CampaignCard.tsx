import { Users, Crown } from "lucide-solid";
import { Show } from "solid-js";
import { Campaign, getStatusColor, getStatusLabel } from "../types/campaign";
import { displayDungeonMasterName } from "../services/campaign.service";
import { authStore } from "../stores/auth.store";
import { t } from "../i18n";

/**
 * Campaign card — minimalist, shows only backend-persisted fields.
 */
export default function CampaignCard(props: {
  campaign: Campaign;
  onClick: () => void;
}) {
  const campaign = () => props.campaign;

  return (
    <button
      onClick={props.onClick}
      aria-label={`Open campaign: ${campaign().title}`}
      class="campaign-card group relative bg-ink-700 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-xl motion-safe:hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-purple-500/10 hover:border-purple-500/40 transition-all text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
    >
      <div class="h-28 bg-gradient-to-br from-purple-800/50 via-indigo-800/40 to-violet-800/50 relative">
        <div
          class="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.08%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')]"
          style="opacity: 0.5"
          aria-hidden="true"
        />
        <div class="absolute top-3 right-3">
          <span
            class={`px-2.5 py-1 text-xs font-medium rounded-lg border backdrop-blur-sm ${getStatusColor(campaign().status)}`}
            aria-label={`Status: ${getStatusLabel(campaign().status)}`}
          >
            {getStatusLabel(campaign().status)}
          </span>
        </div>
        <div
          class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-ink-700 to-transparent"
          aria-hidden="true"
        />
      </div>

      <div class="p-5 pt-2">
        <h3 class="font-display text-lg text-white group-hover:text-purple-300 transition-colors mb-2 line-clamp-1">
          {campaign().title}
        </h3>

        <Show when={campaign().description}>
          <p class="text-sm text-slate-400 line-clamp-2 mb-3 min-h-[2.5rem]">
            {campaign().description}
          </p>
        </Show>

        <div class="flex items-center gap-3 text-sm text-slate-300 mb-3">
          <div class="flex items-center gap-1.5">
            <Users class="w-4 h-4 text-slate-400" aria-hidden="true" />
            <span
              aria-label={`${campaign().currentPlayers} players out of ${campaign().maxPlayers}`}
            >
              {campaign().currentPlayers}/{campaign().maxPlayers}
            </span>
          </div>
        </div>

        <div class="pt-3 border-t border-white/10 flex items-center gap-2">
          <Crown class="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span class="text-sm text-slate-500 sr-only">{t("campaign.card.dm")}</span>
          <span class="text-sm text-slate-500" aria-hidden="true">
            {t("campaign.card.dmAbbr")}
          </span>
          <span class="text-sm text-white font-medium">
            {displayDungeonMasterName(campaign(), authStore.user()?.username)}
          </span>
        </div>
      </div>

      <div
        class="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        aria-hidden="true"
      />
    </button>
  );
}
