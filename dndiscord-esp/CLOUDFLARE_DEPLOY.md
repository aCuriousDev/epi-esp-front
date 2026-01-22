# Déploiement avec Cloudflare

Ce guide explique comment utiliser Cloudflare pour exposer votre application Discord, soit pour le développement (Cloudflare Tunnel) soit pour la production (Cloudflare Pages).

## Option 1 : Cloudflare Tunnel (Développement) - Alternative à ngrok

Cloudflare Tunnel (cloudflared) est gratuit, sans limite de temps, et offre des URLs stables.

### Utilisation rapide (sans authentification)

1. **Démarrez votre serveur de développement** :
   ```bash
   npm run dev
   ```

2. **Dans un autre terminal, créez un tunnel** :
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```

3. **Copiez l'URL fournie** (ex: `https://xxxxx.trycloudflare.com`)

4. **Ajoutez cette URL dans Discord** :
   - Allez sur https://discord.com/developers/applications
   - Sélectionnez votre application
   - Embedded App > App URL > Collez l'URL cloudflare

### Utilisation avec authentification (URL stable)

Pour obtenir une URL qui ne change pas à chaque redémarrage :

1. **Connectez-vous à Cloudflare** :
   ```bash
   cloudflared tunnel login
   ```
   Cela ouvrira votre navigateur pour vous connecter.

2. **Créez un tunnel nommé** :
   ```bash
   cloudflared tunnel create dndiscord-dev
   ```

3. **Créez un fichier de configuration** `~/.cloudflared/config.yml` :
   ```yaml
   tunnel: <tunnel-id>
   credentials-file: C:\Users\<votre-username>\.cloudflared\<tunnel-id>.json
   
   ingress:
     - hostname: dndiscord-dev.your-domain.com  # Optionnel : avec votre domaine
       service: http://localhost:3000
     - service: http_status:404
   ```

4. **Démarrez le tunnel** :
   ```bash
   cloudflared tunnel run dndiscord-dev
   ```

## Option 2 : Cloudflare Pages (Production)

Cloudflare Pages est gratuit et idéal pour déployer votre application frontend.

### Prérequis

- Un compte Cloudflare (gratuit)
- Votre code sur GitHub/GitLab/Bitbucket (optionnel mais recommandé)

### Méthode 1 : Déploiement via Git (Recommandé)

1. **Poussez votre code sur GitHub** :
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/votre-username/votre-repo.git
   git push -u origin main
   ```

2. **Connectez Cloudflare Pages à votre repo** :
   - Allez sur https://dash.cloudflare.com/
   - Sélectionnez "Pages" dans le menu
   - Cliquez sur "Create a project"
   - Connectez votre compte GitHub/GitLab
   - Sélectionnez votre repository

3. **Configurez le build** :
   - **Framework preset** : Vite
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
   - **Root directory** : `dndiscord-esp` (si votre repo contient plusieurs projets)

4. **Ajoutez les variables d'environnement** :
   - Dans les paramètres du projet Pages
   - Allez dans "Environment variables"
   - Ajoutez `VITE_DISCORD_CLIENT_ID` avec votre Client ID

5. **Déployez** :
   - Cloudflare Pages déploiera automatiquement à chaque push
   - Vous obtiendrez une URL : `https://votre-projet.pages.dev`

6. **Ajoutez l'URL dans Discord** :
   - Allez sur https://discord.com/developers/applications
   - Embedded App > App URL > Collez l'URL Cloudflare Pages

### Méthode 2 : Déploiement manuel (Wrangler CLI)

1. **Installez Wrangler** :
   ```bash
   npm install -g wrangler
   ```

2. **Connectez-vous** :
   ```bash
   wrangler login
   ```

3. **Créez un projet Pages** :
   ```bash
   cd dndiscord-esp
   wrangler pages project create dndiscord
   ```

4. **Build votre application** :
   ```bash
   npm run build
   ```

5. **Déployez** :
   ```bash
   wrangler pages deploy dist
   ```

6. **Configurez les variables d'environnement** :
   ```bash
   wrangler pages secret put VITE_DISCORD_CLIENT_ID
   # Entrez votre Client ID quand demandé
   ```

## Comparaison des options

| Feature | Cloudflare Tunnel | Cloudflare Pages |
|---------|------------------|------------------|
| **Usage** | Développement | Production |
| **Gratuit** | ✅ Oui | ✅ Oui |
| **Limite de temps** | ❌ Non | ❌ Non |
| **URL stable** | Avec config | ✅ Oui |
| **HTTPS** | ✅ Oui | ✅ Oui |
| **CDN** | ❌ Non | ✅ Oui |
| **Déploiement automatique** | ❌ Non | ✅ Oui (avec Git) |

## Scripts utiles

Ajoutez ces scripts dans votre `package.json` :

```json
{
  "scripts": {
    "dev": "vite",
    "dev:tunnel": "cloudflared tunnel --url http://localhost:3000",
    "build": "tsc -b && vite build",
    "preview": "vite preview --port 5173",
    "deploy:pages": "npm run build && wrangler pages deploy dist"
  }
}
```

## Configuration Discord

Quelle que soit l'option choisie, n'oubliez pas de :

1. Ajouter l'URL dans Discord Developer Portal
2. Vérifier que `VITE_DISCORD_CLIENT_ID` est configuré
3. Tester dans Discord (canal vocal > Activities)

## Dépannage

### Cloudflare Tunnel ne fonctionne pas
- Vérifiez que votre serveur local tourne sur le bon port
- Vérifiez que le firewall n'bloque pas cloudflared

### Cloudflare Pages ne déploie pas
- Vérifiez les logs de build dans le dashboard Cloudflare
- Vérifiez que `dist` contient les fichiers buildés
- Vérifiez que les variables d'environnement sont configurées

### L'application ne se charge pas dans Discord
- Vérifiez que l'URL est correcte dans Discord Developer Portal
- Vérifiez que l'application est bien buildée
- Vérifiez la console du navigateur pour les erreurs

