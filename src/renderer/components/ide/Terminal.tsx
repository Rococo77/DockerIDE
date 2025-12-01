import React, { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';

interface TerminalProps {
    visible: boolean;
    onClose: () => void;
    workspacePath?: string;
}

interface TerminalLine {
    type: 'input' | 'output' | 'error' | 'system' | 'success';
    content: string;
    timestamp?: Date;
}

export interface TerminalHandle {
    addLine: (type: TerminalLine['type'], content: string) => void;
    clear: () => void;
    runCode: (filePath: string, language: string) => Promise<void>;
}

const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ visible, onClose, workspacePath }, ref) => {
    const [lines, setLines] = useState<TerminalLine[]>([
        { type: 'system', content: '🐳 Docker IDE Terminal' },
        { type: 'system', content: 'Prêt à exécuter du code dans des conteneurs Docker.' },
    ]);
    const [currentInput, setCurrentInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [activeTab, setActiveTab] = useState<'terminal' | 'output'>('terminal');
    const inputRef = useRef<HTMLInputElement>(null);
    const terminalRef = useRef<HTMLDivElement>(null);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
        addLine: (type: TerminalLine['type'], content: string) => {
            setLines(prev => [...prev, { type, content, timestamp: new Date() }]);
        },
        clear: () => {
            setLines([{ type: 'system', content: '🐳 Terminal effacé' }]);
        },
        runCode: async (filePath: string, language: string) => {
            await executeInDocker(filePath, language);
        },
    }));

    useEffect(() => {
        if (visible && inputRef.current) {
            inputRef.current.focus();
        }
    }, [visible]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [lines]);

    // Listen for progress updates from runner
    useEffect(() => {
        const handleProgress = (data: { status: string }) => {
            setLines(prev => [...prev, { type: 'system', content: data.status }]);
        };

        window.electronAPI?.runner?.onProgress(handleProgress);
    }, []);

    const executeInDocker = async (filePath: string, language: string) => {
        if (!workspacePath) {
            setLines(prev => [...prev, {
                type: 'error',
                content: 'Aucun projet ouvert. Ouvrez un dossier d\'abord.',
            }]);
            return;
        }

        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        setLines(prev => [...prev, {
            type: 'system',
            content: `▶ Exécution de ${fileName} (${language})...`,
        }]);
        setIsRunning(true);

        try {
            const result = await window.electronAPI.runner.run({
                filePath,
                workspacePath,
                language,
            });

            if (result.success) {
                // Show output
                if (result.output) {
                    result.output.split('\n').forEach((line: string) => {
                        if (line.trim()) {
                            setLines(prev => [...prev, { type: 'output', content: line }]);
                        }
                    });
                }
                // Show any stderr
                if (result.error) {
                    result.error.split('\n').forEach((line: string) => {
                        if (line.trim()) {
                            setLines(prev => [...prev, { type: 'error', content: line }]);
                        }
                    });
                }
                // Show execution time
                if (result.executionTime) {
                    setLines(prev => [...prev, {
                        type: 'success',
                        content: `✓ Exécution terminée en ${result.executionTime}ms (code: ${result.exitCode || 0})`,
                    }]);
                }
            } else {
                setLines(prev => [...prev, {
                    type: 'error',
                    content: `✗ Erreur: ${result.error || 'Erreur inconnue'}`,
                }]);
            }
        } catch (err: any) {
            setLines(prev => [...prev, {
                type: 'error',
                content: `✗ Erreur: ${err.message || err}`,
            }]);
        } finally {
            setIsRunning(false);
        }
    };

    const executeCommand = async (cmd: string) => {
        if (!cmd.trim()) return;

        setLines(prev => [...prev, { type: 'input', content: `$ ${cmd}` }]);

        // Built-in commands
        if (cmd === 'clear') {
            setLines([{ type: 'system', content: '🐳 Terminal effacé' }]);
            return;
        }

        if (cmd === 'help') {
            setLines(prev => [
                ...prev,
                { type: 'system', content: 'Commandes disponibles:' },
                { type: 'output', content: '  run <file>     - Exécuter un fichier dans Docker' },
                { type: 'output', content: '  clear          - Effacer le terminal' },
                { type: 'output', content: '  help           - Afficher cette aide' },
                { type: 'output', content: '' },
                { type: 'system', content: 'Ou utilisez le bouton "Exécuter" dans l\'éditeur (F5)' },
            ]);
            return;
        }

        // Run command
        if (cmd.startsWith('run ')) {
            const filePath = cmd.replace('run ', '').trim();
            // Get language from extension
            const ext = filePath.split('.').pop()?.toLowerCase();
            const langMap: Record<string, string> = {
                py: 'python',
                js: 'javascript',
                ts: 'typescript',
                java: 'java',
                go: 'go',
                rs: 'rust',
                rb: 'ruby',
                php: 'php',
                c: 'c',
                cpp: 'cpp',
            };
            const language = langMap[ext || ''] || 'plaintext';
            
            if (language === 'plaintext') {
                setLines(prev => [...prev, {
                    type: 'error',
                    content: `Extension non reconnue: .${ext}`,
                }]);
                return;
            }

            const fullPath = workspacePath ? `${workspacePath}/${filePath}` : filePath;
            await executeInDocker(fullPath, language);
            return;
        }

        setLines(prev => [...prev, {
            type: 'error',
            content: `Commande non reconnue: ${cmd}. Tapez "help" pour l'aide.`,
        }]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isRunning) {
            executeCommand(currentInput);
            setCurrentInput('');
        }
    };

    if (!visible) return null;

    return (
        <div className="terminal-container">
            <div className="terminal-header">
                <div className="terminal-tabs">
                    <div
                        className={`terminal-tab ${activeTab === 'terminal' ? 'active' : ''}`}
                        onClick={() => setActiveTab('terminal')}
                    >
                        <span>🐳 Terminal</span>
                    </div>
                    <div
                        className={`terminal-tab ${activeTab === 'output' ? 'active' : ''}`}
                        onClick={() => setActiveTab('output')}
                    >
                        <span>📤 Sortie</span>
                    </div>
                </div>
                <div className="terminal-actions">
                    <button
                        className="icon-btn"
                        title="Effacer"
                        onClick={() => setLines([{ type: 'system', content: '🐳 Terminal effacé' }])}
                    >
                        🗑️
                    </button>
                    <button className="icon-btn" title="Fermer" onClick={onClose}>×</button>
                </div>
            </div>
            <div className="terminal-body" ref={terminalRef} onClick={() => inputRef.current?.focus()}>
                {lines.map((line, i) => (
                    <div key={i} className={`terminal-line ${line.type}`}>
                        {line.content}
                    </div>
                ))}
                <div className="terminal-input-line">
                    <span className="prompt">$ </span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="terminal-input"
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isRunning}
                        placeholder={isRunning ? 'Exécution en cours...' : 'Tapez une commande...'}
                    />
                </div>
            </div>
        </div>
    );
});

Terminal.displayName = 'Terminal';

export default Terminal;
