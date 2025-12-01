// src/renderer/components/DockerStatus.tsx
import React, { useEffect, useState } from 'react';

interface DockerInfo {
    isConnected: boolean;
    version?: string;
    os?: string;
    architecture?: string;
    containerCount?: number;
    imageCount?: number;
    error?: string;
}

export const DockerStatus: React.FC = () => {
    const [dockerInfo, setDockerInfo] = useState<DockerInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const checkDocker = async () => {
        setLoading(true);
        try {
            if (!window.electronAPI || !window.electronAPI.docker) {
                setDockerInfo({ isConnected: false, error: 'electronAPI indisponible pour le moment' });
                return;
            }
            const result = await window.electronAPI.docker.checkConnection();
            console.log('[DockerStatus] checkConnection result ->', result);
            if (result.success) {
                setDockerInfo(result.data);
            } else {
                setDockerInfo({ isConnected: false, error: result.error });
            }
        } catch (error: any) {
            setDockerInfo({
                isConnected: false,
                error: error?.message ?? 'Erreur lors de la vérification de Docker'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkDocker();
        // Vérifier toutes les 30 secondes
        const interval = setInterval(checkDocker, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
                <div className="w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
                <span className="text-sm text-gray-600">Vérification de Docker...</span>
            </div>
        );
    }

    if (!dockerInfo?.isConnected) {
        return (
            <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm font-semibold text-red-700">
            Docker non connecté
          </span>
                </div>
                <p className="text-sm text-red-600">{dockerInfo?.error}</p>
                <button
                    onClick={checkDocker}
                    className="self-start px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                    Réessayer
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-semibold text-green-700">
            Docker connecté
          </span>
                </div>
                <button
                    onClick={checkDocker}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                >
                    Rafraîchir
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                    <span className="text-gray-600">Version:</span>
                    <span className="ml-2 font-medium text-gray-800">
            {dockerInfo.version}
          </span>
                </div>
                <div>
                    <span className="text-gray-600">OS:</span>
                    <span className="ml-2 font-medium text-gray-800">
            {dockerInfo.os}
          </span>
                </div>
                <div>
                    <span className="text-gray-600">Conteneurs:</span>
                    <span className="ml-2 font-medium text-gray-800">
            {dockerInfo.containerCount}
          </span>
                </div>
                <div>
                    <span className="text-gray-600">Images:</span>
                    <span className="ml-2 font-medium text-gray-800">
            {dockerInfo.imageCount}
          </span>
                </div>
                {dockerInfo.usedHost && (
                    <div>
                        <span className="text-gray-600">Transport:</span>
                        <span className="ml-2 font-medium text-gray-800">{dockerInfo.usedHost}</span>
                    </div>
                )}
            </div>
        </div>
    );
};