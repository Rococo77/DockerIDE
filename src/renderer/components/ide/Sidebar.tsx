import React from 'react';

interface SidebarProps {
    activeTab: 'files' | 'extensions' | 'docker';
    onTabChange: (tab: 'files' | 'extensions' | 'docker') => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: 'files' as const, icon: 'files', title: 'Explorateur', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg> },
        { id: 'extensions' as const, icon: 'extensions', title: 'Extensions', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg> },
        { id: 'docker' as const, icon: 'docker', title: 'Docker', svg: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="11" width="4" height="4" rx=".5"/><rect x="6" y="11" width="4" height="4" rx=".5"/><rect x="11" y="11" width="4" height="4" rx=".5"/><rect x="6" y="6" width="4" height="4" rx=".5"/><rect x="11" y="6" width="4" height="4" rx=".5"/><rect x="16" y="11" width="4" height="4" rx=".5"/><rect x="11" y="1" width="4" height="4" rx=".5"/><path d="M1 17c4 4 16 4 22-1"/></svg> },
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
                    {tab.svg}
                </button>
            ))}
        </div>
    );
};

export default React.memo(Sidebar);
