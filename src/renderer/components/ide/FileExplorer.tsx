import React, { useState, useEffect, useCallback } from 'react';

interface FileNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: FileNode[];
    extension?: string;
}

interface FileExplorerProps {
    onFileSelect: (path: string, language: string) => void;
    selectedFile?: string;
    workspacePath?: string;
    onWorkspaceChange?: (path: string) => void;
    onNewProject?: () => void;
}

const FileIcon: React.FC<{ name: string; type: 'file' | 'directory'; expanded?: boolean }> = ({
    name,
    type,
    expanded,
}) => {
    if (type === 'directory') {
        return (
            <span className="file-icon file-icon-svg">
                {expanded ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dcb67a" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/><line x1="3" y1="12" x2="21" y2="12" strokeOpacity="0.3"/></svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dcb67a" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                )}
            </span>
        );
    }

    const ext = name.split('.').pop()?.toLowerCase();
    const colorMap: Record<string, string> = {
        py: '#3572A5',
        js: '#f1e05a',
        ts: '#3178c6',
        jsx: '#61dafb',
        tsx: '#3178c6',
        json: '#a8b1c2',
        md: '#519aba',
        txt: '#a8b1c2',
        yml: '#cb171e',
        yaml: '#cb171e',
        html: '#e44d26',
        css: '#563d7c',
        java: '#b07219',
        go: '#00ADD8',
        rs: '#dea584',
        rb: '#CC342D',
        php: '#4F5D95',
        c: '#555555',
        cpp: '#f34b7d',
        h: '#555555',
    };

    const labelMap: Record<string, string> = {
        py: 'PY', js: 'JS', ts: 'TS', jsx: 'JX', tsx: 'TX',
        json: '{}', md: 'MD', txt: 'TX', yml: 'YM', yaml: 'YM',
        html: '<>', css: '#', java: 'JV', go: 'GO', rs: 'RS',
        rb: 'RB', php: 'HP', c: 'C', cpp: 'C+', h: 'H',
    };

    const isDockerfile = name.toLowerCase() === 'dockerfile' || name.toLowerCase().startsWith('dockerfile.');
    const isCompose = name === 'docker-compose.yml' || name === 'docker-compose.yaml' || name === 'compose.yml' || name === 'compose.yaml';

    if (isDockerfile || isCompose) {
        return <span className="file-icon file-icon-label" style={{ color: '#0db7ed' }}>DK</span>;
    }

    const color = colorMap[ext || ''] || '#a8b1c2';
    const label = labelMap[ext || ''] || '--';

    return <span className="file-icon file-icon-label" style={{ color }}>{label}</span>;
};

interface TreeNodeProps {
    node: FileNode;
    depth: number;
    onFileSelect: (path: string) => void;
    selectedFile?: string;
    expandedPaths: Set<string>;
    onToggle: (path: string) => void;
}

const FileTreeNode: React.FC<TreeNodeProps> = ({
    node,
    depth,
    onFileSelect,
    selectedFile,
    expandedPaths,
    onToggle,
}) => {
    const isSelected = selectedFile === node.path;
    const isExpanded = expandedPaths.has(node.path);

    const handleClick = () => {
        if (node.type === 'directory') {
            onToggle(node.path);
        } else {
            onFileSelect(node.path);
        }
    };

    return (
        <div>
            <div
                className={`file-tree-item ${isSelected ? 'selected' : ''}`}
                style={{ paddingLeft: depth * 16 + 8 }}
                onClick={handleClick}
            >
                <FileIcon name={node.name} type={node.type} expanded={isExpanded} />
                <span className="file-name">{node.name}</span>
            </div>
            {node.type === 'directory' && isExpanded && node.children && (
                <div className="file-tree-children">
                    {node.children.map((child) => (
                        <FileTreeNode
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            onFileSelect={onFileSelect}
                            selectedFile={selectedFile}
                            expandedPaths={expandedPaths}
                            onToggle={onToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const FileExplorer: React.FC<FileExplorerProps> = ({
    onFileSelect,
    selectedFile,
    workspacePath,
    onWorkspaceChange,
    onNewProject,
}) => {
    const [fileTree, setFileTree] = useState<FileNode | null>(null);
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load directory contents
    const loadDirectory = useCallback(async (dirPath: string): Promise<FileNode | null> => {
        try {
            const result = await window.electronAPI.fs.readDirectory(dirPath, 2);
            if (result.success && result.files) {
                const dirName = dirPath.split(/[/\\]/).pop() || 'Project';
                return {
                    name: dirName,
                    path: dirPath,
                    type: 'directory',
                    children: result.files,
                };
            }
            return null;
        } catch (err: any) {
            console.error('Error loading directory:', err);
            setError(err.message);
            return null;
        }
    }, []);

    // Load workspace when path changes
    useEffect(() => {
        if (workspacePath) {
            setLoading(true);
            setError(null);
            loadDirectory(workspacePath)
                .then((tree) => {
                    setFileTree(tree);
                    if (tree) {
                        // Expand root by default
                        setExpandedPaths(new Set([tree.path]));
                    }
                })
                .finally(() => setLoading(false));
        } else {
            setFileTree(null);
        }
    }, [workspacePath, loadDirectory]);

    // Toggle folder expansion
    const toggleFolder = async (path: string) => {
        const newExpanded = new Set(expandedPaths);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        } else {
            newExpanded.add(path);
        }
        setExpandedPaths(newExpanded);
    };

    // Handle file selection
    const handleFileSelect = async (filePath: string) => {
        try {
            const result = await window.electronAPI.fs.getLanguage(filePath);
            onFileSelect(filePath, result.language || 'plaintext');
        } catch (err) {
            onFileSelect(filePath, 'plaintext');
        }
    };

    // Open folder dialog
    const handleOpenFolder = async () => {
        try {
            const result = await window.electronAPI.fs.openFolder();
            if (result.success && result.path) {
                onWorkspaceChange?.(result.path);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Refresh file tree
    const handleRefresh = async () => {
        if (workspacePath) {
            setLoading(true);
            const tree = await loadDirectory(workspacePath);
            setFileTree(tree);
            setLoading(false);
        }
    };

    // No project open state
    if (!workspacePath || !fileTree) {
        return (
            <div className="file-explorer empty-state">
                <h3>Explorateur</h3>
                <div className="no-project">
                    <p>Aucun projet ouvert</p>
                    <button className="btn btn-primary" onClick={onNewProject}>
                        + Nouveau projet
                    </button>
                    <button className="btn btn-secondary" onClick={handleOpenFolder}>
                        Ouvrir un dossier
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="file-explorer">
            <div className="explorer-header">
                <h3>Explorateur</h3>
                <div className="explorer-actions">
                    <button
                        title="Nouveau projet"
                        className="icon-btn"
                        onClick={onNewProject}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                    <button
                        title="Ouvrir un dossier"
                        className="icon-btn"
                        onClick={handleOpenFolder}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                    </button>
                    <button
                        title="Rafraichir"
                        className="icon-btn"
                        onClick={handleRefresh}
                        disabled={loading}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                    </button>
                </div>
            </div>

            {loading && (
                <div className="explorer-loading">Chargement...</div>
            )}

            {error && (
                <div className="explorer-error">{error}</div>
            )}

            {!loading && !error && (
                <div className="file-tree">
                    <FileTreeNode
                        node={fileTree}
                        depth={0}
                        onFileSelect={handleFileSelect}
                        selectedFile={selectedFile}
                        expandedPaths={expandedPaths}
                        onToggle={toggleFolder}
                    />
                </div>
            )}
        </div>
    );
};

export default FileExplorer;
