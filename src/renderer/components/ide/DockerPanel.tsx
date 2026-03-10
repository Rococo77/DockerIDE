import React, { useState, useEffect, useCallback, useRef } from 'react';

interface ContainerInfo {
    Id: string;
    Names: string[];
    Image: string;
    State: string;
    Status: string;
    Ports: { PrivatePort: number; PublicPort?: number; Type: string }[];
    Created: number;
}

interface ImageInfo {
    Id: string;
    RepoTags: string[] | null;
    Size: number;
    Created: number;
}

type PanelSection = 'containers' | 'images' | 'compose';

const DockerPanel: React.FC<{ workspacePath?: string }> = ({ workspacePath }) => {
    const [section, setSection] = useState<PanelSection>('containers');
    const [containers, setContainers] = useState<ContainerInfo[]>([]);
    const [images, setImages] = useState<ImageInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [hasCompose, setHasCompose] = useState(false);
    const [composeServices, setComposeServices] = useState<string>('');
    const [composeLoading, setComposeLoading] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const loadContainers = useCallback(async () => {
        try {
            const result = await window.electronAPI.docker.listContainers(true);
            if (result.success && result.data) {
                setContainers(result.data);
                setError(null);
            }
        } catch (err) {
            setError('Impossible de charger les conteneurs');
        }
    }, []);

    const loadImages = useCallback(async () => {
        try {
            const result = await window.electronAPI.docker.listImages();
            if (result.success && result.data) {
                setImages(result.data);
            }
        } catch {
            // silent
        }
    }, []);

    const checkCompose = useCallback(async () => {
        if (!workspacePath) {
            setHasCompose(false);
            return;
        }
        try {
            const result = await window.electronAPI.compose.hasFile(workspacePath);
            setHasCompose(result.success && result.data);
        } catch {
            setHasCompose(false);
        }
    }, [workspacePath]);

    const refresh = useCallback(async () => {
        setLoading(true);
        await Promise.all([loadContainers(), loadImages(), checkCompose()]);
        setLoading(false);
    }, [loadContainers, loadImages, checkCompose]);

    // Initial load + auto-refresh every 5s
    useEffect(() => {
        refresh();
        intervalRef.current = setInterval(loadContainers, 5000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [refresh, loadContainers]);

    // Re-check compose when workspace changes
    useEffect(() => {
        checkCompose();
    }, [workspacePath, checkCompose]);

    // Container actions
    const startContainer = async (id: string) => {
        setActionLoading(id);
        try {
            await window.electronAPI.docker.startContainer(id);
            await loadContainers();
        } catch { /* handled by refresh */ }
        setActionLoading(null);
    };

    const stopContainer = async (id: string) => {
        setActionLoading(id);
        try {
            await window.electronAPI.docker.stopContainer(id);
            await loadContainers();
        } catch { /* handled by refresh */ }
        setActionLoading(null);
    };

    const removeContainer = async (id: string) => {
        setActionLoading(id);
        try {
            await window.electronAPI.docker.removeContainer(id, { force: true });
            await loadContainers();
        } catch { /* handled by refresh */ }
        setActionLoading(null);
    };

    const removeImage = async (id: string) => {
        setActionLoading(id);
        try {
            await window.electronAPI.docker.removeImage(id, { force: true });
            await loadImages();
        } catch { /* handled by refresh */ }
        setActionLoading(null);
    };

    // Compose actions
    const composeUp = async () => {
        if (!workspacePath) return;
        setComposeLoading(true);
        try {
            await window.electronAPI.compose.up(workspacePath, { build: true });
            await loadContainers();
        } catch { /* */ }
        setComposeLoading(false);
    };

    const composeDown = async () => {
        if (!workspacePath) return;
        setComposeLoading(true);
        try {
            await window.electronAPI.compose.down(workspacePath);
            await loadContainers();
        } catch { /* */ }
        setComposeLoading(false);
    };

    const composePs = async () => {
        if (!workspacePath) return;
        try {
            const result = await window.electronAPI.compose.ps(workspacePath);
            if (result.success) {
                setComposeServices(result.data || 'Aucun service actif');
            }
        } catch { /* */ }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const getContainerName = (c: ContainerInfo) => {
        return c.Names?.[0]?.replace(/^\//, '') || c.Id.slice(0, 12);
    };

    const getStateColor = (state: string) => {
        switch (state) {
            case 'running': return '#4caf50';
            case 'exited': return '#ff9800';
            case 'created': return '#2196f3';
            case 'paused': return '#9c27b0';
            default: return '#757575';
        }
    };

    const runningCount = containers.filter(c => c.State === 'running').length;
    const stoppedCount = containers.filter(c => c.State !== 'running').length;

    return (
        <div className="docker-panel">
            <div className="docker-panel-header">
                <h3>Docker</h3>
                <button className="icon-btn" onClick={refresh} title="Rafraichir">
                    {loading ? '...' : '↻'}
                </button>
            </div>

            {error && <div className="docker-error">{error}</div>}

            {/* Summary */}
            <div className="docker-summary">
                <span className="docker-stat">
                    <span className="docker-stat-dot" style={{ background: '#4caf50' }} />
                    {runningCount} actif{runningCount !== 1 ? 's' : ''}
                </span>
                <span className="docker-stat">
                    <span className="docker-stat-dot" style={{ background: '#ff9800' }} />
                    {stoppedCount} arrêté{stoppedCount !== 1 ? 's' : ''}
                </span>
                <span className="docker-stat">
                    {images.length} image{images.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Section tabs */}
            <div className="docker-tabs">
                <button
                    className={`docker-tab ${section === 'containers' ? 'active' : ''}`}
                    onClick={() => setSection('containers')}
                >
                    Conteneurs
                </button>
                <button
                    className={`docker-tab ${section === 'images' ? 'active' : ''}`}
                    onClick={() => setSection('images')}
                >
                    Images
                </button>
                {hasCompose && (
                    <button
                        className={`docker-tab ${section === 'compose' ? 'active' : ''}`}
                        onClick={() => { setSection('compose'); composePs(); }}
                    >
                        Compose
                    </button>
                )}
            </div>

            {/* Containers */}
            {section === 'containers' && (
                <div className="docker-list">
                    {containers.length === 0 ? (
                        <div className="empty-state">
                            <p>Aucun conteneur</p>
                        </div>
                    ) : (
                        containers.map(c => (
                            <div key={c.Id} className="docker-item">
                                <div className="docker-item-header">
                                    <span
                                        className="docker-item-dot"
                                        style={{ background: getStateColor(c.State) }}
                                    />
                                    <span className="docker-item-name" title={c.Id}>
                                        {getContainerName(c)}
                                    </span>
                                </div>
                                <div className="docker-item-meta">
                                    <span className="docker-item-image">{c.Image}</span>
                                    <span className="docker-item-status">{c.Status}</span>
                                </div>
                                {c.Ports.length > 0 && (
                                    <div className="docker-item-ports">
                                        {c.Ports.filter(p => p.PublicPort).map((p, i) => (
                                            <span key={i} className="port-badge">
                                                {p.PublicPort}:{p.PrivatePort}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <div className="docker-item-actions">
                                    {actionLoading === c.Id ? (
                                        <span className="action-loading">...</span>
                                    ) : c.State === 'running' ? (
                                        <button
                                            className="docker-action-btn stop"
                                            onClick={() => stopContainer(c.Id)}
                                            title="Arrêter"
                                        >
                                            ■
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                className="docker-action-btn start"
                                                onClick={() => startContainer(c.Id)}
                                                title="Démarrer"
                                            >
                                                ▶
                                            </button>
                                            <button
                                                className="docker-action-btn remove"
                                                onClick={() => removeContainer(c.Id)}
                                                title="Supprimer"
                                            >
                                                ✕
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Images */}
            {section === 'images' && (
                <div className="docker-list">
                    {images.length === 0 ? (
                        <div className="empty-state">
                            <p>Aucune image</p>
                        </div>
                    ) : (
                        images.map(img => {
                            const tag = img.RepoTags?.[0] || img.Id.slice(7, 19);
                            return (
                                <div key={img.Id} className="docker-item">
                                    <div className="docker-item-header">
                                        <span className="docker-item-name" title={img.Id}>
                                            {tag}
                                        </span>
                                    </div>
                                    <div className="docker-item-meta">
                                        <span className="docker-item-size">{formatSize(img.Size)}</span>
                                    </div>
                                    <div className="docker-item-actions">
                                        {actionLoading === img.Id ? (
                                            <span className="action-loading">...</span>
                                        ) : (
                                            <button
                                                className="docker-action-btn remove"
                                                onClick={() => removeImage(img.Id)}
                                                title="Supprimer"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Compose */}
            {section === 'compose' && hasCompose && (
                <div className="docker-compose-section">
                    <div className="compose-actions">
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={composeUp}
                            disabled={composeLoading}
                        >
                            {composeLoading ? '...' : '▶ Up'}
                        </button>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={composeDown}
                            disabled={composeLoading}
                        >
                            ■ Down
                        </button>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={composePs}
                        >
                            ↻ Status
                        </button>
                    </div>
                    {composeServices && (
                        <pre className="compose-output">{composeServices}</pre>
                    )}
                </div>
            )}
        </div>
    );
};

export default DockerPanel;
