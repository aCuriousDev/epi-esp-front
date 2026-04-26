import { Show, createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { authStore } from "../../stores/auth.store";
import { AuthService } from "../../services/auth.service";
import { LogOut, ChevronDown, User } from "lucide-solid";

interface UserMenuProps {
  class?: string;
}

/**
 * User Menu - Shows avatar, username, and logout dropdown
 */
export default function UserMenu(props: UserMenuProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = createSignal(false);
  const [isLoggingOut, setIsLoggingOut] = createSignal(false);

  const user = () => authStore.user();
  
  const avatarUrl = () => {
    const u = user();
    return u ? AuthService.getAvatarUrl(u) : "";
  };

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await authStore.logout();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
      setIsOpen(false);
    }
  }

  function handleProfileClick() {
    setIsOpen(false);
    navigate("/profile");
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".user-menu-container")) {
      setIsOpen(false);
    }
  }

  // Close on click outside
  if (typeof document !== "undefined") {
    document.addEventListener("click", handleClickOutside);
  }

  return (
    <Show when={user()}>
      <div class={`user-menu-container relative ${props.class || ""}`}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen())}
          class="flex items-center gap-2 pl-1 pr-3 py-1 bg-ink-700 hover:bg-ink-600 rounded-full border border-white/10 hover:border-white/20 transition-all duration-ds-xs focus-ring-gold"
        >
          {/* Avatar */}
          <div class="w-7 h-7 rounded-full overflow-hidden border border-white/15 shrink-0 flex items-center justify-center"
               style={{ background: "linear-gradient(135deg, var(--plum-700), var(--arcindigo-700))" }}>
            <Show when={avatarUrl()} fallback={
              <span class="font-display font-bold text-[11px] text-gold-200">
                {(user()?.username ?? "??").slice(0, 2).toUpperCase()}
              </span>
            }>
              <img
                src={avatarUrl()}
                alt={user()?.username || "User"}
                class="w-full h-full object-cover"
              />
            </Show>
          </div>

          {/* Username */}
          <span class="text-high text-[13px] font-medium max-w-[120px] truncate">
            {user()?.username}
          </span>

          {/* Chevron */}
          <ChevronDown
            class={`w-4 h-4 text-mid transition-transform duration-200 ${isOpen() ? "rotate-180" : ""}`}
          />
        </button>

        {/* Dropdown Menu */}
        <Show when={isOpen()}>
          <div class="
            absolute right-0 top-full mt-2
            min-w-[200px] py-2
            bg-game-dark/95 backdrop-blur-sm
            border border-white/20 rounded-xl
            shadow-2xl shadow-black/50
            z-50
            animate-in fade-in slide-in-from-top-2
          ">
            {/* User Info Header */}
            <div class="px-4 py-3 border-b border-white/10">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-white/30">
                  <img 
                    src={avatarUrl()} 
                    alt={user()?.username || "User"}
                    class="w-full h-full object-cover"
                  />
                </div>
                <div class="flex flex-col">
                  <span class="text-white font-semibold">{user()?.username}</span>
                  <span class="text-white/50 text-xs truncate max-w-[140px]">
                    {user()?.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div class="py-1">
              <button
                onClick={handleProfileClick}
                class="
                  w-full flex items-center gap-3 px-4 py-2
                  text-slate-300 hover:bg-white/10 hover:text-white
                  transition-colors duration-150
                "
              >
                <User class="w-4 h-4" />
                <span>Mon Profil</span>
              </button>
              
              <button
                onClick={handleLogout}
                disabled={isLoggingOut()}
                class="
                  w-full flex items-center gap-3 px-4 py-2
                  text-red-400 hover:bg-red-500/10
                  transition-colors duration-150
                  disabled:opacity-50
                "
              >
                <LogOut class="w-4 h-4" />
                <span>{isLoggingOut() ? "Logging out..." : "Log out"}</span>
              </button>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

