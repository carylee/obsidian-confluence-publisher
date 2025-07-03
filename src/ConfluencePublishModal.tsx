import { Modal, App } from "obsidian";
import ReactDOM from "react-dom";
import React, { useState, useEffect } from "react";
import { UploadAdfFileResult } from "@markdown-confluence/lib";

// --- STEP 1: Consolidate all related interfaces from both files ---

// Status for the 'PUBLISHING' view
export interface PublishingStatus {
    currentFile?: string;
    filesProcessed: number;
    totalFiles: number;
    stage: 'preparing' | 'processing' | 'finalizing';
}

// Results for the 'COMPLETED' view (from old CompletedModal)
export interface FailedFile {
    fileName: string;
    reason: string;
}

export interface UploadResults {
    errorMessage: string | null;
    failedFiles: FailedFile[];
    filesUploadResult: UploadAdfFileResult[];
}

// --- STEP 2: Define the state for the new parent React component ---

type ModalView = 'PREPARING' | 'PUBLISHING' | 'COMPLETED' | 'ERROR';

interface ModalContainerState {
    view: ModalView;
    publishingStatus: PublishingStatus;
    uploadResults: UploadResults | null;
    errorMessage: string | null;
}

// --- STEP 3: Define Child View Components ---

// PublishingView: Shows publishing progress
const PublishingView: React.FC<{ status: PublishingStatus }> = ({ status }) => {
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

// CompletedView: Shows completion results
const CompletedView: React.FC<{ uploadResults: UploadResults }> = ({ uploadResults }) => {
    const { errorMessage, failedFiles, filesUploadResult } = uploadResults;
    const [expanded, setExpanded] = useState(false);

    const countResults = {
        content: { same: 0, updated: 0 },
        images: { same: 0, updated: 0 },
        labels: { same: 0, updated: 0 },
    };

    filesUploadResult.forEach((result) => {
        countResults.content[result.contentResult]++;
        countResults.images[result.imageResult]++;
        countResults.labels[result.labelResult]++;
    });

    const renderUpdatedFiles = (type: "content" | "image" | "label") => {
        return filesUploadResult
            .filter((result) => result[`${type}Result`] === "updated")
            .map((result, index) => (
                <li key={index} className="updated-file-item">
                    <a href={result.adfFile.pageUrl} className="updated-file-link">
                        {result.adfFile.absoluteFilePath.split('/').pop()}
                    </a>
                </li>
            ));
    };

    return (
        <div className="confluence-publish-modal">
            <div className="confluence-publish-modal-header">
                <h1 className="confluence-publish-modal-title">Confluence Publish</h1>
            </div>
            {errorMessage ? (
                <div className="confluence-publish-modal-error-section">
                    <h3 className="confluence-publish-modal-section-title">Error</h3>
                    <p>{errorMessage}</p>
                </div>
            ) : (
                <>
                    <div className="confluence-publish-modal-summary-box">
                        <p className="confluence-publish-modal-summary-text">
                            <span className="confluence-publish-modal-success-text">
                                {filesUploadResult.length} file{filesUploadResult.length !== 1 ? 's' : ''}
                            </span> uploaded successfully
                        </p>
                    </div>

                    {failedFiles.length > 0 && (
                        <div className="confluence-publish-modal-error-section">
                            <h3 className="confluence-publish-modal-section-title">Failed Uploads</h3>
                            <p>
                                {failedFiles.length} file{failedFiles.length !== 1 ? 's' : ''} failed to upload.
                            </p>
                            <ul className="confluence-publish-modal-updated-list">
                                {failedFiles.map((file, index) => (
                                    <li key={index}>
                                        <strong>{file.fileName.split('/').pop()}</strong>: {file.reason}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <table className="confluence-publish-modal-table">
                        <thead>
                            <tr>
                                <th className="confluence-publish-modal-table-header">Type</th>
                                <th className="confluence-publish-modal-table-header">Same</th>
                                <th className="confluence-publish-modal-table-header">Updated</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="confluence-publish-modal-table-cell">Content</td>
                                <td className={`confluence-publish-modal-table-cell ${countResults.content.same > 0 ? 
                                    'confluence-publish-modal-cell-same' : 'confluence-publish-modal-cell-zero'}`}>
                                    {countResults.content.same}
                                </td>
                                <td className={`confluence-publish-modal-table-cell ${countResults.content.updated > 0 ? 
                                    'confluence-publish-modal-cell-updated' : 'confluence-publish-modal-cell-zero'}`}>
                                    {countResults.content.updated}
                                </td>
                            </tr>
                            <tr>
                                <td className="confluence-publish-modal-table-cell">Images</td>
                                <td className={`confluence-publish-modal-table-cell ${countResults.images.same > 0 ? 
                                    'confluence-publish-modal-cell-same' : 'confluence-publish-modal-cell-zero'}`}>
                                    {countResults.images.same}
                                </td>
                                <td className={`confluence-publish-modal-table-cell ${countResults.images.updated > 0 ? 
                                    'confluence-publish-modal-cell-updated' : 'confluence-publish-modal-cell-zero'}`}>
                                    {countResults.images.updated}
                                </td>
                            </tr>
                            <tr>
                                <td className="confluence-publish-modal-table-cell">Labels</td>
                                <td className={`confluence-publish-modal-table-cell ${countResults.labels.same > 0 ? 
                                    'confluence-publish-modal-cell-same' : 'confluence-publish-modal-cell-zero'}`}>
                                    {countResults.labels.same}
                                </td>
                                <td className={`confluence-publish-modal-table-cell ${countResults.labels.updated > 0 ? 
                                    'confluence-publish-modal-cell-updated' : 'confluence-publish-modal-cell-zero'}`}>
                                    {countResults.labels.updated}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    
                    {(countResults.content.updated > 0 || countResults.images.updated > 0 || countResults.labels.updated > 0) && (
                        <div>
                            <button 
                                className="confluence-publish-modal-expand-button"
                                onClick={(evt) => {
                                    // Stop event propagation to prevent triggering Obsidian UI actions
                                    evt.stopPropagation();
                                    evt.preventDefault();
                                    setExpanded(!expanded);
                                }}>
                                {expanded ? "Hide" : "Show"} Updated Files
                            </button>
                            
                            {expanded ? (
                                <div className="confluence-publish-modal-files-container">
                                    {countResults.content.updated > 0 && (
                                        <div>
                                            <h4 className="confluence-publish-modal-section-title">Updated Content</h4>
                                            <ul className="confluence-publish-modal-updated-list">{renderUpdatedFiles("content")}</ul>
                                        </div>
                                    )}
                                    
                                    {countResults.images.updated > 0 && (
                                        <div>
                                            <h4 className="confluence-publish-modal-section-title">Updated Images</h4>
                                            <ul className="confluence-publish-modal-updated-list">{renderUpdatedFiles("image")}</ul>
                                        </div>
                                    )}
                                    
                                    {countResults.labels.updated > 0 && (
                                        <div>
                                            <h4 className="confluence-publish-modal-section-title">Updated Labels</h4>
                                            <ul className="confluence-publish-modal-updated-list">{renderUpdatedFiles("label")}</ul>
                                        </div>
                                    )}
                                </div>
                            ) : null}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// ErrorView: Shows critical errors
const ErrorView: React.FC<{ message: string }> = ({ message }) => {
    return (
        <div className="confluence-publish-modal">
            <div className="confluence-publish-modal-header">
                <h1 className="confluence-publish-modal-title">Confluence Publish Error</h1>
            </div>
            <div className="confluence-publish-modal-error-section">
                <h3 className="confluence-publish-modal-section-title">Error</h3>
                <p>{message}</p>
            </div>
        </div>
    );
};

// --- STEP 4: Create the main React container component ---

const ModalContainerView: React.FC<{ initialState: ModalContainerState }> = ({ initialState }) => {
    const [state, setState] = useState<ModalContainerState>(initialState);

    // Effect to receive updates from the Modal class
    useEffect(() => {
        const handleUpdate = (e: CustomEvent<ModalContainerState>) => {
            setState(e.detail);
        };
        
        // Listen for state updates
        document.addEventListener('confluence-publish-update' as any, handleUpdate as any);
        return () => document.removeEventListener('confluence-publish-update' as any, handleUpdate as any);
    }, []);

    switch (state.view) {
        case 'PREPARING':
        case 'PUBLISHING':
            return <PublishingView status={state.publishingStatus} />;
        case 'COMPLETED':
            if (!state.uploadResults) return null;
            return <CompletedView uploadResults={state.uploadResults} />;
        case 'ERROR':
            if (!state.errorMessage) return null;
            return <ErrorView message={state.errorMessage} />;
        default:
            return null;
    }
};

// --- STEP 5: Create the final Obsidian Modal Class ---

export class ConfluencePublishModal extends Modal {
    private reactRoot: HTMLDivElement | null = null;
    private customCloseHandler: () => void = () => {};
    private state: ModalContainerState;

    constructor(app: App, initialStatus: PublishingStatus) {
        super(app);
        this.state = {
            view: 'PREPARING',
            publishingStatus: initialStatus,
            uploadResults: null,
            errorMessage: null
        };
    }

    // Method for external callers (main.ts) to update the status
    public updateStatus(newStatus: Partial<PublishingStatus>) {
        this.state.view = 'PUBLISHING';
        this.state.publishingStatus = { ...this.state.publishingStatus, ...newStatus };
        this.dispatchEvent();
        
        // Re-focus the modal to ensure we maintain focus
        if (this.contentEl) {
            setTimeout(() => this.contentEl.focus(), 0);
        }
    }

    // Method to switch to the completed view
    public showResults(results: UploadResults) {
        this.state.view = 'COMPLETED';
        this.state.uploadResults = results;
        this.dispatchEvent();
        
        // Re-focus the modal after switching views
        if (this.contentEl) {
            setTimeout(() => this.contentEl.focus(), 0);
        }
    }
    
    // Method to switch to the error view
    public showError(message: string) {
        this.state.view = 'ERROR';
        this.state.errorMessage = message;
        this.dispatchEvent();
        
        // Re-focus the modal after showing error
        if (this.contentEl) {
            setTimeout(() => this.contentEl.focus(), 0);
        }
    }

    private dispatchEvent() {
        // Dispatch a custom event for the React component to listen to
        const event = new CustomEvent('confluence-publish-update', { 
            detail: {...this.state} 
        });
        document.dispatchEvent(event);
    }

    public setCloseHandler(handler: () => void) {
        this.customCloseHandler = handler;
    }

    override onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // **CRITICAL FIX: Capture focus**
        contentEl.tabIndex = -1;
        contentEl.focus();

        // Prevent event leakage
        contentEl.addEventListener('click', (evt) => {
            evt.stopPropagation();
        });
        
        contentEl.addEventListener('keydown', (evt) => {
            evt.stopPropagation();
        });

        this.reactRoot = contentEl.createDiv();
        ReactDOM.render(
            React.createElement(ModalContainerView, { initialState: this.state }),
            this.reactRoot
        );
        
        // Re-focus in case focus was lost during rendering
        setTimeout(() => contentEl.focus(), 0);
    }

    override onClose() {
        if (this.reactRoot) {
            ReactDOM.unmountComponentAtNode(this.reactRoot);
            this.reactRoot = null;
        }
        contentEl.empty();
        this.customCloseHandler();
    }
}