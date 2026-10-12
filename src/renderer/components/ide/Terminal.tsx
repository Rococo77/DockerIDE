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

    // Every addition goes through here, so that the terminal keeps at most MAX_TERMINAL_LINES
    const appendLines = useCallback((newLines: TerminalLine[]) => {
        setLines(prev => addLines(prev, newLines));
    }, []);
    // Project the active shell belongs to: another project needs another shell
    const shellWorkspaceRef = useRef<string | undefined>(undefined);

    const connectToProject = async () => {
        if (!workspacePath) return;
        // Already connected to this project
        if (shellActive && shellWorkspaceRef.current === workspacePath) return;
        // A shell of the previous project would keep running commands in that project
        await stopShell();

        const newShellId = `shell-${Date.now()}`;
        setShellId(newShellId);
        setLines([
            { type: 'system', content: 'Docker IDE Terminal' },
            { type: 'system', content: `Project: ${workspacePath}` },
            { type: 'system', content: 'Starting the project\'s container...' },
        ]);

        try {
            // The main process sets up the project's environment: its image, its
            // dependencies (Python virtualenv, Ruby gems) and its server's ports
            const result = await window.electronAPI.shell.start({
                shellId: newShellId,
                workspacePath,
                project: true,
            });

            if (result.success) {
                shellWorkspaceRef.current = workspacePath;
                setShellActive(true);
                setActiveTab('shell');
                const environment = result.environment;
                appendLines([
                    { type: 'success', content: `Connected to Docker container (${environment?.image})` },
                    ...(environment?.startCommand
                        ? [{ type: 'system' as const, content: `Start the server: ${environment.startCommand}` }]
                        : []),
                    ...(environment?.ports ?? []).map((port: number): TerminalLine => ({
                        type: 'system',
                        content: `Then open http://localhost:${port}`,
                    })),
                ]);
            } else {
                appendLines([{
                    type: 'error',
                    content: result.error || 'Connection error'
                }]);
            }
        } catch (err: any) {
            appendLines([{ type: 'error', content: err.message }]);
        }
    };

    useImperativeHandle(ref, () => ({
        addLine: (type: TerminalLine['type'], content: string) => {
            appendLines([{ type, content, timestamp: new Date() }]);
        },
        clear: () => {
            setLines([{ type: 'system', content: 'Terminal cleared' }]);
        },
        runCode: async (filePath: string, language: string) => {
            await executeInDocker(filePath, language);
        },
        connectToProject,
        isShellActive: () => shellActive,
    }), [shellActive, shellId, workspacePath]);

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
            appendLines([{ type: 'system', content: data.status }]);
        };

        const cleanup = window.electronAPI?.runner?.onProgress(handleProgress);
        return () => cleanup?.();
    }, []);

    useEffect(() => {
        const handleMessage = (data: { shellId: string; type: string; data: string }) => {
            if (data.shellId === shellId) {
                const lineType = data.type === 'error' ? 'error' :
                                data.type === 'system' ? 'system' : 'output';
                appendLines([{
                    type: lineType as TerminalLine['type'],
                    content: data.data
                }]);
            }
        };

        const handleClosed = (data: { shellId: string }) => {
            if (data.shellId === shellId) {
                setShellActive(false);
                shellWorkspaceRef.current = undefined;
                appendLines([{ type: 'system', content: 'Shell closed' }]);
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
        // Replace the current shell instead of leaving its container running
        await stopShell();
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
                shellWorkspaceRef.current = workspacePath;
                setShellActive(true);
                setActiveTab('shell');
            } else {
                appendLines([{
                    type: 'error',
                    content: result.error || 'Shell start error'
                }]);
            }
        } catch (err: any) {
            appendLines([{ type: 'error', content: err.message }]);
        }
    };

    const stopShell = async () => {
        if (shellId && shellActive) {
            await window.electronAPI.shell.stop(shellId);
        }
        setShellActive(false);
        shellWorkspaceRef.current = undefined;
    };

    // Stop the program being run (e.g. an endless loop)
    const stopRun = async () => {
        if (workspacePath) {
            await window.electronAPI.runner.stop(workspacePath);
        }
    };

    const executeInDocker = async (filePath: string, language: string) => {
        if (!workspacePath) {
            appendLines([{
                type: 'error',
                content: 'No project open. Open a folder first.',
            }]);
            return;
        }

        const fileName = filePath.split(/[/\\]/).pop() || filePath;
        appendLines([{
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

            const toLines = (text: string | undefined, type: TerminalLine['type']): TerminalLine[] =>
                (text || '').split('\n').filter(line => line.trim()).map(content => ({ type, content }));

            if (typeof result.exitCode === 'number') {
                // The program ran: show everything it printed, even when it failed
                const time = result.executionTime ? ` in ${result.executionTime}ms` : '';
                appendLines([
                    ...toLines(result.output, 'output'),
                    ...toLines(result.error, 'error'),
                    result.exitCode === 0
                        ? { type: 'success', content: `Done${time} (exit: 0)` }
                        : { type: 'error', content: `Exited with code ${result.exitCode}${time}` },
                ]);
            } else {
                // The runner itself failed (image download, container creation...)
                appendLines([{ type: 'error', content: `Error: ${result.error || 'Unknown error'}` }]);
            }
        } catch (err: any) {
            appendLines([{
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
            appendLines([{ type: 'input', content: `$ ${cmd}` }]);
            await window.electronAPI.shell.write(shellId, cmd);
            return;
        }

        appendLines([{ type: 'input', content: `$ ${cmd}` }]);

        if (cmd === 'clear') {
            setLines([{ type: 'system', content: 'Terminal cleared' }]);
            return;
        }

        if (cmd === 'help') {
            appendLines([
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
                rb: 'ruby', php: 'php', c: 'c', cpp: 'cpp', mjs: 'javascript',
            };
            const language = langMap[ext || ''] || 'plaintext';

            if (language === 'plaintext') {
                appendLines([{
                    type: 'error',
                    content: `Unrecognized extension: .${ext}`,
                }]);
                return;
            }

            const fullPath = workspacePath ? `${workspacePath}/${filePath}` : filePath;
            await executeInDocker(fullPath, language);
            return;
        }

        appendLines([{
            type: 'error',
            content: `Unknown command: ${cmd}. Type "help" for available commands.`,
        }]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !runBlocksInput) {
            executeCommand(currentInput);
            setCurrentInput('');
        }
        if (e.key === 'c' && e.ctrlKey && shellActive) {
            window.electronAPI.shell.write(shellId, '\x03');
        }
    };

    // Only the Terminal tab waits for a run: the shell stays usable
    const runBlocksInput = isRunning && activeTab === 'terminal';

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
                    {isRunning && (
                        <button className="icon-btn" title="Stop" onClick={stopRun}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
                        </button>
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
                        disabled={runBlocksInput}
                        placeholder={
                            runBlocksInput ? 'Running...' :
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
