import React from 'react';
import ContainerDashboard from './components/ContainerDashboard';
import ImageMarketplace from './components/ImageMarketplace';
import { DockerStatus } from './components/DockerStatus';

const App: React.FC = () => {
    return (
        <div style={{ display: 'flex', height: '100vh' }}>
            <aside style={{ width: 260, borderRight: '1px solid #eee', padding: 12 }}>
                <h2>Docker IDE</h2>
                <DockerStatus />
            </aside>
            <main style={{ flex: 1, padding: 12 }}>
                <h1>Container Dashboard</h1>
                <ContainerDashboard />
                <hr />
                <ImageMarketplace />
            </main>
        </div>
    );
};

export default App;
