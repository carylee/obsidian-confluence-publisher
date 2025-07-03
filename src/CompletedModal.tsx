import { Modal, App } from "obsidian";
import ReactDOM from "react-dom";
import React, { useState } from "react";
import { UploadAdfFileResult } from "@markdown-confluence/lib";

export interface FailedFile {
	fileName: string;
	reason: string;
}

export interface UploadResults {
	errorMessage: string | null;
	failedFiles: FailedFile[];
	filesUploadResult: UploadAdfFileResult[];
}

export interface UploadResultsProps {
	uploadResults: UploadResults;
}

const CompletedView: React.FC<UploadResultsProps> = ({ uploadResults }) => {
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

	// Remove debug logging for production
	React.useEffect(() => {
		// Effect to handle any component setup if needed in the future
	}, [expanded]);

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

export class CompletedModal extends Modal {
	uploadResults: UploadResultsProps;
	customCloseHandler: () => void = () => {}; // Add customizable close handler
	private reactRoot: HTMLDivElement | null = null;

	constructor(app: App, uploadResults: UploadResultsProps) {
		super(app);
		this.uploadResults = uploadResults;
	}

	// Method to set the custom close handler
	setCloseHandler(handler: () => void) {
		this.customCloseHandler = handler;
	}

	override onOpen() {
		const { contentEl } = this;
		// Clear content before creating new elements
		contentEl.empty();
		
		// Add a click handler to the modal container to stop event propagation
		contentEl.addEventListener('click', (evt) => {
			evt.stopPropagation();
			// Don't use preventDefault here as it would break functionality of buttons and links
		});
		
		// Add keyboard event listener to stop keyboard events from propagating
		contentEl.addEventListener('keydown', (evt) => {
			evt.stopPropagation();
			// Don't prevent default to allow basic keyboard functionality
		});
		
		// Create a dedicated container for React
		this.reactRoot = contentEl.createDiv();
		
		ReactDOM.render(
			React.createElement(CompletedView, this.uploadResults),
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
		
		// Call the customizable close handler
		this.customCloseHandler();
	}
}
