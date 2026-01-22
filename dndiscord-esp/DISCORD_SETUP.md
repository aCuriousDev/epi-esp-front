# Configuration Discord Activity

Ce guide explique comment configurer votre application en tant que Discord Activity.

## Étapes de configuration

### 1. Créer une application Discord

1. Allez sur https://discord.com/developers/applications
2. Cliquez sur "New Application"
3. Donnez un nom à votre application (ex: "DnDiscord")
4. Notez votre **Client ID** (visible dans "General Information")

### 2. Configurer l'Embedded App

1. Dans votre application Discord, allez dans **"Embedded App"** (dans le menu de gauche)
2. Activez **"Embedded App"**
3. Configurez les paramètres :
   - **App URL** : L'URL de votre application (en production ou ngrok pour le développement)
   - **App iframe** : `https://your-domain.com` (ou votre URL ngrok)

### 3. Configurer les variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
VITE_DISCORD_CLIENT_ID=votre_client_id_ici
```

⚠️ **Important** : Ne commitez jamais le fichier `.env` dans Git. Il est déjà dans `.gitignore`.

### 4. Tester en développement avec ngrok

1. Démarrez votre serveur de développement :
   ```bash
   npm run dev
   ```

2. Dans un autre terminal, démarrez ngrok :
   ```bash
   ngrok http 3000
   ```

3. Copiez l'URL ngrok (ex: `https://xxxxx.ngrok-free.dev`)

4. Ajoutez cette URL dans les paramètres Discord (Embedded App > App URL)

5. Dans Discord :
   - Rejoignez un canal vocal
   - Cliquez sur le bouton "Activities" (ou "Activités")
   - Sélectionnez votre application

## Utilisation du SDK dans votre code

### Service Discord (`src/services/discord.ts`)

Le service Discord est automatiquement initialisé au démarrage de l'application. Vous pouvez l'utiliser dans vos composants :

```typescript
import { getDiscordSDK, getCurrentDiscordUser, isDiscordSDKReady } from '../services/discord';

// Vérifier si le SDK est prêt
if (isDiscordSDKReady()) {
  // Récupérer l'utilisateur Discord connecté
  const user = getCurrentDiscordUser();
  console.log('User:', user);
  
  // Récupérer l'instance du SDK
  const sdk = getDiscordSDK();
}
```

### Hook React (`src/hooks/useDiscord.ts`)

Pour utiliser le SDK dans un composant SolidJS :

```typescript
import { useDiscord } from '../hooks/useDiscord';

export default function MyComponent() {
  const { isReady, user, sdk } = useDiscord();
  
  return (
    <div>
      {isReady() && user() && (
        <p>Connecté en tant que {user().username}</p>
      )}
    </div>
  );
}
```

## Fonctionnalités disponibles

- **Authentification automatique** : L'utilisateur Discord est automatiquement connecté
- **Communication postMessage** : Le SDK gère la communication entre l'iframe et Discord
- **Informations utilisateur** : Accès aux informations du profil Discord
- **Présence** : L'application apparaît comme une Activity dans Discord

## Dépannage

### Le SDK ne s'initialise pas

- Vérifiez que `VITE_DISCORD_CLIENT_ID` est défini dans votre `.env`
- Vérifiez que l'application s'exécute dans un iframe Discord
- En développement local (hors Discord), le SDK ne s'initialisera pas (c'est normal)

### L'application ne s'affiche pas dans Discord

- Vérifiez que l'URL dans les paramètres Discord correspond à votre URL ngrok
- Vérifiez que ngrok est toujours actif
- Assurez-vous que votre serveur de développement est en cours d'exécution

### Erreur CORS

- Vérifiez que `server.host: true` est configuré dans `vite.config.ts`
- Vérifiez que les domaines ngrok sont dans `server.allowedHosts`

## Ressources

- [Documentation Discord Embedded App SDK](https://discord.com/developers/docs/game-sdk/sdk-starter-guide)
- [Discord Developer Portal](https://discord.com/developers/applications)

