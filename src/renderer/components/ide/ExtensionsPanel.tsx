import React, { useState, useEffect } from 'react';

interface LanguageImage {
    id: string;
    name: string;
    description: string;
    icon: string;
    versions: string[];
    installed: boolean;
    installedVersion?: string;
    category: 'language' | 'framework' | 'tool';
}

// Catalogue des images disponibles
const AVAILABLE_IMAGES: LanguageImage[] = [
    {
        id: 'python',
        name: 'Python',
        description: 'Langage polyvalent idéal pour débuter',
        icon: '🐍',
        versions: ['3.12', '3.11', '3.10', '3.9'],
        installed: false,
        category: 'language',
    },
    {
        id: 'node',
        name: 'Node.js',
        description: 'JavaScript côté serveur',
        icon: '🟢',
        versions: ['22', '20-lts', '18-lts'],
        installed: false,
        category: 'language',
    },
    {
        id: 'openjdk',
        name: 'Java (OpenJDK)',
        description: 'Langage orienté objet robuste',
        icon: '☕',
        versions: ['21', '17', '11'],
        installed: false,
        category: 'language',
    },
    {
        id: 'golang',
        name: 'Go',
        description: 'Langage moderne et performant',
        icon: '🐹',
        versions: ['1.22', '1.21', '1.20'],
        installed: false,
        category: 'language',
    },
    {
        id: 'rust',
        name: 'Rust',
        description: 'Langage système sûr et performant',
        icon: '🦀',
        versions: ['latest', '1.75', '1.74'],
        installed: false,
        category: 'language',
    },
    {
        id: 'gcc',
        name: 'C/C++ (GCC)',
        description: 'Compilateur C/C++ GNU',
        icon: '⚡',
        versions: ['14', '13', '12'],
        installed: false,
        category: 'language',
    },
    {
        id: 'ruby',
        name: 'Ruby',
        description: 'Langage élégant et productif',
        icon: '💎',
        versions: ['3.3', '3.2', '3.1'],
        installed: false,
        category: 'language',
    },
    {
        id: 'php',
        name: 'PHP',
        description: 'Langage web populaire',
        icon: '🐘',
        versions: ['8.3', '8.2', '8.1'],
        installed: false,
        category: 'language',
    },
];

const ExtensionsPanel: React.FC = () => {
    const [images, setImages] = useState<LanguageImage[]>(AVAILABLE_IMAGES);
    const [installedImages, setInstalledImages] = useState<string[]>([]);
    const [installing, setInstalling] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSection, setActiveSection] = useState<'installed' | 'available'>('available');

    // Charger les images Docker installées au démarrage
    useEffect(() => {
        loadInstalledImages();
    }, []);

    const loadInstalledImages = async () => {
        if (!window.electronAPI?.docker) return;
        
        try {
            const result = await window.electronAPI.docker.listImages();
            if (result.success && result.data) {
                const tags: string[] = [];
                result.data.forEach((img: { RepoTags?: string[] }) => {
                    if (img.RepoTags) {
                        tags.push(...img.RepoTags);
                    }
                });
                setInstalledImages(tags);
                
                // Mettre à jour le statut d'installation des images
                setImages(prev => prev.map(img => {
                    const installedTag = tags.find(tag => tag.startsWith(img.id + ':'));
                    return {
                        ...img,
                        installed: !!installedTag,
                        installedVersion: installedTag?.split(':')[1],
                    };
                }));
            }
        } catch (err) {
            console.error('Erreur chargement images:', err);
        }
    };

    const installImage = async (imageId: string, version: string) => {
        if (!window.electronAPI?.docker) return;
        
        const repoTag = `${imageId}:${version}`;
        setInstalling(repoTag);
        
        try {
            const result = await window.electronAPI.docker.pullImage(repoTag);
            if (result.success) {
                await loadInstalledImages();
            } else {
                alert(`Erreur: ${result.error}`);
            }
        } catch (err) {
            console.error('Erreur installation:', err);
        } finally {
            setInstalling(null);
        }
    };

    const uninstallImage = async (imageId: string) => {
        if (!window.electronAPI?.docker) return;
        
        const img = images.find(i => i.id === imageId);
        if (!img?.installedVersion) return;
        
        const repoTag = `${imageId}:${img.installedVersion}`;
        
        try {
            const result = await window.electronAPI.docker.removeImage(repoTag);
            if (result.success) {
                await loadInstalledImages();
            } else {
                alert(`Erreur: ${result.error}`);
            }
        } catch (err) {
            console.error('Erreur désinstallation:', err);
        }
    };

    const filteredImages = images.filter(img =>
        img.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        img.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const installedList = filteredImages.filter(img => img.installed);
    const availableList = filteredImages.filter(img => !img.installed);

    return (
        <div className="extensions-panel">
            <div className="extensions-header">
                <h3>Extensions</h3>
                <p className="text-muted">Images Docker des langages</p>
            </div>

            <div className="search-box">
                <input
                    type="text"
                    placeholder="🔍 Rechercher un langage..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                />
            </div>

            <div className="section-tabs">
                <button
                    className={`section-tab ${activeSection === 'installed' ? 'active' : ''}`}
                    onClick={() => setActiveSection('installed')}
                >
                    Installées ({installedList.length})
                </button>
                <button
                    className={`section-tab ${activeSection === 'available' ? 'active' : ''}`}
                    onClick={() => setActiveSection('available')}
                >
                    Disponibles ({availableList.length})
                </button>
            </div>

            <div className="extensions-list">
                {activeSection === 'installed' && installedList.length === 0 && (
                    <div className="empty-state">
                        <p>Aucune extension installée</p>
                        <p className="text-muted">Installez des langages pour commencer à coder !</p>
                    </div>
                )}

                {(activeSection === 'installed' ? installedList : availableList).map((img) => (
                    <div key={img.id} className="extension-card">
                        <div className="extension-icon">{img.icon}</div>
                        <div className="extension-info">
                            <div className="extension-name">
                                {img.name}
                                {img.installed && (
                                    <span className="installed-badge">
                                        ✓ {img.installedVersion}
                                    </span>
                                )}
                            </div>
                            <div className="extension-desc">{img.description}</div>
                        </div>
                        <div className="extension-actions">
                            {img.installed ? (
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => uninstallImage(img.id)}
                                >
                                    Désinstaller
                                </button>
                            ) : (
                                <select
                                    className="version-select"
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            installImage(img.id, e.target.value);
                                        }
                                    }}
                                    disabled={installing !== null}
                                    value=""
                                >
                                    <option value="">
                                        {installing?.startsWith(img.id) ? '⏳ Installation...' : 'Installer ▼'}
                                    </option>
                                    {img.versions.map((v) => (
                                        <option key={v} value={v}>
                                            Version {v}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ExtensionsPanel;
