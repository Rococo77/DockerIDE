import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/ide/Sidebar';
import FileExplorer from './components/ide/FileExplorer';
import ExtensionsPanel from './components/ide/ExtensionsPanel';
import Editor from './components/ide/Editor';
import Terminal, { TerminalHandle } from './components/ide/Terminal';
import DockerStatusBar from './components/ide/DockerStatusBar';

type SidebarTab = 'files' | 'extensions' | 'docker';

interface OpenFile {
    path: string;
    language: string;
    content: string;
    isModified: boolean;
}

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SidebarTab>('files');
    const [workspacePath, setWorkspacePath] = useState<string | undefined>();
    const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
    const [activeFileIndex, setActiveFileIndex] = useState<number>(-1);
    const [terminalVisible, setTerminalVisible] = useState(true);
    const terminalRef = useRef<TerminalHandle>(null);

    // Get the active file
    const activeFile = activeFileIndex >= 0 ? openFiles[activeFileIndex] : null;

    // Run code in Docker
    const handleRunCode = async () => {
        if (!activeFile || !workspacePath) {
            terminalRef.current?.addLine('error', 'Aucun fichier ou projet ouvert');
            return;
        }

        // Make sure terminal is visible
        setTerminalVisible(true);

        // Save file before running if modified
        if (activeFile.isModified) {
            await handleSaveFile();
        }

        // Run in terminal
        await terminalRef.current?.runCode(activeFile.path, activeFile.language);
    };

    // Open a file
    const handleFileSelect = async (path: string, language: string) => {
        // Check if file is already open
        const existingIndex = openFiles.findIndex(f => f.path === path);
        if (existingIndex >= 0) {
            setActiveFileIndex(existingIndex);
            return;
        }

        // Load file content
        try {
            const result = await window.electronAPI.fs.readFile(path);
            if (result.success) {
                const newFile: OpenFile = {
                    path,
                    language,
                    content: result.content,
                    isModified: false,
                };
                setOpenFiles([...openFiles, newFile]);
                setActiveFileIndex(openFiles.length);
            }
        } catch (err) {
            console.error('Error loading file:', err);
        }
    };

    // Update file content
    const handleContentChange = useCallback((content: string) => {
        if (activeFileIndex >= 0) {
            setOpenFiles(prev => {
                const updated = [...prev];
                updated[activeFileIndex] = {
                    ...updated[activeFileIndex],
                    content,
                    isModified: true,
                };
                return updated;
            });
        }
    }, [activeFileIndex]);

    // Save file
    const handleSaveFile = async () => {
        if (!activeFile || !activeFile.isModified) return;

        try {
            const result = await window.electronAPI.fs.writeFile(
                activeFile.path,
                activeFile.content
            );
            if (result.success) {
                setOpenFiles(prev => {
                    const updated = [...prev];
                    updated[activeFileIndex] = {
                        ...updated[activeFileIndex],
                        isModified: false,
                    };
                    return updated;
                });
            }
        } catch (err) {
            console.error('Error saving file:', err);
        }
    };

    // Close a file tab
    const handleCloseFile = (index: number) => {
        const newOpenFiles = openFiles.filter((_, i) => i !== index);
        setOpenFiles(newOpenFiles);
        
        if (activeFileIndex === index) {
            // If closing active file, activate the previous one or next one
            setActiveFileIndex(Math.max(0, index - 1));
        } else if (activeFileIndex > index) {
            // Adjust index if closing a file before the active one
            setActiveFileIndex(activeFileIndex - 1);
        }
        
        if (newOpenFiles.length === 0) {
            setActiveFileIndex(-1);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSaveFile();
            }
            if (e.key === 'F5') {
                e.preventDefault();
                handleRunCode();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeFile, workspacePath]);

    const renderSidePanel = () => {
        switch (activeTab) {
            case 'files':
                return (
                    <FileExplorer
                        onFileSelect={handleFileSelect}
                        selectedFile={activeFile?.path}
                        workspacePath={workspacePath}
                        onWorkspaceChange={setWorkspacePath}
                    />
                );
            case 'extensions':
                return <ExtensionsPanel />;
            case 'docker':
                return (
                    <div className="docker-panel">
                        <h3>🐳 Docker</h3>
                        <p className="text-muted">Gestion des conteneurs</p>
                        <div className="docker-section">
                            <h4>Conteneurs actifs</h4>
                            <div className="empty-state">
                                <p>Aucun conteneur actif</p>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="ide-container">
            {/* Barre latérale d'icônes */}
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* Panneau latéral (explorateur, extensions, etc.) */}
            <div className="side-panel">
                {renderSidePanel()}
            </div>

            {/* Zone principale */}
            <div className="main-area">
                {/* Onglets des fichiers ouverts */}
                {openFiles.length > 0 && (
                    <div className="editor-tabs">
                        {openFiles.map((file, index) => (
                            <div
                                key={file.path}
                                className={`editor-tab ${index === activeFileIndex ? 'active' : ''}`}
                                onClick={() => setActiveFileIndex(index)}
                            >
                                <span className="tab-name">
                                    {file.isModified && '● '}
                                    {file.path.split(/[/\\]/).pop()}
                                </span>
                                <button
                                    className="tab-close"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCloseFile(index);
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Éditeur */}
                <div className={`editor-area ${terminalVisible ? 'with-terminal' : ''}`}>
                    <Editor
                        filePath={activeFile?.path}
                        content={activeFile?.content}
                        language={activeFile?.language || 'plaintext'}
                        isModified={activeFile?.isModified || false}
                        onContentChange={handleContentChange}
                        onSave={handleSaveFile}
                        onRun={handleRunCode}
                    />
                </div>

                {/* Terminal */}
                <Terminal
                    ref={terminalRef}
                    visible={terminalVisible}
                    onClose={() => setTerminalVisible(false)}
                    workspacePath={workspacePath}
                />
            </div>

            {/* Barre de statut */}
            <div className="statusbar">
                <DockerStatusBar />
                <div className="statusbar-right">
                    <button
                        className="statusbar-btn"
                        onClick={() => setTerminalVisible(!terminalVisible)}
                    >
                        {terminalVisible ? '◀ Terminal' : '▶ Terminal'}
                    </button>
                    {activeFile && (
                        <span className="statusbar-item">
                            {activeFile.language.toUpperCase()}
                        </span>
                    )}
                    <span className="statusbar-item">Docker IDE v1.0</span>
                </div>
            </div>
        </div>
    );
};

export default App;
