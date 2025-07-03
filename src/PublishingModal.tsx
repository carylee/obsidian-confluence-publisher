import { Modal, App } from "obsidian";
import ReactDOM from "react-dom";
import React, { useState, useEffect } from "react";

export interface PublishingStatus {
    currentFile?: string;
    filesProcessed: number;
    totalFiles: number;
    stage: 'preparing' | 'processing' | 'finalizing';
}

export interface PublishingModalProps {
    status: PublishingStatus;
}

const PublishingView: React.FC<PublishingModalProps> = ({ status }) => {
    const { currentFile, filesProcessed, totalFiles, stage } = status;
    const [dots, setDots] = useState('.');
    
    // Create animated dots effect
    useEffect(() => {
        const interval = setInterval(() => {
            setDots(d => d === '...' ? '.' : d + '.');
        }, 500);
        return () => clearInterval(interval);
    }, []);
    
    // Calculate progress percentage
    const progress = totalFiles > 0 ? Math.round((filesProcessed / totalFiles) * 100) : 0;
    
    // Get status message based on stage
    const getStageMessage = () => {
        switch(stage) {
            case 'preparing':
                return `Preparing files for upload${dots}`;
            case 'processing':
                return `Processing files${dots}`;
            case 'finalizing':
                return `Finalizing publication${dots}`;
            default:
                return `Publishing to Confluence${dots}`;
        }
    };

    return (
        <div className="confluence-publish-modal">
            <div className="confluence-publish-modal-header">
                <h1 className="confluence-publish-modal-title">Publishing to Confluence</h1>
            </div>
            
            <div className="confluence-publish-modal-summary-box">
                <p className="confluence-publish-modal-summary-text">
                    {getStageMessage()}
                </p>
            </div>
            
            {/* Progress bar */}
            <div className="confluence-publish-progress-container">
                <div 
                    className="confluence-publish-progress-bar" 
                    style={{ width: `${progress}%` }}
                />
                <div className="confluence-publish-progress-text">
                    {totalFiles > 0 ? `${filesProcessed} of ${totalFiles} files` : 'Scanning files...'}
                </div>
            </div>
            
            {/* Current file being processed */}
            {currentFile && (
                <div className="confluence-publish-current-file">
                    <p className="confluence-publish-current-file-label">Currently processing:</p>
                    <p className="confluence-publish-current-file-name">{currentFile}</p>
                </div>
            )}
            
            <p className="confluence-publish-modal-footnote">
                This may take a few moments depending on the number of files and diagrams.
            </p>
        </div>
    );
};

export class PublishingModal extends Modal {
    status: PublishingStatus;
    private reactRoot: HTMLDivElement | null = null;
    
    constructor(app: App, initialStatus: PublishingStatus) {
        super(app);
        this.status = initialStatus;
    }
    
    updateStatus(newStatus: Partial<PublishingStatus>) {
        // Update status without calling onOpen again
        this.status = { ...this.status, ...newStatus };
        
        // Re-render only if the component is already mounted
        if (this.reactRoot) {
            ReactDOM.render(
                React.createElement(PublishingView, { status: this.status }),
                this.reactRoot
            );
        }
    }
    
    override onOpen() {
        const { contentEl } = this;
        // Clear content before creating new elements
        contentEl.empty();
        
        // Add event listeners to prevent event propagation
        contentEl.addEventListener('click', (evt) => {
            evt.stopPropagation();
        });
        
        contentEl.addEventListener('keydown', (evt) => {
            evt.stopPropagation();
        });
        
        // Create a dedicated container for React
        this.reactRoot = contentEl.createDiv();
        
        // Render the component
        ReactDOM.render(
            React.createElement(PublishingView, { status: this.status }),
            this.reactRoot
        );
    }
    
    override onClose() {
        const { contentEl } = this;
        
        // Properly unmount React component if we have a root
        if (this.reactRoot) {
            ReactDOM.unmountComponentAtNode(this.reactRoot);
            this.reactRoot = null;
        }
        
        // Clear the content element
        contentEl.empty();
    }
}