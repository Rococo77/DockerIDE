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
        python: 'PY',
        javascript: 'JS',
        typescript: 'TS',
        json: '{}',
        markdown: 'MD',
        html: '<>',
        css: '#',
        java: 'JV',
        go: 'GO',
        rust: 'RS',
        ruby: 'RB',
        php: 'HP',
        c: 'C',
        cpp: 'C+',
        dockerfile: 'DF',
    };

    return iconMap[language] || '--';
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
                    <h1>Docker IDE</h1>
                    <p className="welcome-subtitle">Environnement de developpement containerise</p>
                    <div className="welcome-actions">
                        <div className="welcome-card">
                            <div className="welcome-icon-wrap">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                            </div>
                            <h3>Ouvrir un projet</h3>
                            <p>Selectionnez un dossier dans l'explorateur</p>
                        </div>
                        <div className="welcome-card">
                            <div className="welcome-icon-wrap">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>
                            </div>
                            <h3>Installer des langages</h3>
                            <p>Onglet Extensions pour Python, Node.js, Java...</p>
                        </div>
                        <div className="welcome-card">
                            <div className="welcome-icon-wrap">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </div>
                            <h3>Executer du code</h3>
                            <p>F5 ou bouton Run pour lancer dans Docker</p>
                        </div>
                    </div>
                    <div className="shortcuts">
                        <h4>Raccourcis clavier</h4>
                        <div className="shortcut-list">
                            <div><kbd>Ctrl</kbd> + <kbd>S</kbd> Sauvegarder</div>
                            <div><kbd>F5</kbd> Executer dans Docker</div>
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
                        <span className="file-icon file-icon-text">{fileIcon}</span>
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
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Sauvegarder
                    </button>
                    <button
                        className="toolbar-btn run-btn"
                        onClick={onRun}
                        title="Executer (F5)"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                        Executer
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
                {isModified && <span className="status-item modified">Modified</span>}
            </div>
        </div>
    );
};

export default Editor;
