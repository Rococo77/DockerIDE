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
    connectToProject: () => Promise<void>;
    isShellActive: () => boolean;
}

const SHELL_OPTIONS = [
    { id: 'bash', name: 'Bash', image: 'alpine:latest' },
    { id: 'python', name: 'Python', image: 'python:3.11-slim' },
    { id: 'node', name: 'Node.js', image: 'node:20-alpine' },
    { id: 'ruby', name: 'Ruby IRB', image: 'ruby:3.2-slim' },
];

const MAX_TERMINAL_LINES = 1000;

const addLines = (prev: TerminalLine[], newLines: TerminalLine[]): TerminalLine[] => {
    const combined = [...prev, ...newLines];
    return combined.length > MAX_TERMINAL_LINES
        ? combined.slice(combined.length - MAX_TERMINAL_LINES)
        : combined;
};

const Terminal = forwardRef<TerminalHandle, TerminalProps>(({ visible, onClose, workspacePath }, ref) => {
    const [lines, setLines] = useState<TerminalLine[]>([
        { type: 'system', content: 'Docker IDE Terminal' },
        { type: 'system', content: 'Ready.' },
    ]);
    const [currentInput, setCurrentInput] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [activeTab, setActiveTab] = useState<'terminal' | 'shell'>('terminal');
    const [shellActive, setShellActive] = useState(false);
    const [shellId, setShellId] = useState<string>('');
    const [showShellPicker, setShowShellPicker] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const terminalRef = useRef<HTMLDivElement>(null);

    const appendLine = useCallback((type: TerminalLine['type'], content: string) => {
        setLines(prev => addLines(prev, [{ type, content }]));
    }, []);

    const connectToProject = async () => {
        if (shellActive || !workspacePath) return;

        const newShellId = `shell-${Date.now()}`;
        setShellId(newShellId);
        setLines([
            { type: 'system', content: 'Docker IDE Terminal' },
            { type: 'system', content: `Project: ${workspacePath}` },
            { type: 'system', content: 'Detecting configuration...' },
        ]);

        try {
            let projectImage = 'alpine:latest';
            let projectLanguage = 'bash';

            try {
                const configPath = `${workspacePath}/.docker-ide.json`;
                const configResult = await window.electronAPI.fs.readFile(configPath);
                if (configResult.success && configResult.content) {
                    const config = JSON.parse(configResult.content);
                    if (config.image) projectImage = config.image;
                    if (config.language) projectLanguage = config.language;
                    if (config.framework) {
                        setLines(prev => [...prev, {
                            type: 'system',
                            content: `Framework: ${config.framework}`
                        }]);
                    }
                }
            } catch {
                setLines(prev => [...prev, {
                    type: 'system',
                    content: 'No .docker-ide.json found, using default image'
                }]);
            }

            setLines(prev => [...prev, {
                type: 'system',
                content: `Image: ${projectImage}`
            }]);

            const result = await window.electronAPI.shell.start({
                shellId: newShellId,
                image: projectImage,
                language: projectLanguage,
                workspacePath,
            });

            if (result.success) {
                setShellActive(true);
                setActiveTab('shell');
                setLines(prev => [...prev, {
                    type: 'success',
                    content: 'Connected to Docker container'
                }]);
            } else {
                setLines(prev => [...prev, {
                    type: 'error',
                    content: result.error || 'Connection error'
                }]);
            }
        } catch (err: any) {
            setLines(prev => [...prev, { type: 'error', content: err.message }]);
        }
    };

    useImperativeHandle(ref, () => ({
        addLine: (type: TerminalLine['type'], content: string) => {
            setLines(prev => [...prev, { type, content, timestamp: new Date() }]);
        },
        clear: () => {
            setLines([{ type: 'system', content: 'Terminal cleared' }]);
        },
        runCode: async (filePath: string, language: string) => {
            await executeInDocker(filePath, language);
        },
        connectToProject,
        isShellActive: () => shellActive,
    }), [shellActive, workspacePath]);

    useEffect(() => {
        if (visible && inputRef.current) {
            inputRef.current.focus();
        }
    }, [visible, activeTab]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [lines]);

    useEffect(() => {
        const handleProgress = (data: { status: string }) => {
            setLines(prev => [...prev, { type: 'system', content: data.status }]);
        };

        const cleanup = window.electronAPI?.runner?.onProgress(handleProgress);
        return () => cleanup?.();
    }, []);

    useEffect(() => {
        const handleMessage = (data: { shellId: string; type: string; data: string }) => {
            if (data.shellId === shellId) {
                const lineType = data.type === 'error' ? 'error' :
                                data.type === 'system' ? 'system' : 'output';
                setLines(prev => [...prev, {
                    type: lineType as TerminalLine['type'],
                    content: data.data
                }]);
            }
        };

        const handleClosed = (data: { shellId: string }) => {
            if (data.shellId === shellId) {
                setShellActive(false);
                setLines(prev => [...prev, { type: 'system', content: 'Shell closed' }]);
            }
        };

        const cleanupMessage = window.electronAPI?.shell?.onMessage(handleMessage);
        const cleanupClosed = window.electronAPI?.shell?.onClosed(handleClosed);

        return () => {
            cleanupMessage?.();
            cleanupClosed?.();
        };
    }, [shellId]);

    const startShell = async (shellOption: typeof SHELL_OPTIONS[0]) => {
        const newShellId = `shell-${Date.now()}`;
        setShellId(newShellId);
        setShowShellPicker(false);
        setLines([{ type: 'system', content: `Starting ${shellOption.name} shell...` }]);

        try {
            const result = await window.electronAPI.shell.start({
                shellId: newShellId,
                image: shellOption.image,
                language: shellOption.id,
                workspacePath,
            });

            if (result.success) {
                setShellActive(true);
                setActiveTab('shell');
            } else {
                setLines(prev => [...prev, {
                    type: 'error',
                    content: result.error || 'Shell start error'
                }]);
            }
        } catch (err: any) {
            setLines(prev => [...prev, { type: 'error', content: err.message }]);
        }
    };

    const stopShell = async () => {
        if (shellId) {
            await window.electronAPI.shell.stop(shellId);
            setShellActive(false);
        }
    };

    const executeInDocker = async (filePath: string, language: string) => {
        if (!workspacePath) {
            setLines(prev => [...prev, {
                type: 'error',
                content: 'No project open. Open a folder first.',
            }]);
            return;
        }

        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        setLines(prev => [...prev, {
            type: 'system',
            content: `> Running ${fileName} (${language})...`,
        }]);
        setIsRunning(true);

        try {
            const result = await window.electronAPI.runner.run({
                filePath,
                workspacePath,
                language,
            });

            if (result.success) {
                if (result.output) {
                    result.output.split('\n').forEach((line: string) => {
                        if (line.trim()) {
                            setLines(prev => [...prev, { type: 'output', content: line }]);
                        }
                    });
                }
                if (result.error) {
                    result.error.split('\n').forEach((line: string) => {
                        if (line.trim()) {
                            setLines(prev => [...prev, { type: 'error', content: line }]);
                        }
                    });
                }
                if (result.executionTime) {
                    setLines(prev => [...prev, {
                        type: 'success',
                        content: `Done in ${result.executionTime}ms (exit: ${result.exitCode || 0})`,
                    }]);
                }
            } else {
                setLines(prev => [...prev, {
                    type: 'error',
                    content: `Error: ${result.error || 'Unknown error'}`,
                }]);
            }
        } catch (err: any) {
            setLines(prev => [...prev, {
                type: 'error',
                content: `Error: ${err.message || err}`,
            }]);
        } finally {
            setIsRunning(false);
        }
    };

    const executeCommand = async (cmd: string) => {
        if (!cmd.trim()) return;

        if (shellActive && activeTab === 'shell') {
            setLines(prev => [...prev, { type: 'input', content: `$ ${cmd}` }]);
            await window.electronAPI.shell.write(shellId, cmd);
            return;
        }

        setLines(prev => [...prev, { type: 'input', content: `$ ${cmd}` }]);

        if (cmd === 'clear') {
            setLines([{ type: 'system', content: 'Terminal cleared' }]);
            return;
        }

        if (cmd === 'help') {
            setLines(prev => [
                ...prev,
                { type: 'system', content: 'Available commands:' },
                { type: 'output', content: '  run <file>     Run a file in Docker' },
                { type: 'output', content: '  shell          Open an interactive Docker shell' },
                { type: 'output', content: '  clear          Clear the terminal' },
                { type: 'output', content: '  help           Show this help' },
                { type: 'output', content: '' },
                { type: 'system', content: 'Or use the Run button in the editor (F5)' },
            ]);
            return;
        }

        if (cmd === 'shell') {
            setShowShellPicker(true);
            return;
        }

        if (cmd.startsWith('run ')) {
            const filePath = cmd.replace('run ', '').trim();
            const ext = filePath.split('.').pop()?.toLowerCase();
            const langMap: Record<string, string> = {
                py: 'python', js: 'javascript', ts: 'typescript',
                java: 'java', go: 'go', rs: 'rust',
                rb: 'ruby', php: 'php', c: 'c', cpp: 'cpp',
            };
            const language = langMap[ext || ''] || 'plaintext';

            if (language === 'plaintext') {
                setLines(prev => [...prev, {
                    type: 'error',
                    content: `Unrecognized extension: .${ext}`,
                }]);
                return;
            }

            const fullPath = workspacePath ? `${workspacePath}/${filePath}` : filePath;
            await executeInDocker(fullPath, language);
            return;
        }

        setLines(prev => [...prev, {
            type: 'error',
            content: `Unknown command: ${cmd}. Type "help" for available commands.`,
        }]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isRunning) {
            executeCommand(currentInput);
            setCurrentInput('');
        }
        if (e.key === 'c' && e.ctrlKey && shellActive) {
            window.electronAPI.shell.write(shellId, '\x03');
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
                        <span>Terminal</span>
                    </div>
                    <div
                        className={`terminal-tab ${activeTab === 'shell' ? 'active' : ''}`}
                        onClick={() => setActiveTab('shell')}
                    >
                        <span>Shell {shellActive && <span className="shell-active-dot"></span>}</span>
                    </div>
                </div>
                <div className="terminal-actions">
                    {activeTab === 'shell' && (
                        <>
                            <button
                                className="icon-btn"
                                title="New shell"
                                onClick={() => setShowShellPicker(true)}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            {shellActive && (
                                <button
                                    className="icon-btn"
                                    title="Stop shell"
                                    onClick={stopShell}
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
                                </button>
                            )}
                        </>
                    )}
                    <button
                        className="icon-btn"
                        title="Clear"
                        onClick={() => setLines([{ type: 'system', content: 'Terminal cleared' }])}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                    <button className="icon-btn" title="Close" onClick={onClose}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            </div>

            {showShellPicker && (
                <div className="shell-picker">
                    <div className="shell-picker-header">
                        <span>Select a Docker shell</span>
                        <button className="icon-btn" onClick={() => setShowShellPicker(false)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <div className="shell-picker-options">
                        {SHELL_OPTIONS.map(option => (
                            <button
                                key={option.id}
                                className="shell-option"
                                onClick={() => startShell(option)}
                            >
                                <span className="shell-option-name">{option.name}</span>
                                <span className="shell-option-image">{option.image}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="terminal-body" ref={terminalRef} onClick={() => inputRef.current?.focus()}>
                {lines.map((line, i) => (
                    <div key={i} className={`terminal-line ${line.type}`}>
                        {line.content}
                    </div>
                ))}
                <div className="terminal-input-line">
                    <span className="prompt">{shellActive && activeTab === 'shell' ? '> ' : '$ '}</span>
                    <input
                        ref={inputRef}
                        type="text"
                        className="terminal-input"
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={isRunning}
                        placeholder={
                            isRunning ? 'Running...' :
                            shellActive && activeTab === 'shell' ? 'Enter a shell command...' :
                            'Type a command...'
                        }
                    />
                </div>
            </div>
        </div>
    );
});

Terminal.displayName = 'Terminal';

export default Terminal;
