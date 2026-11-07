# Agent Toolbox

Une petite icône flottante sur macOS, qui ouvre un panneau pour discuter avec des agents IA que tu crées toi-même. Chaque agent a un avatar animé, un caractère stable et sa propre mémoire.

## Prérequis

- macOS (développé sur Mac Apple Silicon)
- [Node.js](https://nodejs.org) et npm
- [Claude Code](https://code.claude.com/docs/en/overview), connecté à ton abonnement Claude

## Installation

```bash
npm install
```

## Lancement

Pour installer l'app dans **Applications** :

```bash
npm run app
```

Cette commande fabrique `Agent Toolbox.app` et remplace la version déjà installée. Quitte l'app avant de la lancer. Ensuite, tu ouvres l'app comme les autres, depuis Spotlight, le Launchpad ou le Dock. Elle apparaît dans le Dock et dans Cmd+Tab, et y revenir ouvre le panneau. Après une modification du code, relance `npm run app` pour mettre l'app installée à jour. L'app est signée localement, sans compte développeur Apple : elle n'est faite que pour ce Mac.

Pour développer, sans installer :

```bash
npm run dev
```

`npm start` builde puis lance le projet sans rechargement à chaud. L'icône de l'app se régénère avec `npm run icon`.

## Connexion à Claude

Dans le panneau, ouvre **⚙**. Deux modes existent :

- **Mon abonnement Claude (par défaut).** Les agents passent par Claude Code et partagent les limites de ton forfait avec Claude. Clique sur **Se connecter**, ou lance `claude auth login`. La connexion se fait sur la page officielle : l'app ne voit jamais tes identifiants. Laisse les crédits d'usage désactivés dans ton compte Claude : c'est le seul cas où un dépassement serait facturé.
- **Clé API (payant à l'usage).** La clé est chiffrée grâce au trousseau macOS et reste dans le process principal.

Le mode abonnement est prévu pour un usage personnel, sur ton propre Mac : Anthropic ne permet pas à un développeur de proposer la connexion Claude dans un produit destiné à d'autres. Pour distribuer l'app, il faudrait passer par des clés API. Voir les [conditions de Claude Code](https://code.claude.com/docs/en/legal-and-compliance).

## Utilisation

| Action | Comment |
|---|---|
| Ouvrir ou fermer le panneau | Clic sur l'icône, ou **⌘ ⇧ Espace** (modifiable dans **⚙**) |
| Déplacer l'icône | La glisser : elle s'aimante au coin le plus proche |
| Fermer le panneau | Échap, ou clic à l'extérieur |
| Créer un agent | **+ Créer un agent**, à la main ou avec **Générer avec l'IA** |
| Essayer un agent avant de l'enregistrer | **Tester**, dans l'assistant de création |
| Changer d'agent | Clic sur son nom, en haut du chat |
| Voir l'historique et la mémoire | **☰**, en haut du chat |
| Sauvegarder ou partager des agents | **⚙** pour tous, **⋯** sur une carte pour un seul |
| Lancer au démarrage | **⚙**, ou le menu de l'icône dans la barre de menus |

Avec l’app installée, le lancement au démarrage passe par l’option « Ouvrir à la connexion » de macOS. En mode développement, il lance la version buildée du projet : après une mise à jour du code, relance `npm run build`.

## Ce que peuvent faire les agents

Par défaut, un agent discute et rien d'autre : ni accès à tes fichiers, ni web, ni commandes. En mode abonnement, Claude Code démarre depuis un dossier vide, sans tes réglages, hooks, plugins ni serveurs MCP, et sans clé API ni autre variable sensible dans son environnement. Si Claude Code annonce une facturation sur une clé, l'app arrête la requête.

### Outils web

Dans l'assistant, à l'étape **Compétences**, tu peux activer pour chaque agent la **recherche web** et la **lecture de pages web**, avec une liste optionnelle de domaines autorisés. Un domaine couvre ses sous-domaines. Une ligne discrète dans le chat indique ce que fait l'agent.

| | Abonnement | Clé API |
|---|---|---|
| Outils | `WebSearch` et `WebFetch` de Claude Code | Outils serveur `web_search` et `web_fetch` de l'API |
| Coût | Compris dans ton forfait, dans ses limites | 10 $ les 1 000 recherches, plus les jetons des pages lues |
| Filtre de domaines | Appliqué avant chaque appel par `tool-guard.cjs`, un contrôle de l'app | `allowed_domains` de l'API |
| Limite par tour | Aucune | 5 recherches et 5 lectures, 20 000 jetons par page |

Une page web peut contenir des instructions malveillantes. Sans liste de domaines, un agent qui en lit une pourrait être poussé à envoyer ce qu'il sait vers un autre site, surtout en mode abonnement, où `WebFetch` n'a pas la protection de l'API qui limite les adresses à celles déjà vues dans la conversation. Pour un agent qui connaît des informations sensibles, renseigne la liste. Une fiche exportée contient ses outils : vérifie-les quand tu importes un agent.

### Connecteurs MCP

Dans **⚙**, ajoute un serveur MCP distant avec son adresse et, si besoin, un jeton envoyé en `Authorization: Bearer`. Active-le ensuite agent par agent, à l'étape **Compétences**. Par exemple, pour Brevo : `https://mcp.brevo.com/v1/brevo/mcp`, avec un jeton créé dans son tableau de bord.

- **Lectures :** elles passent sans confirmation. L'app les reconnaît au nom de l'action, qui doit dire clairement que c'est une lecture (`get`, `list`, `search`, `stats`…) et ne contenir aucun mot d'écriture.
- **Tout le reste :** création, modification, suppression, envoi, import, ou nom inconnu. L'action affiche une carte avec son détail complet, et ne s'exécute qu'après un clic sur **Confirmer**.
- **Sans réponse :** refus, arrêt de la réponse, fin de l'échange ou 5 minutes sans clic, et l'action n'est pas exécutée. Si le contrôle tombe en panne, l'appel est bloqué aussi.

Limites :

- La distinction repose sur les noms : n'ajoute que des serveurs de confiance. Un serveur qui appellerait `get_x` une action d'écriture passerait sans carte.
- La carte attend dans le chat : rien ne t'alerte si le panneau est fermé.
- Les connecteurs fonctionnent seulement avec ton abonnement. L'API exécuterait leurs actions de son côté, sans étape de confirmation : ils y sont désactivés.
- La connexion OAuth n'est pas gérée : seuls les serveurs sans authentification ou à jeton fonctionnent.

## Où sont tes données

Tout est dans `~/Library/Application Support/Agent Toolbox/`, en JSON non chiffré, sauf la clé API :

| Fichier | Contenu |
|---|---|
| `agents.json` | Fiches des agents |
| `conversations/<agent>/<conversation>.json` | Conversations |
| `memory/<agent>.json` | Faits retenus |
| `settings.json` | Position de l'icône, raccourci, mode de connexion |
| `secrets.bin` | Clé API chiffrée, si tu en as enregistré une |
| `connectors.json` | Nom et adresse des connecteurs MCP |
| `connector-tokens.bin` | Jetons des connecteurs, chiffrés |
| `tools/tool-guard.cjs` | Contrôle des outils, réécrit à chaque usage |

Deux emplacements en dehors de ce dossier :

- **`~/.claude/projects/`** : les transcriptions que Claude Code garde pour reprendre une conversation.
- **`~/Library/LaunchAgents/com.agenttoolbox.plist`** : créé seulement en mode développement, si tu actives le lancement au démarrage. L’app installée le retire et utilise l’option de macOS à la place.

Le contenu des conversations et les faits retenus sont envoyés à Claude pour obtenir une réponse. Un export ne contient que les fiches des agents, sans mémoire ni conversations.

## Développement

```bash
npm test
```

```bash
npm run typecheck
```

```text
src/
  main/       Process principal : fenêtres, barre de menus, raccourci, IPC
    ai/       Appels à Claude : Claude Code et clé API
    store/    Stockage JSON validé, clé chiffrée
  preload/    Pont IPC typé. Tourne en sandbox : aucun module npm
  shared/     Types, schémas, prompt système, lecture des balises
  renderer/
    avatar/   Avatar SVG et ses états
    widget/   Icône flottante
    panel/    Galerie, assistant, chat, réglages
```

Pile : Electron, React, TypeScript, electron-vite, Motion, Zod et le SDK Anthropic.
