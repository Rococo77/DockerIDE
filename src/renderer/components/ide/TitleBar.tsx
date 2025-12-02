import React, { useState } from 'react';

interface TitleBarProps {
    projectName?: string;
    onNewProject: () => void;
    onOpenFolder: () => void;
}

const TitleBar: React.FC<TitleBarProps> = ({ projectName, onNewProject, onOpenFolder }) => {
    const [showFileMenu, setShowFileMenu] = useState(false);

    const handleMinimize = () => {
        window.electronAPI?.window?.minimize?.();
    };

    const handleMaximize = () => {
        window.electronAPI?.window?.maximize?.();
    };

    const handleClose = () => {
        window.electronAPI?.window?.close?.();
    };

    return (
        <div className="title-bar">
            <div className="title-bar-left">
                <div className="app-icon">🐳</div>
                
                {/* Menu Fichier */}
                <div className="menu-container">
                    <button 
                        className="menu-button"
                        onClick={() => setShowFileMenu(!showFileMenu)}
                        onBlur={() => setTimeout(() => setShowFileMenu(false), 150)}
                    >
                        Fichier
                    </button>
                    {showFileMenu && (
                        <div className="menu-dropdown">
                            <button className="menu-item" onClick={() => { onNewProject(); setShowFileMenu(false); }}>
                                <span className="menu-icon">📁</span>
                                <span>Nouveau Projet...</span>
                                <span className="menu-shortcut">Ctrl+Shift+N</span>
                            </button>
                            <button className="menu-item" onClick={() => { onOpenFolder(); setShowFileMenu(false); }}>
                                <span className="menu-icon">📂</span>
                                <span>Ouvrir un dossier...</span>
                                <span className="menu-shortcut">Ctrl+O</span>
                            </button>
                            <div className="menu-separator" />
                            <button className="menu-item" onClick={handleClose}>
                                <span className="menu-icon">🚪</span>
                                <span>Quitter</span>
                                <span className="menu-shortcut">Alt+F4</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="title-bar-center">
                <span className="title-text">
                    {projectName ? `${projectName} - Docker IDE` : 'Docker IDE'}
                </span>
            </div>

            <div className="title-bar-right">
                <button className="title-bar-btn new-project-btn" onClick={onNewProject} title="Nouveau Projet">
                    <span>+ Nouveau Projet</span>
                </button>
                <div className="window-controls">
                    <button className="window-btn minimize" onClick={handleMinimize}>─</button>
                    <button className="window-btn maximize" onClick={handleMaximize}>□</button>
                    <button className="window-btn close" onClick={handleClose}>×</button>
                </div>
            </div>
        </div>
    );
};

export default TitleBar;
