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

	// Add CSS for styling
	const styles = {
		container: {
			padding: '16px',
			maxWidth: '480px',
			color: 'var(--text-normal)',
			fontFamily: 'var(--font-interface)'
		},
		header: {
			marginBottom: '16px',
			borderBottom: '2px solid var(--background-modifier-border)',
			paddingBottom: '8px'
		},
		title: {
			margin: '0 0 8px 0',
			fontSize: '1.5rem',
			fontWeight: '600',
			color: 'var(--text-accent)'
		},
		summaryBox: {
			backgroundColor: 'var(--background-secondary)',
			border: '1px solid var(--background-modifier-border)',
			borderRadius: '4px',
			padding: '12px 16px',
			marginBottom: '16px'
		},
		summaryText: {
			fontSize: '1rem',
			fontWeight: '500',
			margin: '0'
		},
		successText: {
			color: 'var(--text-success)',
			fontWeight: '600'
		},
		table: {
			width: '100%',
			borderCollapse: 'collapse',
			marginBottom: '16px',
			fontSize: '0.9rem'
		},
		tableHeader: {
			textAlign: 'left',
			padding: '8px',
			backgroundColor: 'var(--background-modifier-hover)',
			fontWeight: '600'
		},
		tableCell: {
			padding: '8px',
			borderTop: '1px solid var(--background-modifier-border)'
		},
		updatedCell: {
			color: 'var(--text-accent)'
		},
		sameCell: {
			color: 'var(--text-muted)'
		},
		zeroCell: {
			color: 'var(--text-faint)'
		},
		expandButton: {
			backgroundColor: 'var(--interactive-normal)',
			color: 'var(--text-normal)',
			border: 'none',
			borderRadius: '4px',
			padding: '6px 12px',
			cursor: 'pointer',
			fontSize: '0.9rem',
			transition: 'background-color 150ms ease'
		},
		updatedList: {
			marginTop: '12px',
			padding: '0 0 0 16px'
		},
		sectionTitle: {
			fontSize: '0.9rem',
			fontWeight: '600',
			margin: '16px 0 8px 0',
			color: 'var(--text-normal)'
		},
		errorSection: {
			backgroundColor: 'var(--background-modifier-error)',
			color: 'var(--text-error)',
			padding: '12px',
			borderRadius: '4px',
			marginBottom: '16px'
		}
	};

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<h1 style={styles.title}>Confluence Publish</h1>
			</div>
			{errorMessage ? (
				<div style={styles.errorSection}>
					<h3 style={styles.sectionTitle}>Error</h3>
					<p>{errorMessage}</p>
				</div>
			) : (
				<>
					<div style={styles.summaryBox}>
						<p style={styles.summaryText}>
							<span style={styles.successText}>{filesUploadResult.length} file{filesUploadResult.length !== 1 ? 's' : ''}</span> uploaded successfully
						</p>
					</div>

					{failedFiles.length > 0 && (
						<div style={styles.errorSection}>
							<h3 style={styles.sectionTitle}>Failed Uploads</h3>
							<p>
								{failedFiles.length} file{failedFiles.length !== 1 ? 's' : ''} failed to upload.
							</p>
							<ul style={styles.updatedList}>
								{failedFiles.map((file, index) => (
									<li key={index}>
										<strong>{file.fileName.split('/').pop()}</strong>: {file.reason}
									</li>
								))}
							</ul>
						</div>
					)}

					<table style={styles.table}>
						<thead>
							<tr>
								<th style={styles.tableHeader}>Type</th>
								<th style={styles.tableHeader}>Same</th>
								<th style={styles.tableHeader}>Updated</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td style={styles.tableCell}>Content</td>
								<td style={{...styles.tableCell, ...(countResults.content.same > 0 ? styles.sameCell : styles.zeroCell)}}>
									{countResults.content.same}
								</td>
								<td style={{...styles.tableCell, ...(countResults.content.updated > 0 ? styles.updatedCell : styles.zeroCell)}}>
									{countResults.content.updated}
								</td>
							</tr>
							<tr>
								<td style={styles.tableCell}>Images</td>
								<td style={{...styles.tableCell, ...(countResults.images.same > 0 ? styles.sameCell : styles.zeroCell)}}>
									{countResults.images.same}
								</td>
								<td style={{...styles.tableCell, ...(countResults.images.updated > 0 ? styles.updatedCell : styles.zeroCell)}}>
									{countResults.images.updated}
								</td>
							</tr>
							<tr>
								<td style={styles.tableCell}>Labels</td>
								<td style={{...styles.tableCell, ...(countResults.labels.same > 0 ? styles.sameCell : styles.zeroCell)}}>
									{countResults.labels.same}
								</td>
								<td style={{...styles.tableCell, ...(countResults.labels.updated > 0 ? styles.updatedCell : styles.zeroCell)}}>
									{countResults.labels.updated}
								</td>
							</tr>
						</tbody>
					</table>
					
					{(countResults.content.updated > 0 || countResults.images.updated > 0 || countResults.labels.updated > 0) && (
						<div>
							<button 
								style={styles.expandButton}
								onClick={(evt) => {
									// Stop event propagation to prevent triggering Obsidian UI actions
									evt.stopPropagation();
									setExpanded(!expanded);
								}}>
								{expanded ? "Hide" : "Show"} Updated Files
							</button>
							
							{expanded && (
								<div>
									{countResults.content.updated > 0 && (
										<div>
											<h4 style={styles.sectionTitle}>Updated Content</h4>
											<ul style={styles.updatedList}>{renderUpdatedFiles("content")}</ul>
										</div>
									)}
									
									{countResults.images.updated > 0 && (
										<div>
											<h4 style={styles.sectionTitle}>Updated Images</h4>
											<ul style={styles.updatedList}>{renderUpdatedFiles("image")}</ul>
										</div>
									)}
									
									{countResults.labels.updated > 0 && (
										<div>
											<h4 style={styles.sectionTitle}>Updated Labels</h4>
											<ul style={styles.updatedList}>{renderUpdatedFiles("label")}</ul>
										</div>
									)}
								</div>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
};

export class CompletedModal extends Modal {
	uploadResults: UploadResultsProps;

	constructor(app: App, uploadResults: UploadResultsProps) {
		super(app);
		this.uploadResults = uploadResults;
	}

	override onOpen() {
		const { contentEl } = this;
		
		// Add a click handler to the modal container to stop event propagation
		contentEl.addEventListener('click', (evt) => {
			evt.stopPropagation();
			// Don't use preventDefault here as it would break functionality of buttons and links
		});
		
		ReactDOM.render(
			React.createElement(CompletedView, this.uploadResults),
			contentEl,
		);
	}

	override onClose() {
		const { contentEl } = this;
		ReactDOM.unmountComponentAtNode(contentEl);
		contentEl.empty();
	}
}
