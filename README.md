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

```bash
npm start
```

Cette commande builde l'app puis la lance. Pour développer avec le rechargement à chaud :

```bash
npm run dev
```

L'app n'est pas empaquetée : il n'y a ni `.app` ni `.dmg`. Il faut garder ce dossier en place, car le lancement au démarrage y fait référence.

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

Après une mise à jour du code, relance `npm run build` : le lancement au démarrage utilise la version buildée.

## Ce que peuvent faire les agents

Par défaut, un agent discute et rien d'autre : ni accès à tes fichiers, ni web, ni commandes. En mode abonnement, Claude Code démarre depuis un dossier vide, sans tes réglages, hooks, plugins ni serveurs MCP, et sans clé API ni autre variable sensible dans son environnement. Si Claude Code annonce une facturation sur une clé, l'app arrête la requête.

### Outils web

Dans l'assistant, à l'étape **Compétences**, tu peux activer pour chaque agent la **recherche web** et la **lecture de pages web**, avec une liste optionnelle de domaines autorisés. Un domaine couvre ses sous-domaines. Une ligne discrète dans le chat indique ce que fait l'agent.

| | Abonnement | Clé API |
|---|---|---|
| Outils | `WebSearch` et `WebFetch` de Claude Code | Outils serveur `web_search` et `web_fetch` de l'API |
| Coût | Compris dans ton forfait, dans ses limites | 10 $ les 1 000 recherches, plus les jetons des pages lues |
| Filtre de domaines | Appliqué avant chaque appel par `web-guard.cjs`, un contrôle de l'app | `allowed_domains` de l'API |
| Limite par tour | Aucune | 5 recherches et 5 lectures, 20 000 jetons par page |

Une page web peut contenir des instructions malveillantes. Sans liste de domaines, un agent qui en lit une pourrait être poussé à envoyer ce qu'il sait vers un autre site, surtout en mode abonnement, où `WebFetch` n'a pas la protection de l'API qui limite les adresses à celles déjà vues dans la conversation. Pour un agent qui connaît des informations sensibles, renseigne la liste. Une fiche exportée contient ses outils : vérifie-les quand tu importes un agent.

## Où sont tes données

Tout est dans `~/Library/Application Support/Agent Toolbox/`, en JSON non chiffré, sauf la clé API :

| Fichier | Contenu |
|---|---|
| `agents.json` | Fiches des agents |
| `conversations/<agent>/<conversation>.json` | Conversations |
| `memory/<agent>.json` | Faits retenus |
| `settings.json` | Position de l'icône, raccourci, mode de connexion |
| `secrets.bin` | Clé API chiffrée, si tu en as enregistré une |
| `tools/web-guard.cjs` | Contrôle des outils web, réécrit à chaque usage |

Deux emplacements en dehors de ce dossier :

- **`~/.claude/projects/`** : les transcriptions que Claude Code garde pour reprendre une conversation.
- **`~/Library/LaunchAgents/com.agenttoolbox.plist`** : créé seulement si tu actives le lancement au démarrage.

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
