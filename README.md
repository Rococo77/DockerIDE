# Docker IDE - Environnement de Développement pour Étudiants

Un IDE desktop moderne conçu pour les étudiants en informatique, favorisant l'apprentissage des bonnes pratiques DevOps en utilisant Docker dès le début.

## 🎯 Vision du Projet

Créer un environnement de développement où **chaque projet s'exécute dans son propre conteneur Docker**, forçant ainsi les étudiants à :
- Comprendre l'isolation des environnements
- Travailler avec des environnements reproductibles
- Éviter les problèmes de "ça marche sur ma machine"
- Adopter Docker naturellement dès le début de leur apprentissage

## ✨ Fonctionnalités Principales

### 🚀 Création de Projet Dockerisé
- Sélection de l'environnement (Python, Node.js, Java, Go, etc.)
- Génération automatique de `Dockerfile` et configuration
- Création et démarrage du conteneur de développement
- Templates préconfigurés par langage et framework

### 📦 Marketplace d'Images Docker
- Catalogue d'images préconfigurées
- Installation en un clic depuis l'interface
- Gestion des images téléchargées (à la VS Code Extensions)
- Images optimisées pour l'apprentissage

### 💻 Environnement de Développement Intégré
- Éditeur de code avec coloration syntaxique (Monaco Editor)
- Terminal intégré connecté au conteneur
- Exécution du code dans Docker
- Hot reload et développement en temps réel

### 📊 Visualisation Docker
- Dashboard des conteneurs actifs
- Utilisation des ressources (CPU, RAM)
- Logs en temps réel
- Interface pédagogique pour comprendre Docker

## 🏗️ Architecture Technique

### Stack
- **Frontend**: Electron + Vite + TypeScript + React
- **Éditeur**: Monaco Editor (moteur de VS Code)
- **Docker**: Docker Engine API via Dockerode
- **Styling**: TailwindCSS

### Structure
```
docker-ide/
├── src/
│   ├── main/              # Processus principal Electron
│   │   ├── docker/        # Gestion Docker
│   │   ├── project/       # Gestion des projets
│   │   └── main.ts
│   ├── renderer/          # Interface utilisateur
│   │   ├── components/
│   │   ├── pages/
│   │   └── main.tsx
│   └── preload/           # Bridge IPC sécurisé
├── templates/             # Templates Docker par langage
└── assets/
```

## 🔧 Prérequis Système

- **Docker Desktop** installé et démarré
- **Node.js** 18+
- **npm** ou **yarn**
- **Système**: Windows 10+, macOS 10.15+, Linux (Ubuntu 20.04+)

## 🚀 Installation

```bash
# Cloner le repository
git clone https://github.com/votre-username/docker-ide.git
cd docker-ide

# Installer les dépendances
npm install

# Lancer en mode développement
npm run dev

# Build pour production
npm run build
```

## 📖 Utilisation

### 1. Créer un Nouveau Projet
1. Cliquer sur "Nouveau Projet"
2. Choisir un nom et un emplacement
3. Sélectionner un environnement (Python, Node.js, etc.)
4. Choisir un template (optionnel)
5. L'IDE crée automatiquement le conteneur

### 2. Développer dans Docker
- Tout le code s'exécute dans le conteneur
- Les modifications sont synchronisées en temps réel
- Le terminal est connecté au conteneur
- Installation de dépendances via Docker

### 3. Gérer les Environnements
- Accéder au Marketplace pour installer de nouvelles images
- Voir les images installées
- Mettre à jour ou supprimer des images

## 🎓 Objectifs Pédagogiques

### Pour les Étudiants
- ✅ Apprendre Docker sans effort conscient
- ✅ Comprendre l'isolation des environnements
- ✅ Pratiquer la reproductibilité
- ✅ Éviter la pollution de l'OS local
- ✅ Préparer aux pratiques professionnelles

### Pour les Enseignants
- 📚 Tous les étudiants ont le même environnement
- 🔄 Facile de distribuer des projets
- 🐛 Réduction des problèmes de configuration
- 📊 Suivi des environnements utilisés

## 🗺️ Roadmap

### Phase 1 - MVP (En cours)
- [x] Setup Electron + Vite + TypeScript
- [ ] Intégration Docker API
 - [x] Intégration Docker API (liste des conteneurs/images, actions de base)
- [ ] Création de projet basique
- [ ] Éditeur Monaco
- [ ] Terminal intégré

### Phase 2 - Marketplace
- [ ] Catalogue d'images
- [ ] Installation d'images
- [ ] Templates par langage
- [ ] Gestion des images

### Phase 3 - Fonctionnalités Avancées
- [ ] Debugging dans conteneur
- [ ] Extensions
- [ ] Collaboration en temps réel
- [ ] Git intégré
- [ ] Docker Compose support

### Phase 4 - Pédagogie
- [ ] Tutoriels interactifs
- [ ] Visualisation de l'architecture
- [ ] Mode "expert" avec Dockerfiles visibles
- [ ] Métriques d'apprentissage

## 🤝 Contribution

Les contributions sont les bienvenues ! Ce projet est conçu pour la communauté éducative.

```bash
# Fork le projet
# Créer une branche
git checkout -b feature/ma-fonctionnalite

# Commit les changements
git commit -m "Ajout de ma fonctionnalité"

# Push
git push origin feature/ma-fonctionnalite

# Ouvrir une Pull Request
```

## 📝 Langages Supportés (Planifiés)

- 🐍 Python (3.8, 3.9, 3.10, 3.11, 3.12)
- 🟢 Node.js (16 LTS, 18 LTS, 20 LTS)
- ☕ Java (11, 17, 21)
- 🐹 Go (1.20, 1.21)
- 💎 Ruby (3.0, 3.1, 3.2)
- 🦀 Rust (stable, nightly)
- ⚡ C/C++ (GCC, Clang)
- 🐘 PHP (8.1, 8.2, 8.3)

## 📄 Licence

MIT - Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 👥 Auteurs

Développé avec ❤️ pour faciliter l'apprentissage de la programmation et DevOps.

## 🙏 Remerciements

- [Docker](https://www.docker.com/) pour la containerisation
- [Electron](https://www.electronjs.org/) pour le framework desktop
- [Monaco Editor](https://microsoft.github.io/monaco-editor/) pour l'éditeur
- [VS Code](https://code.visualstudio.com/) pour l'inspiration

---

**Note**: Ce projet est en développement actif. Les fonctionnalités peuvent évoluer.

Pour toute question ou suggestion : [Ouvrir une issue](https://github.com/votre-username/docker-ide/issues)