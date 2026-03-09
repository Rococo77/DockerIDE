import React, { useState, useEffect, useCallback } from 'react';

interface DockerPanelProps {
    workspacePath?: string;
}

interface ComposeService {
    name: string;
    state: string;
    status: string;
}

const DockerPanel: React.FC<DockerPanelProps> = ({ workspacePath }) => {
    const [hasCompose, setHasCompose] = useState(false);
    const [composeServices, setComposeServices] = useState<ComposeService[]>([]);
    const [composeLoading, setComposeLoading] = useState(false);
    const [composeError, setComposeError] = useState<string | null>(null);
    const [containers, setContainers] = useState<any[]>([]);

    const checkCompose = useCallback(async () => {
        if (!workspacePath) return;
        try {
            const result = await window.electronAPI.compose.hasFile(workspacePath);
            setHasCompose(result.hasCompose);
        } catch {
            setHasCompose(false);
        }
    }, [workspacePath]);

    const refreshComposeStatus = useCallback(async () => {
        if (!workspacePath || !hasCompose) return;
        try {
            const result = await window.electronAPI.compose.ps(workspacePath);
            if (result.success && result.services) {
                setComposeServices(result.services);
            }
        } catch {
            setComposeServices([]);
        }
    }, [workspacePath, hasCompose]);

    const refreshContainers = useCallback(async () => {
        try {
            const result = await window.electronAPI.runner.listProjectContainers();
            if (result.success && result.containers) {
                setContainers(result.containers);
            }
        } catch {
            setContainers([]);
        }
    }, []);

    useEffect(() => {
        checkCompose();
        refreshContainers();
    }, [workspacePath, checkCompose, refreshContainers]);

    useEffect(() => {
        if (hasCompose) {
            refreshComposeStatus();
            const interval = setInterval(refreshComposeStatus, 10000);
            return () => clearInterval(interval);
        }
    }, [hasCompose, refreshComposeStatus]);

    useEffect(() => {
        const interval = setInterval(refreshContainers, 10000);
        return () => clearInterval(interval);
    }, [refreshContainers]);

    const handleComposeUp = async () => {
        if (!workspacePath) return;
        setComposeLoading(true);
        setComposeError(null);
        try {
            const result = await window.electronAPI.compose.up(workspacePath, { build: true });
            if (result.success) {
                await refreshComposeStatus();
            } else {
                setComposeError(result.error || 'Failed to start services');
            }
        } catch (err: any) {
            setComposeError(err.message);
        } finally {
            setComposeLoading(false);
        }
    };

    const handleComposeDown = async () => {
        if (!workspacePath) return;
        setComposeLoading(true);
        setComposeError(null);
        try {
            const result = await window.electronAPI.compose.down(workspacePath);
            if (result.success) {
                setComposeServices([]);
            } else {
                setComposeError(result.error || 'Failed to stop services');
            }
        } catch (err: any) {
            setComposeError(err.message);
        } finally {
            setComposeLoading(false);
        }
    };

    return (
        <div className="docker-panel">
            <h3>Docker</h3>
            <p className="text-muted">Container management</p>

            {/* Compose Section */}
            {hasCompose && (
                <div className="docker-section">
                    <div className="docker-section-header">
                        <h4>Compose</h4>
                        <div className="docker-section-actions">
                            <button
                                className="icon-btn"
                                title="Start services"
                                onClick={handleComposeUp}
                                disabled={composeLoading}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            </button>
                            <button
                                className="icon-btn"
                                title="Stop services"
                                onClick={handleComposeDown}
                                disabled={composeLoading}
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
                            </button>
                        </div>
                    </div>
                    {composeError && (
                        <div className="docker-error">{composeError}</div>
                    )}
                    {composeServices.length > 0 ? (
                        <div className="compose-services">
                            {composeServices.map((svc) => (
                                <div key={svc.name} className="compose-service">
                                    <span className={`status-dot ${svc.state === 'running' ? 'running' : 'stopped'}`} />
                                    <span className="service-name">{svc.name}</span>
                                    <span className="service-status">{svc.status}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <p>No services running</p>
                        </div>
                    )}
                </div>
            )}

            {/* Project Containers */}
            <div className="docker-section">
                <h4>Project Containers</h4>
                {containers.length > 0 ? (
                    <div className="container-list">
                        {containers.map((c: any) => (
                            <div key={c.id || c.name} className="container-item">
                                <span className={`status-dot ${c.state === 'running' ? 'running' : 'stopped'}`} />
                                <span className="container-name">{c.name?.replace(/^\//, '') || c.id?.substring(0, 12)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <p>No active containers</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(DockerPanel);
