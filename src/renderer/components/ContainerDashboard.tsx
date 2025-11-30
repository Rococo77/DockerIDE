import React, { useEffect, useState } from 'react';

interface ContainerInfo {
    Id: string;
    Names: string[];
    Image: string;
    State: string;
    Status?: string;
}

const ContainerDashboard: React.FC = () => {
    const [containers, setContainers] = useState<ContainerInfo[]>([]);
    const [images, setImages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState<string>('');
    const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

    const refresh = async () => {
        setLoading(true);
        try {
            if (!window.electronAPI || !window.electronAPI.docker) {
                setContainers([]);
                setImages([]);
                return;
            }
            const cRes = await window.electronAPI.docker.listContainers(true);
            if (cRes.success) setContainers(cRes.data as ContainerInfo[]);
            const iRes = await window.electronAPI.docker.listImages();
            if (iRes.success) setImages(iRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, 10000);
        return () => clearInterval(interval);
    }, []);

    const startContainer = async (id: string) => {
        await window.electronAPI.docker.startContainer(id);
        await refresh();
    };

    const stopContainer = async (id: string) => {
        await window.electronAPI.docker.stopContainer(id);
        await refresh();
    };

    const removeContainer = async (id: string) => {
        await window.electronAPI.docker.removeContainer(id, { force: true });
        await refresh();
    };

    const showLogs = async (id: string) => {
        const res = await window.electronAPI.docker.getContainerLogs(id, { stdout: true, stderr: true, tail: 200 });
        if (res.success) {
            setLogs(res.data);
            setSelectedContainer(id);
        }
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={refresh}>
                    {loading ? 'Chargement...' : 'Rafraîchir'}
                </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h3 className="font-semibold mb-2">Conteneurs</h3>
                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Image</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {containers.map((c) => (
                                <tr key={c.Id}>
                                    <td>{c.Names?.[0] ?? c.Id}</td>
                                    <td>{c.Image}</td>
                                    <td>{c.State} - {c.Status}</td>
                                    <td>
                                        {c.State !== 'running' ? (
                                            <button className="mr-2" onClick={() => startContainer(c.Id)}>Start</button>
                                        ) : (
                                            <button className="mr-2" onClick={() => stopContainer(c.Id)}>Stop</button>
                                        )}
                                        <button className="mr-2" onClick={() => showLogs(c.Id)}>Logs</button>
                                        <button className="text-red-600" onClick={() => removeContainer(c.Id)}>Remove</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div>
                    <h3 className="font-semibold mb-2">Images</h3>
                    <ul>
                        {images.map((img: any) => (
                            <li key={img.Id}>{img.RepoTags?.[0] ?? img.Id}</li>
                        ))}
                    </ul>
                </div>
            </div>

            {selectedContainer && (
                <div className="mt-4">
                    <h4>Logs ({selectedContainer})</h4>
                    <pre style={{ maxHeight: 240, overflowY: 'auto', background: '#0b1220', color: '#d1d5db', padding: 12 }}>
                        {logs}
                    </pre>
                </div>
            )}
        </div>
    );
};

export default ContainerDashboard;
