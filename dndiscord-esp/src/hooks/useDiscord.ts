import { createSignal, onMount } from 'solid-js';
import { getDiscordSDK, getCurrentDiscordUser, isDiscordSDKReady } from '../services/discord';

/**
 * Hook SolidJS pour utiliser le SDK Discord dans les composants
 * @returns {Object} - État et méthodes du SDK Discord
 */
export function useDiscord() {
  const [isReady, setIsReady] = createSignal(false);
  const [user, setUser] = createSignal<any>(null);
  const [sdk, setSdk] = createSignal<any>(null);

  onMount(() => {
    if (isDiscordSDKReady()) {
      setIsReady(true);
      const discordSdk = getDiscordSDK();
      const currentUser = getCurrentDiscordUser();
      
      setSdk(discordSdk);
      setUser(currentUser);
    }
  });

  return {
    isReady,
    user,
    sdk,
  };
}

