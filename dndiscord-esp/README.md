## DnD Board (SolidJS + Tailwind)

A lightweight SolidJS app styled for a Dungeon & Dragons vibe, designed to run inside a Discord iframe as a Discord Activity.

### Requirements
- Node.js 18+
- Discord Application avec Embedded App activée

### Configuration Discord

1. **Créer une application Discord** :
   - Allez sur https://discord.com/developers/applications
   - Créez une nouvelle application ou sélectionnez une existante
   - Notez votre **Client ID**

2. **Configurer l'Embedded App** :
   - Dans les paramètres de votre application, allez dans "Embedded App"
   - Activez "Embedded App"
   - Ajoutez votre URL de production (ou utilisez ngrok pour le développement)

3. **Configurer les variables d'environnement** :
   - Créez un fichier `.env` à la racine du projet
   - Ajoutez votre Client ID :
   ```env
   VITE_DISCORD_CLIENT_ID=your_discord_client_id_here
   ```

### Install
```bash
npm install
```

### Run (dev)
```bash
npm run dev
```

Vite will print a local URL (e.g., `http://localhost:3000`).

**Pour tester dans Discord** :
1. Utilisez ngrok pour exposer votre serveur local :
   ```bash
   ngrok http 3000
   ```
2. Copiez l'URL ngrok (ex: `https://xxxxx.ngrok-free.dev`)
3. Ajoutez cette URL dans les paramètres de votre Discord App (Embedded App > URL)
4. Ouvrez Discord et lancez votre Activity depuis un canal vocal

### Build
```bash
npm run build
npm run preview
```

### Notes for Discord Activity
- Le SDK Discord est automatiquement initialisé au démarrage de l'application
- L'application détecte automatiquement si elle s'exécute dans un contexte Discord
- Le SDK gère la communication postMessage entre l'iframe et le client Discord
- L'utilisateur Discord connecté est accessible via `getCurrentDiscordUser()` dans `src/services/discord.ts`
- The UI is responsive, dark-themed, and avoids invasive scroll/gestures.
- Fonts used: Cinzel (titles) and IM Fell English SC (labels). Loaded via Google Fonts in `index.html`.
- The home screen provides three primary actions:
  - Jouer
  - Créer nouveau personnage
  - Règles du jeu


