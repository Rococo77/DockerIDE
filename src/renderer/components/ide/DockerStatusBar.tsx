import React, { useState, useEffect, useCallback } from 'react';

interface DockerStatusBarProps {
    className?: string;
    workspacePath?: string;
}

interface ProjectContainerInfo {
    id: string;
    name: string;
    image: string;
    status: 'running' | 'stopped' | 'creating';
    projectPath: string;
}

const DockerStatusBar: React.FC<DockerStatusBarProps> = ({ className, workspacePath }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [containerCount, setContainerCount] = useState(0);
    const [projectContainer, setProjectContainer] = useState<ProjectContainerInfo | null>(null);

    const checkDocker = useCallback(async () => {
        if (!window.electronAPI?.docker) {
            setIsConnected(false);
            return;
        }

        try {
            const result = await window.electronAPI.docker.checkConnection();
            if (result.success && result.data?.isConnected) {
                setIsConnected(true);
                setContainerCount(result.data.containerCount || 0);
            } else {
                setIsConnected(false);
            }
        } catch {
            setIsConnected(false);
        }
    }, []);

    const checkProjectContainer = useCallback(async () => {
        if (!workspacePath || !window.electronAPI?.runner?.getProjectContainer) {
            setProjectContainer(null);
            return;
        }

        try {
            const result = await window.electronAPI.runner.getProjectContainer(workspacePath);
            if (result.success && result.container) {
                setProjectContainer(result.container);
            } else {
                setProjectContainer(null);
            }
        } catch {
            setProjectContainer(null);
        }
    }, [workspacePath]);

    useEffect(() => {
        checkDocker();
        const interval = setInterval(checkDocker, 15000);
        return () => clearInterval(interval);
    }, [checkDocker]);

    useEffect(() => {
        if (workspacePath) {
            checkProjectContainer();
            const interval = setInterval(checkProjectContainer, 8000);
            return () => clearInterval(interval);
        } else {
            setProjectContainer(null);
        }
    }, [workspacePath, checkProjectContainer]);

    const handleStopContainer = async () => {
        if (!workspacePath) return;
        try {
            await window.electronAPI.runner.stopProjectContainer(workspacePath);
            await checkProjectContainer();
        } catch (error) {
            console.error('Failed to stop container:', error);
        }
    };

    const handleRemoveContainer = async () => {
        if (!workspacePath) return;
        try {
            await window.electronAPI.runner.removeProjectContainer(workspacePath);
            setProjectContainer(null);
        } catch (error) {
            console.error('Failed to remove container:', error);
        }
    };

    return (
        <div className={`docker-statusbar ${className || ''}`}>
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                <span className={`status-dot-inline ${isConnected ? 'active' : ''}`}></span>
                Docker {isConnected ? 'Connected' : 'Disconnected'}
            </span>

            {isConnected && containerCount > 0 && (
                <span className="container-count">
                    {containerCount} container{containerCount > 1 ? 's' : ''}
                </span>
            )}

            {projectContainer && (
                <div className="project-container-status">
                    <span className={`container-badge ${projectContainer.status}`}>
                        {projectContainer.name.replace('docker-ide-project-', '')}
                    </span>
                    <span className={`status-dot ${projectContainer.status}`}></span>
                    {projectContainer.status === 'running' && (
                        <button
                            className="container-action stop"
                            onClick={handleStopContainer}
                            title="Stop container"
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="1"/></svg>
                        </button>
                    )}
                    <button
                        className="container-action remove"
                        onClick={handleRemoveContainer}
                        title="Remove container"
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default DockerStatusBar;
