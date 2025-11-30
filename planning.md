# 📋 Planning de Développement - Docker IDE

> **Projet**: IDE Desktop pour étudiants avec Docker intégré  
> **Stack**: Electron + React + TypeScript + Vite + Dockerode  
> **Branche actuelle**: `feature/docker-connection`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    ELECTRON                             │
├─────────────────────┬───────────────────────────────────┤
│   MAIN PROCESS      │       RENDERER PROCESS            │
│   (Node.js)         │       (Chromium + React)          │
├─────────────────────┼───────────────────────────────────┤
│ DockerManager       │  App.tsx                          │
│ ContainerManager    │  ├── DockerStatus.tsx             │
│ ImageManager        │  ├── ContainerDashboard.tsx       │
│ ProjectManager      │  ├── ImageMarketplace.tsx         │
│                     │  ├── ProjectCreator.tsx           │
│ IPC Handlers ◄──────┼──► electronAPI (preload)          │
│ (dockerHandlers)    │  ├── Terminal.tsx                 │
│ (projectHandlers)   │  ├── CodeEditor.tsx               │
│                     │  └── FileExplorer.tsx             │
└─────────────────────┴───────────────────────────────────┘
```

---

## 🔷 Phase 1 : Finaliser la configuration

### 1.1 - Corriger tsconfig.json
- [ ] Supprimer `"tsx": true` (propriété invalide)
- [ ] Vérifier la configuration JSX pour React

### 1.2 - Configurer le renderer React
- [x] **Fichier**: `src/renderer/main.tsx`
- [x] Créer le point d'entrée React avec `createRoot`
- [x] Importer le composant App principal
- [x] Importer les styles globaux

### 1.3 - Créer App.tsx
- [x] **Fichier**: `src/renderer/App.tsx` (nouveau)
- [x] Layout principal avec sidebar et zone de contenu
- [x] Intégrer le composant DockerStatus existant
- [x] Structure de navigation entre les différentes vues

### 1.4 - Mettre à jour index.html
- [x] Modifier le point d'entrée vers `renderer/main.tsx`
- [x] Ajouter la div root pour React

---

## 🔷 Phase 2 : Backend Docker (Process Main Electron)

### 2.1 - Implémenter ContainerManager
- [x] **Fichier**: `src/main/docker/ContainerManager.ts`
- [x] `listContainers()` : Liste tous les conteneurs
- [x] `createContainer(config)` : Créer un conteneur
- [x] `startContainer(id)` : Démarrer un conteneur
- [x] `stopContainer(id)` : Arrêter un conteneur
- [x] `removeContainer(id)` : Supprimer un conteneur
- [x] `getContainerLogs(id)` : Récupérer les logs
- [x] `execInContainer(id, command)` : Exécuter une commande
- [x] `getContainerStats(id)` : Métriques CPU/RAM

### 2.2 - Implémenter ImageManager
- [x] **Fichier**: `src/main/docker/ImageManager.ts`
- [x] `listImages()` : Liste des images locales
- [x] `pullImage(name, tag)` : Télécharger une image avec progression
- [x] `removeImage(id)` : Supprimer une image
- [x] `searchDockerHub(query)` : Rechercher sur Docker Hub
- [x] `getImageDetails(id)` : Détails d'une image

### 2.3 - Étendre les handlers IPC
- [x] **Fichier**: `src/main/ipc/dockerHandlers.ts`
- [x] Ajouter handlers conteneurs: `container:list`, `container:create`, `container:start`, `container:stop`, `container:remove`, `container:logs`, `container:exec`, `container:stats`
- [x] Ajouter handlers images: `image:list`, `image:pull`, `image:remove`, `image:search`

### 2.4 - Étendre l'API preload
- [x] **Fichier**: `src/preload/index.ts`
- [x] Exposer toutes les nouvelles fonctions au renderer
- [x] Mettre à jour les types TypeScript

---

## 🔷 Phase 3 : Gestion de Projets (Process Main)

### 3.1 - Implémenter ProjectManager
- [ ] **Fichier**: `src/main/project/ProjectManager.ts`
- [ ] `createProject(name, template, path)` : Créer un nouveau projet
- [ ] `openProject(path)` : Ouvrir un projet existant
- [ ] `listProjects()` : Liste des projets récents
- [ ] `generateDockerfile(template)` : Générer le Dockerfile
- [ ] `buildProjectImage(projectPath)` : Builder l'image du projet
- [ ] `startDevContainer(projectPath)` : Lancer le conteneur de dev

### 3.2 - Créer les templates de projet
- [ ] **Dossier**: `src/main/project/templates/`
- [ ] `python/Dockerfile` + `python/config.json`
- [ ] `nodejs/Dockerfile` + `nodejs/config.json`
- [ ] `java/Dockerfile` + `java/config.json`
- [ ] `go/Dockerfile` + `go/config.json`

### 3.3 - Ajouter handlers IPC pour projets
- [ ] **Fichier**: `src/main/ipc/projectHandlers.ts` (nouveau)
- [ ] Handlers: `project:create`, `project:open`, `project:list`, `project:build`, `project:start`

---

## 🔷 Phase 4 : Interface Utilisateur React (Process Renderer)

### 4.1 - Composant ProjectCreator
- [ ] **Fichier**: `src/renderer/components/ProjectCreator.tsx`
- [ ] Formulaire: nom du projet, chemin, sélection template
- [ ] Prévisualisation du Dockerfile généré
- [ ] Bouton création avec feedback visuel

### 4.2 - Composant ImageMarketplace
- [ ] **Fichier**: `src/renderer/components/ImageMarketplace.tsx`
- [ ] Liste des images populaires/recommandées pour étudiants
- [ ] Barre de recherche Docker Hub
- [ ] Bouton pull avec barre de progression
- [ ] Onglet "Mes images" (images locales)

### 4.3 - Composant Terminal
- [ ] **Fichier**: `src/renderer/components/Terminal.tsx`
- [ ] Intégrer xterm.js
- [ ] Connexion au conteneur via docker exec
- [ ] Support des couleurs ANSI
- [ ] Historique des commandes

### 4.4 - Composant ContainerDashboard
- [ ] **Fichier**: `src/renderer/components/ContainerDashboard.tsx` (nouveau)
- [ ] Liste des conteneurs avec statut (running, stopped, etc.)
- [ ] Actions: start/stop/restart/remove
- [ ] Indicateurs CPU/RAM en temps réel
- [ ] Accès rapide aux logs

---

## 🔷 Phase 5 : Éditeur de Code

### 5.1 - Intégrer Monaco Editor
- [ ] **Fichier**: `src/renderer/components/CodeEditor.tsx` (nouveau)
- [ ] Installer `@monaco-editor/react`
- [ ] Coloration syntaxique automatique selon l'extension
- [ ] Support multi-fichiers avec tabs
- [ ] Sauvegarde des fichiers dans le conteneur

### 5.2 - Explorateur de fichiers
- [ ] **Fichier**: `src/renderer/components/FileExplorer.tsx` (nouveau)
- [ ] Arborescence du projet
- [ ] Actions: créer, renommer, supprimer fichiers/dossiers
- [ ] Synchronisation avec le système de fichiers du conteneur

---

## 🔷 Phase 6 : Fonctionnalités Avancées

### 6.1 - Système de logs temps réel
- [ ] Utiliser les streams Docker pour les logs
- [ ] Filtrage et recherche dans les logs
- [ ] Export des logs en fichier

### 6.2 - Métriques des conteneurs
- [ ] Utilisation CPU/RAM en temps réel avec graphiques
- [ ] Alertes si ressources élevées
- [ ] Historique des métriques

### 6.3 - Persistance et configuration
- [ ] Sauvegarder les projets récents (electron-store)
- [ ] Préférences utilisateur
- [ ] Thème clair/sombre
- [ ] Configuration Docker personnalisée

---

## 📦 Dépendances à installer

### Phase 1
```bash
npm install react-dom
npm install -D @types/react-dom
```

### Phase 4-5
```bash
npm install xterm xterm-addon-fit @monaco-editor/react
```

### Phase 6
```bash
npm install electron-store
```

### Optionnel (UI)
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

---

## 📁 Structure finale des fichiers

```
src/
├── main/
│   ├── main.ts
│   ├── docker/
│   │   ├── DockerManager.ts      ✅ Existant
│   │   ├── ContainerManager.ts   📝 À implémenter
│   │   └── ImageManager.ts       📝 À implémenter
│   ├── ipc/
│   │   ├── dockerHandlers.ts     ✅ Existant (à étendre)
│   │   └── projectHandlers.ts    📝 À créer
│   └── project/
│       ├── ProjectManager.ts     📝 À implémenter
│       └── templates/
│           ├── python/
│           ├── nodejs/
│           ├── java/
│           └── go/
├── preload/
│   └── index.ts                  ✅ Existant (à étendre)
└── renderer/
    ├── main.tsx                  📝 À implémenter
    ├── App.tsx                   📝 À créer
    └── components/
        ├── DockerStatus.tsx      ✅ Existant
        ├── ContainerDashboard.tsx 📝 À créer
        ├── ImageMarketplace.tsx  📝 À implémenter
        ├── ProjectCreator.tsx    📝 À implémenter
        ├── Terminal.tsx          📝 À implémenter
        ├── CodeEditor.tsx        📝 À créer
        └── FileExplorer.tsx      📝 À créer
```

---

## ✅ Légende

- ✅ Existant et fonctionnel
- 📝 À implémenter
- [ ] Tâche non commencée
- [x] Tâche terminée

---

## 🚀 Ordre d'exécution recommandé

```
Phase 1: 1.1 → 1.2 → 1.3 → 1.4
Phase 2: 2.1 → 2.2 → 2.3 → 2.4
Phase 3: 3.1 → 3.2 → 3.3
Phase 4: 4.1 → 4.2 → 4.3 → 4.4
Phase 5: 5.1 → 5.2
Phase 6: 6.1 → 6.2 → 6.3
```

---

*Dernière mise à jour: 30 novembre 2025*
