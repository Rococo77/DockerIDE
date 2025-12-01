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
        return <span className="file-icon">{expanded ? '📂' : '📁'}</span>;
    }

    // Icônes par extension
    const ext = name.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = {
        py: '🐍',
        js: '📜',
        ts: '📘',
        jsx: '⚛️',
        tsx: '⚛️',
        json: '📋',
        md: '📝',
        txt: '📄',
        dockerfile: '🐳',
        yml: '⚙️',
        yaml: '⚙️',
        html: '🌐',
        css: '🎨',
        java: '☕',
        go: '🐹',
        rs: '🦀',
        rb: '💎',
        php: '🐘',
        c: '⚡',
        cpp: '⚡',
        h: '⚡',
    };

    if (name.toLowerCase() === 'dockerfile') return <span className="file-icon">🐳</span>;
    return <span className="file-icon">{icons[ext || ''] || '📄'}</span>;
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
                        ➕ Nouveau projet
                    </button>
                    <button className="btn btn-secondary" onClick={handleOpenFolder}>
                        📂 Ouvrir un dossier
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
                        ➕
                    </button>
                    <button
                        title="Ouvrir un dossier"
                        className="icon-btn"
                        onClick={handleOpenFolder}
                    >
                        📂
                    </button>
                    <button
                        title="Rafraîchir"
                        className="icon-btn"
                        onClick={handleRefresh}
                        disabled={loading}
                    >
                        🔄
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
