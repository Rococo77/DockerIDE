import React, { useState, useEffect } from 'react';

interface DockerStatusBarProps {
    className?: string;
}

const DockerStatusBar: React.FC<DockerStatusBarProps> = ({ className }) => {
    const [isConnected, setIsConnected] = useState(false);
    const [containerCount, setContainerCount] = useState(0);

    useEffect(() => {
        checkDocker();
        const interval = setInterval(checkDocker, 30000);
        return () => clearInterval(interval);
    }, []);

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
        </div>
    );
};

export default DockerStatusBar;
