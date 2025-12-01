import React, { useState } from 'react';

interface ProjectCreatorProps {
    isOpen: boolean;
    onClose: () => void;
    onProjectCreated: (projectPath: string) => void;
}

interface LanguageTemplate {
    id: string;
    name: string;
    icon: string;
    image: string;
    description: string;
    templates: ProjectTemplate[];
}

interface ProjectTemplate {
    id: string;
    name: string;
    description: string;
    files: { path: string; content: string }[];
}

const LANGUAGE_TEMPLATES: LanguageTemplate[] = [
    {
        id: 'python',
        name: 'Python',
        icon: '🐍',
        image: 'python:3.11-slim',
        description: 'Python 3.11 avec pip',
        templates: [
            {
                id: 'python-basic',
                name: 'Projet basique',
                description: 'Un fichier main.py simple',
                files: [
                    {
                        path: 'main.py',
                        content: `#!/usr/bin/env python3
"""Mon premier projet Python dans Docker IDE"""

def main():
    print("🐳 Hello from Docker IDE!")
    print("Modifiez ce fichier et appuyez sur F5 pour exécuter")

if __name__ == "__main__":
    main()
`,
                    },
                    {
                        path: 'README.md',
                        content: `# Mon Projet Python

## Exécution

Appuyez sur **F5** ou cliquez sur le bouton **Exécuter** pour lancer le programme.

## Fichiers

- \`main.py\` - Point d'entrée du programme
`,
                    },
                ],
            },
            {
                id: 'python-flask',
                name: 'Application Web Flask',
                description: 'Serveur web avec Flask',
                files: [
                    {
                        path: 'app.py',
                        content: `from flask import Flask, render_template_string

app = Flask(__name__)

HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Docker IDE - Flask</title>
    <style>
        body { font-family: Arial; text-align: center; padding: 50px; }
        h1 { color: #0078d4; }
    </style>
</head>
<body>
    <h1>🐳 Hello from Flask!</h1>
    <p>Votre serveur Flask fonctionne dans Docker</p>
</body>
</html>
"""

@app.route('/')
def home():
    return render_template_string(HTML)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
`,
                    },
                    {
                        path: 'requirements.txt',
                        content: `flask==3.0.0
`,
                    },
                ],
            },
        ],
    },
    {
        id: 'javascript',
        name: 'JavaScript',
        icon: '📜',
        image: 'node:20-alpine',
        description: 'Node.js 20 LTS',
        templates: [
            {
                id: 'js-basic',
                name: 'Projet basique',
                description: 'Un fichier index.js simple',
                files: [
                    {
                        path: 'index.js',
                        content: `/**
 * Mon premier projet JavaScript dans Docker IDE
 */

function main() {
    console.log("🐳 Hello from Docker IDE!");
    console.log("Modifiez ce fichier et appuyez sur F5 pour exécuter");
    
    // Exemple avec des fonctions modernes
    const numbers = [1, 2, 3, 4, 5];
    const doubled = numbers.map(n => n * 2);
    console.log("Nombres doublés:", doubled);
}

main();
`,
                    },
                    {
                        path: 'package.json',
                        content: `{
  "name": "mon-projet",
  "version": "1.0.0",
  "description": "Projet créé avec Docker IDE",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}
`,
                    },
                ],
            },
            {
                id: 'js-express',
                name: 'Serveur Express',
                description: 'API REST avec Express.js',
                files: [
                    {
                        path: 'server.js',
                        content: `const express = require('express');
const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: "🐳 Hello from Docker IDE!",
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', (req, res) => {
    res.json({ status: 'running', uptime: process.uptime() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(\`Serveur démarré sur http://localhost:\${PORT}\`);
});
`,
                    },
                    {
                        path: 'package.json',
                        content: `{
  "name": "express-api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
`,
                    },
                ],
            },
        ],
    },
    {
        id: 'java',
        name: 'Java',
        icon: '☕',
        image: 'eclipse-temurin:17-jdk',
        description: 'Java 17 LTS (Eclipse Temurin)',
        templates: [
            {
                id: 'java-basic',
                name: 'Projet basique',
                description: 'Classe Main simple',
                files: [
                    {
                        path: 'Main.java',
                        content: `/**
 * Mon premier projet Java dans Docker IDE
 */
public class Main {
    public static void main(String[] args) {
        System.out.println("🐳 Hello from Docker IDE!");
        System.out.println("Modifiez ce fichier et appuyez sur F5 pour exécuter");
        
        // Exemple avec streams
        java.util.List<Integer> numbers = java.util.Arrays.asList(1, 2, 3, 4, 5);
        System.out.println("Carrés: " + 
            numbers.stream()
                   .map(n -> n * n)
                   .toList()
        );
    }
}
`,
                    },
                ],
            },
        ],
    },
    {
        id: 'go',
        name: 'Go',
        icon: '🐹',
        image: 'golang:1.21-alpine',
        description: 'Go 1.21',
        templates: [
            {
                id: 'go-basic',
                name: 'Projet basique',
                description: 'Package main simple',
                files: [
                    {
                        path: 'main.go',
                        content: `package main

import "fmt"

func main() {
    fmt.Println("🐳 Hello from Docker IDE!")
    fmt.Println("Modifiez ce fichier et appuyez sur F5 pour exécuter")
    
    // Exemple avec slice
    numbers := []int{1, 2, 3, 4, 5}
    var squared []int
    for _, n := range numbers {
        squared = append(squared, n*n)
    }
    fmt.Printf("Carrés: %v\\n", squared)
}
`,
                    },
                    {
                        path: 'go.mod',
                        content: `module monprojet

go 1.21
`,
                    },
                ],
            },
        ],
    },
    {
        id: 'rust',
        name: 'Rust',
        icon: '🦀',
        image: 'rust:1.73-slim',
        description: 'Rust stable',
        templates: [
            {
                id: 'rust-basic',
                name: 'Projet basique',
                description: 'Fichier main.rs simple',
                files: [
                    {
                        path: 'main.rs',
                        content: `//! Mon premier projet Rust dans Docker IDE

fn main() {
    println!("🐳 Hello from Docker IDE!");
    println!("Modifiez ce fichier et appuyez sur F5 pour exécuter");
    
    // Exemple avec iterators
    let numbers: Vec<i32> = vec![1, 2, 3, 4, 5];
    let squared: Vec<i32> = numbers.iter().map(|n| n * n).collect();
    println!("Carrés: {:?}", squared);
}
`,
                    },
                ],
            },
        ],
    },
];

