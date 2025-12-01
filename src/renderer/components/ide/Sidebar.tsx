import React from 'react';

interface SidebarProps {
    activeTab: 'files' | 'extensions' | 'docker';
    onTabChange: (tab: 'files' | 'extensions' | 'docker') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: 'files' as const, icon: '📁', title: 'Explorateur' },
        { id: 'extensions' as const, icon: '🧩', title: 'Extensions (Images Docker)' },
        { id: 'docker' as const, icon: '🐳', title: 'Docker' },
    ];

    return (
        <div className="sidebar-icons">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`sidebar-icon ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.id)}
                    title={tab.title}
                >
                    <span style={{ fontSize: 24 }}>{tab.icon}</span>
                </button>
            ))}
        </div>
    );
};

export default Sidebar;
