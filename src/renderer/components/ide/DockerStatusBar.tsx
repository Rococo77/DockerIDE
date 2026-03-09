import React, { useState, useEffect } from 'react';

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

    useEffect(() => {
        checkDocker();
        const interval = setInterval(checkDocker, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (workspacePath) {
            checkProjectContainer();
            const interval = setInterval(checkProjectContainer, 5000);
            return () => clearInterval(interval);
        } else {
            setProjectContainer(null);
        }
    }, [workspacePath]);

    const checkDocker = async () => {
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
    };

    const checkProjectContainer = async () => {
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
    };

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
                🐳 Docker {isConnected ? 'Connecté' : 'Déconnecté'}
            </span>
            
            {isConnected && containerCount > 0 && (
                <span className="container-count">
                    {containerCount} conteneur{containerCount > 1 ? 's' : ''}
                </span>
            )}

            {projectContainer && (
                <div className="project-container-status">
                    <span className={`container-badge ${projectContainer.status}`}>
                        📦 {projectContainer.name.replace('docker-ide-project-', '')}
                    </span>
                    <span className={`status-dot ${projectContainer.status}`}></span>
                    {projectContainer.status === 'running' && (
                        <button 
                            className="container-action stop" 
                            onClick={handleStopContainer}
                            title="Arrêter le conteneur"
                        >
                            ⏹
                        </button>
                    )}
                    <button 
                        className="container-action remove" 
                        onClick={handleRemoveContainer}
                        title="Supprimer le conteneur"
                    >
                        🗑
                    </button>
                </div>
            )}
        </div>
    );
};

export default DockerStatusBar;
