import React from 'react';
import MonacoEditor from '@monaco-editor/react';

interface EditorProps {
    filePath?: string;
    content?: string;
    language?: string;
    isModified?: boolean;
    onContentChange?: (content: string) => void;
    onSave?: () => void;
    onRun?: () => void;
}

const getFileIcon = (language: string): string => {
    const iconMap: Record<string, string> = {
        python: '🐍',
        javascript: '📜',
        typescript: '📘',
        json: '📋',
        markdown: '📝',
        html: '🌐',
        css: '🎨',
        java: '☕',
        go: '🐹',
        rust: '🦀',
        ruby: '💎',
        php: '🐘',
        c: '⚡',
        cpp: '⚡',
        dockerfile: '🐳',
    };
    
    return iconMap[language] || '📄';
};

const Editor: React.FC<EditorProps> = ({
    filePath,
    content = '',
    language = 'plaintext',
    isModified = false,
    onContentChange,
    onSave,
    onRun,
}) => {
    const handleEditorChange = (value: string | undefined) => {
        if (onContentChange) {
            onContentChange(value || '');
        }
    };

    if (!filePath) {
        return (
            <div className="editor-welcome">
                <div className="welcome-content">
                    <h1>🐳 Docker IDE</h1>
                    <p>Environnement de développement containerisé</p>
                    <div className="welcome-actions">
                        <div className="welcome-card">
                            <span className="welcome-icon">📁</span>
                            <h3>Ouvrir un projet</h3>
                            <p>Sélectionnez un dossier dans l'explorateur</p>
                        </div>
                        <div className="welcome-card">
                            <span className="welcome-icon">🧩</span>
                            <h3>Installer des langages</h3>
                            <p>Onglet Extensions → Python, Node.js, Java...</p>
                        </div>
                        <div className="welcome-card">
                            <span className="welcome-icon">🚀</span>
                            <h3>Exécuter du code</h3>
                            <p>F5 ou bouton Run → Exécution dans Docker</p>
                        </div>
                    </div>
                    <div className="shortcuts">
                        <h4>Raccourcis clavier</h4>
                        <div className="shortcut-list">
                            <div><kbd>Ctrl</kbd> + <kbd>S</kbd> Sauvegarder</div>
                            <div><kbd>F5</kbd> Exécuter dans Docker</div>
                            <div><kbd>Ctrl</kbd> + <kbd>`</kbd> Terminal</div>
                            <div><kbd>Ctrl</kbd> + <kbd>B</kbd> Sidebar</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const fileIcon = getFileIcon(language);
    const fileName = filePath.split(/[/\\]/).pop() || '';
    const lineCount = content.split('\n').length;

    return (
        <div className="editor-container">
            <div className="editor-toolbar">
                <div className="toolbar-left">
                    <span className="current-file">
                        <span className="file-icon">{fileIcon}</span>
                        <span className="file-path">{filePath}</span>
                    </span>
                </div>
                <div className="toolbar-right">
                    <button
                        className="toolbar-btn"
                        onClick={onSave}
                        disabled={!isModified}
                        title="Sauvegarder (Ctrl+S)"
                    >
                        💾 Sauvegarder
                    </button>
                    <button
                        className="toolbar-btn run-btn"
                        onClick={onRun}
                        title="Exécuter (F5)"
                    >
                        ▶️ Exécuter
                    </button>
                </div>
            </div>
            <div className="editor-main">
                <MonacoEditor
                    height="100%"
                    language={language}
                    theme="vs-dark"
                    value={content}
                    onChange={handleEditorChange}
                    options={{
                        fontSize: 14,
                        fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace",
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        lineNumbers: 'on',
                        renderLineHighlight: 'line',
                        automaticLayout: true,
                        tabSize: 4,
                        insertSpaces: true,
                        quickSuggestions: true,
                        folding: true,
                        bracketPairColorization: { enabled: true },
                        guides: { bracketPairs: true, indentation: true },
                        wordWrap: 'off',
                        smoothScrolling: true,
                        cursorBlinking: 'smooth',
                        cursorSmoothCaretAnimation: 'on',
                    }}
                />
            </div>
            <div className="editor-statusbar">
                <span className="status-item">{lineCount} lignes</span>
                <span className="status-item">{language.toUpperCase()}</span>
                <span className="status-item">UTF-8</span>
                {isModified && <span className="status-item modified">● Modifié</span>}
            </div>
        </div>
    );
};

export default Editor;