const ProjectCreatorModal: React.FC<ProjectCreatorProps> = ({
    isOpen,
    onClose,
    onProjectCreated,
}) => {
    const [step, setStep] = useState<'language' | 'template' | 'location'>('language');
    const [projectName, setProjectName] = useState('mon-projet');
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageTemplate | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
    const [projectPath, setProjectPath] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSelectLanguage = (lang: LanguageTemplate) => {
        setSelectedLanguage(lang);
        setSelectedTemplate(lang.templates[0]);
        setStep('template');
    };

    const handleSelectTemplate = (template: ProjectTemplate) => {
        setSelectedTemplate(template);
        setStep('location');
    };

    const handleBrowseFolder = async () => {
        try {
            const result = await window.electronAPI.fs.openFolder();
            if (result.success && result.path) {
                setProjectPath(result.path);
            }
        } catch (err) {
            console.error('Error selecting folder:', err);
        }
    };

    const handleCreateProject = async () => {
        if (!selectedLanguage || !selectedTemplate || !projectPath || !projectName) {
            setError('Veuillez remplir tous les champs');
            return;
        }

        setIsCreating(true);
        setError(null);

        try {
            // Create project directory
            const fullProjectPath = `${projectPath}/${projectName}`;
            await window.electronAPI.fs.createDirectory(fullProjectPath);

            // Create template files
            for (const file of selectedTemplate.files) {
                const filePath = `${fullProjectPath}/${file.path}`;
                await window.electronAPI.fs.writeFile(filePath, file.content);
            }

            // Check if Docker image is available
            const langConfig = await window.electronAPI.runner.getLanguageConfig(selectedLanguage.id);
            if (langConfig.success) {
                const imageCheck = await window.electronAPI.runner.checkImage(langConfig.image);
                if (!imageCheck.available) {
                    // Pull image in background
                    window.electronAPI.runner.ensureImage(langConfig.image);
                }
            }

            onProjectCreated(fullProjectPath);
            handleClose();
        } catch (err: any) {
            setError(err.message || 'Erreur lors de la création du projet');
        } finally {
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        setStep('language');
        setProjectName('mon-projet');
        setSelectedLanguage(null);
        setSelectedTemplate(null);
        setProjectPath('');
        setError(null);
        onClose();
    };

    const handleBack = () => {
        if (step === 'template') {
            setStep('language');
        } else if (step === 'location') {
            setStep('template');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content project-creator" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {step === 'language' && '🚀 Nouveau Projet'}
                        {step === 'template' && `${selectedLanguage?.icon} ${selectedLanguage?.name}`}
                        {step === 'location' && '📁 Emplacement'}
                    </h2>
                    <button className="modal-close" onClick={handleClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Step 1: Choose Language */}
                    {step === 'language' && (
                        <div className="language-grid">
                            {LANGUAGE_TEMPLATES.map((lang) => (
                                <div
                                    key={lang.id}
                                    className="language-card"
                                    onClick={() => handleSelectLanguage(lang)}
                                >
                                    <span className="language-icon">{lang.icon}</span>
                                    <h3>{lang.name}</h3>
                                    <p>{lang.description}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Choose Template */}
                    {step === 'template' && selectedLanguage && (
                        <div className="template-list">
                            {selectedLanguage.templates.map((template) => (
                                <div
                                    key={template.id}
                                    className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
                                    onClick={() => handleSelectTemplate(template)}
                                >
                                    <h3>{template.name}</h3>
                                    <p>{template.description}</p>
                                    <div className="template-files">
                                        {template.files.map((f) => (
                                            <span key={f.path} className="file-tag">
                                                {f.path}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 3: Choose Location */}
                    {step === 'location' && (
                        <div className="location-form">
                            <div className="form-group">
                                <label>Nom du projet</label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9-_]/g, '-'))}
                                    placeholder="mon-projet"
                                />
                            </div>
                            <div className="form-group">
                                <label>Emplacement</label>
                                <div className="path-input">
                                    <input
                                        type="text"
                                        value={projectPath}
                                        onChange={(e) => setProjectPath(e.target.value)}
                                        placeholder="Sélectionnez un dossier..."
                                        readOnly
                                    />
                                    <button onClick={handleBrowseFolder}>Parcourir...</button>
                                </div>
                            </div>
                            {projectPath && (
                                <div className="project-preview">
                                    <p>Le projet sera créé dans :</p>
                                    <code>{projectPath}/{projectName}</code>
                                </div>
                            )}
                            {error && <div className="form-error">{error}</div>}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {step !== 'language' && (
                        <button className="btn btn-secondary" onClick={handleBack}>
                            ← Retour
                        </button>
                    )}
                    <div className="modal-footer-right">
                        <button className="btn btn-secondary" onClick={handleClose}>
                            Annuler
                        </button>
                        {step === 'location' && (
                            <button
                                className="btn btn-primary"
                                onClick={handleCreateProject}
                                disabled={isCreating || !projectPath || !projectName}
                            >
                                {isCreating ? 'Création...' : '✨ Créer le projet'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectCreatorModal;
