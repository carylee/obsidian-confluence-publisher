import { Plugin, Notice, MarkdownView, Workspace, loadMermaid, EditorPosition, TFile } from "obsidian";
import {
	ConfluenceUploadSettings,
	Publisher,
	ConfluencePageConfig,
	StaticSettingsLoader,
	renderADFDoc,
	MermaidRendererPlugin,
	UploadAdfFileResult,
} from "@markdown-confluence/lib";
import { ElectronMermaidRenderer } from "@markdown-confluence/mermaid-electron-renderer";
import { ConfluenceSettingTab } from "./ConfluenceSettingTab";
import ObsidianAdaptor from "./adaptors/obsidian";
import { ConfluencePublishModal, PublishingStatus, UploadResults, FailedFile } from "./ConfluencePublishModal";
import { ObsidianConfluenceClient } from "./MyBaseClient";
import {
	ConfluencePerPageForm,
	ConfluencePerPageUIValues,
	mapFrontmatterToConfluencePerPageUIValues,
} from "./ConfluencePerPageForm";
import mermaid from "mermaid";
import "../styles.css";

export interface ObsidianPluginSettings
	extends ConfluenceUploadSettings.ConfluenceSettings {
	mermaidTheme:
		| "match-obsidian"
		| "light-obsidian"
		| "dark-obsidian"
		| "default"
		| "neutral"
		| "dark"
		| "forest";
}

// Interfaces moved to ConfluencePublishModal.tsx

export default class ConfluencePlugin extends Plugin {
	settings!: ObsidianPluginSettings;
	private isSyncing = false;
	workspace!: Workspace;
	publisher!: Publisher;
	adaptor!: ObsidianAdaptor;
	
	/**
	 * Helper method to handle publish errors and display them in a modal
	 */
	private handlePublishError(error: unknown, modal?: ConfluencePublishModal): void {
		// Format the error message with better handling of different error types
		let errorMessage: string;
		
		if (error instanceof Error) {
			// For standard Error objects, include name and message
			errorMessage = `${error.name}: ${error.message}`;
			// Include stack trace in the console for debugging
			console.error('Publishing error:', error);
		} else if (typeof error === 'string') {
			// Handle string errors directly
			errorMessage = error;
		} else {
			// For other objects, try to stringify safely
			try {
				errorMessage = JSON.stringify(error);
			} catch {
				errorMessage = 'Unknown error occurred during publishing';
			}
		}
		
		// If we have a modal already open, use it to show the error
		if (modal) {
			modal.showError(errorMessage);
		} else {
			// Otherwise create a new modal for the error
			const errorModal = new ConfluencePublishModal(this.app, {
				filesProcessed: 0,
				totalFiles: 0,
				stage: 'preparing'
			});
			errorModal.open();
			errorModal.showError(errorMessage);
		}
	}
	
	/**
	 * Execute a publish operation with proper state management, progress feedback, and error handling
	 * This method handles the entire publishing process flow, including:
	 * 1. Immediately showing a progress modal to provide feedback
	 * 2. Saving editor state (cursor position, scroll position)
	 * 3. Setting the syncing flag to prevent multiple concurrent operations
	 * 4. Executing the publish function with progress updates
	 * 5. Displaying results in a completion modal
	 * 6. Restoring editor state when the modal is closed
	 * 7. Error handling
	 * 
	 * @param publishFn The publish function to execute
	 * @param restoreState Whether to restore editor state after publishing
	 */
	private async executePublish(
		publishFn: () => Promise<UploadResults>,
		restoreState: boolean = false
	): Promise<void> {
		// Prevent multiple concurrent sync operations
		if (this.isSyncing) {
			new Notice("Syncing already ongoing");
			return;
		}
		
		// Store active view and editor state if needed
		// We capture the current state before any publishing occurs
		const activeView = restoreState ? this.app.workspace.getActiveViewOfType(MarkdownView) : null;
		let savedCursor: EditorPosition | null = null;
		let savedScrollInfo: { top: number; left: number } | null = null;
		
		if (activeView && activeView.editor) {
			// Save editor cursor position and scroll position
			savedCursor = activeView.editor.getCursor('head');
			savedScrollInfo = activeView.editor.getScrollInfo();
		}
		
		// Set syncing flag and initialize progress modal
		this.isSyncing = true;
		
		// Create and open a single modal that will be used throughout the entire publishing process
		const modal = new ConfluencePublishModal(this.app, {
			filesProcessed: 0,
			totalFiles: 0,
			stage: 'preparing'
		});
		modal.open();
		
		// Set up state restoration to occur when the modal is closed
		// This ensures the editor state is restored only after the user dismisses the modal
		if (restoreState && activeView) {
			modal.setCloseHandler(() => {
				// Verify the view is still valid before attempting to restore state
				if (activeView && activeView.editor) {
					// First restore focus to the editor
					activeView.editor.focus();
					
					// Then restore cursor position if available
					if (savedCursor) {
						activeView.editor.setCursor(savedCursor);
					}
					
					// Finally restore scroll position if available
					if (savedScrollInfo) {
						activeView.editor.scrollTo(savedScrollInfo.left, savedScrollInfo.top);
					}
				}
			});
		}
		
		// Variable for cleanup function
		let cleanup: (() => void) | null = null;
		
		try {
			// Get the list of files to publish and update the modal's status
			const filesToPublish = await this.getFilesToPublish();
			modal.updateStatus({
				totalFiles: filesToPublish.length,
				stage: 'processing'
			});
			
			// Setup progress tracking and execute publish
			cleanup = this.setupProgressTracking(modal);
			const stats = await publishFn();
			
			// Update to finalizing stage
			modal.updateStatus({
				filesProcessed: filesToPublish.length,
				stage: 'finalizing'
			});
			
			// Wait a moment to show the finalizing stage, then show results
			await new Promise(resolve => setTimeout(resolve, 300));
			
			// Instead of closing the modal and opening a new one,
			// simply switch to the completed view in the same modal
			modal.showResults(stats);
			
		} catch (error) {
			// Show error in the same modal (no need to close it first)
			this.handlePublishError(error, modal);
			
		} finally {
			// Perform cleanup if we set up progress tracking
			if (cleanup) {
				cleanup();
			}
			
			// Always reset the syncing flag regardless of success or failure
			this.isSyncing = false;
		}
		// We do NOT close the modal here - let the user close it
	}
	
	/**
	 * This method is no longer needed as the ConfluencePublishModal handles its own updates
	 */
	// private async updatePublishingProgress(modal: PublishingModal, status: Partial<PublishingStatus>): Promise<void> {
	// 	// Update the modal with new status info
	// 	modal.updateStatus(status);
	// 	
	// 	// Give UI time to update
	// 	await new Promise(resolve => setTimeout(resolve, 10));
	// }
	
	/**
	 * Gets a list of files that will be published
	 */
	private async getFilesToPublish(): Promise<TFile[]> {
		// Get all markdown files that meet publication criteria
		const files = this.app.vault.getMarkdownFiles();
		const filesToPublish: TFile[] = [];
		
		for (const file of files) {
			try {
				if (file.path.endsWith(".excalidraw")) {
					continue;
				}
				
				const fileFM = this.app.metadataCache.getCache(file.path);
				if (!fileFM) {
					continue;
				}
				const frontMatter = fileFM.frontmatter;
				
				if (
					(file.path.startsWith(this.settings.folderToPublish) &&
						(!frontMatter || frontMatter["connie-publish"] !== false)) ||
					(frontMatter && frontMatter["connie-publish"] === true)
				) {
					filesToPublish.push(file);
				}
			} catch {
				// Skip files with errors
			}
		}
		
		return filesToPublish;
	}
	
	/**
	 * Sets up interceptors for tracking publish progress
	 * @returns A cleanup function to restore original methods
	 */
	private setupProgressTracking(modal: ConfluencePublishModal): () => void {
		let filesProcessed = 0;
		
		// Add a hook to the publisher to track progress
		// This is a workaround until we have proper progress events from the library
		const originalLoadMarkdownFile = this.adaptor.loadMarkdownFile;
		this.adaptor.loadMarkdownFile = async (absoluteFilePath: string) => {
			// Get the file name for display
			const fileName = absoluteFilePath.split('/').pop() || absoluteFilePath;
			
			// Update the progress modal directly
			modal.updateStatus({
				currentFile: fileName,
				filesProcessed: filesProcessed++
			});
			
			// Call the original method
			return originalLoadMarkdownFile.call(this.adaptor, absoluteFilePath);
		};
		
		// Return a cleanup function
		return () => {
			// Restore original method
			this.adaptor.loadMarkdownFile = originalLoadMarkdownFile;
		};
	}

	activeLeafPath(workspace: Workspace) {
		return workspace.getActiveViewOfType(MarkdownView)?.file.path;
	}

	async init() {
		await this.loadSettings();
		const { vault, metadataCache, workspace } = this.app;
		this.workspace = workspace;
		this.adaptor = new ObsidianAdaptor(
			vault,
			metadataCache,
			this.settings,
			this.app,
		);

		const mermaidItems = await this.getMermaidItems();
		const mermaidRenderer = new ElectronMermaidRenderer(
			mermaidItems.extraStyleSheets,
			mermaidItems.extraStyles,
			mermaidItems.mermaidConfig,
			mermaidItems.bodyStyles,
		);
		const confluenceClient = new ObsidianConfluenceClient({
			host: this.settings.confluenceBaseUrl,
			authentication: {
				basic: {
					email: this.settings.atlassianUserName,
					apiToken: this.settings.atlassianApiToken,
				},
			},
			middlewares: {
				onError(e) {
					if ("response" in e && e.response && "data" in e.response) {
						e.message =
							typeof e.response.data === "string"
								? e.response.data
								: JSON.stringify(e.response.data);
					}
				},
			},
		});

		const settingsLoader = new StaticSettingsLoader(this.settings);
		this.publisher = new Publisher(
			this.adaptor,
			settingsLoader,
			confluenceClient,
			[new MermaidRendererPlugin(mermaidRenderer)],
		);
	}

	async getMermaidItems() {
		const extraStyles: string[] = [];
		const extraStyleSheets: string[] = [];
		let bodyStyles = "";
		const body = document.querySelector("body") as HTMLBodyElement;

		switch (this.settings.mermaidTheme) {
			case "default":
			case "neutral":
			case "dark":
			case "forest":
				return {
					extraStyleSheets,
					extraStyles,
					mermaidConfig: { theme: this.settings.mermaidTheme },
					bodyStyles,
				};
			case "match-obsidian":
				bodyStyles = body.className;
				break;
			case "dark-obsidian":
				bodyStyles = "theme-dark";
				break;
			case "light-obsidian":
				bodyStyles = "theme-dark";
				break;
			default:
				throw new Error("Missing theme");
		}

		extraStyleSheets.push("app://obsidian.md/app.css");

		// @ts-expect-error
		const cssTheme = this.app.vault?.getConfig("cssTheme") as string;
		if (cssTheme) {
			const fileExists = await this.app.vault.adapter.exists(
				`.obsidian/themes/${cssTheme}/theme.css`,
			);
			if (fileExists) {
				const themeCss = await this.app.vault.adapter.read(
					`.obsidian/themes/${cssTheme}/theme.css`,
				);
				extraStyles.push(themeCss);
			}
		}

		const cssSnippets =
			// @ts-expect-error
			(this.app.vault?.getConfig("enabledCssSnippets") as string[]) ?? [];
		for (const snippet of cssSnippets) {
			const fileExists = await this.app.vault.adapter.exists(
				`.obsidian/snippets/${snippet}.css`,
			);
			if (fileExists) {
				const themeCss = await this.app.vault.adapter.read(
					`.obsidian/snippets/${snippet}.css`,
				);
				extraStyles.push(themeCss);
			}
		}

		const isDarkMode = document.body.classList.contains('theme-dark');

		// Add custom CSS to fix Mermaid diagram height and padding issues
		extraStyles.push(`
			#graphDiv svg {
				padding-bottom: 20px !important; /* Add extra space at the bottom */
				margin-bottom: 10px !important; /* Add margin for better spacing */
			}
			.mermaid {
				overflow: visible !important; /* Prevent content clipping */
			}
		`);

		return {
			extraStyleSheets,
			extraStyles,
			mermaidConfig: {
				...((await loadMermaid()) as typeof mermaid).mermaidAPI.getConfig(),
				theme: isDarkMode ? 'dark' : 'default',
				// Add extra bottom padding in diagram
				themeVariables: {
					diagramPadding: 15
				},
				// Make sure all diagram content is properly rendered
				securityLevel: 'loose'
			},
			bodyStyles,
		};
	}

	async doPublish(publishFilter?: string): Promise<UploadResults> {
		const adrFiles = await this.publisher.publish(publishFilter);

		const returnVal: UploadResults = {
			errorMessage: null,
			failedFiles: [],
			filesUploadResult: [],
		};

		adrFiles.forEach((element) => {
			if (element.successfulUploadResult) {
				returnVal.filesUploadResult.push(
					element.successfulUploadResult,
				);
				return;
			}

			returnVal.failedFiles.push({
				fileName: element.node.file.absoluteFilePath,
				reason: element.reason ?? "No Reason Provided",
			});
		});

		return returnVal;
	}

	override async onload() {
		await this.init();

		this.addRibbonIcon("cloud", "Publish to Confluence", (evt: MouseEvent) => {
			// Stop event propagation to prevent triggering other actions in Obsidian
			evt.stopPropagation();
			evt.preventDefault();
			
			// Use our helper method to handle publishing with state restoration
			void this.executePublish(
				() => this.doPublish(), 
				true // Restore editor state after publishing
			);
		});

		this.addCommand({
			id: "adf-to-markdown",
			name: "ADF To Markdown",
			callback: async () => {
				console.log("HMMMM");
				const json = JSON.parse(
					'{"type":"doc","content":[{"type":"paragraph","content":[{"text":"Testing","type":"text"}]}],"version":1}',
				);
				console.log({ json });

				const confluenceClient = new ObsidianConfluenceClient({
					host: this.settings.confluenceBaseUrl,
					authentication: {
						basic: {
							email: this.settings.atlassianUserName,
							apiToken: this.settings.atlassianApiToken,
						},
					},
				});
				const testingPage =
					await confluenceClient.content.getContentById({
						id: "9732097",
						expand: ["body.atlas_doc_format", "space"],
					});
				const adf = JSON.parse(
					testingPage.body?.atlas_doc_format?.value ||
						'{type: "doc", content:[]}',
				);
				renderADFDoc(adf);
			},
		});

		this.addCommand({
			id: "publish-current",
			name: "Publish Current File to Confluence",
			checkCallback: (checking: boolean) => {
				if (this.isSyncing) {
					return true; // Command is valid but can't be executed now
				}
				
				if (!checking) {
					// Execute the publish operation
					void this.executePublish(
						() => this.doPublish(this.activeLeafPath(this.workspace)),
						true // Restore editor state
					);
				}
				
				return true;
			},
		});

		this.addCommand({
			id: "publish-all",
			name: "Publish All to Confluence",
			checkCallback: (checking: boolean) => {
				if (this.isSyncing) {
					return true; // Command is valid but can't be executed now
				}
				
				if (!checking) {
					// Execute the publish operation
					void this.executePublish(
						() => this.doPublish(),
						true // Restore editor state
					);
				}
				
				return true;
			},
		});

		this.addCommand({
			id: "enable-publishing",
			name: "Enable publishing to Confluence",
			editorCheckCallback: (checking, _editor, view) => {
				if (!view.file) {
					return false;
				}

				if (checking) {
					const frontMatter = this.app.metadataCache.getCache(
						view.file.path,
					)?.frontmatter;
					const file = view.file;
					const enabledForPublishing =
						(file.path.startsWith(this.settings.folderToPublish) &&
							(!frontMatter ||
								frontMatter["connie-publish"] !== false)) ||
						(frontMatter && frontMatter["connie-publish"] === true);
					return !enabledForPublishing;
				}

				this.app.fileManager.processFrontMatter(
					view.file,
					(frontmatter) => {
						if (
							view.file &&
							view.file.path.startsWith(
								this.settings.folderToPublish,
							)
						) {
							delete frontmatter["connie-publish"];
						} else {
							frontmatter["connie-publish"] = true;
						}
					},
				);
				return true;
			},
		});

		this.addCommand({
			id: "disable-publishing",
			name: "Disable publishing to Confluence",
			editorCheckCallback: (checking, _editor, view) => {
				if (!view.file) {
					return false;
				}

				if (checking) {
					const frontMatter = this.app.metadataCache.getCache(
						view.file.path,
					)?.frontmatter;
					const file = view.file;
					const enabledForPublishing =
						(file.path.startsWith(this.settings.folderToPublish) &&
							(!frontMatter ||
								frontMatter["connie-publish"] !== false)) ||
						(frontMatter && frontMatter["connie-publish"] === true);
					return enabledForPublishing;
				}

				this.app.fileManager.processFrontMatter(
					view.file,
					(frontmatter) => {
						if (
							view.file &&
							view.file.path.startsWith(
								this.settings.folderToPublish,
							)
						) {
							frontmatter["connie-publish"] = false;
						} else {
							delete frontmatter["connie-publish"];
						}
					},
				);
				return true;
			},
		});

		this.addCommand({
			id: "page-settings",
			name: "Update Confluence Page Settings",
			editorCheckCallback: (checking, _editor, view) => {
				if (!view.file) {
					return false;
				}

				if (checking) {
					return true;
				}

				const frontMatter = this.app.metadataCache.getCache(
					view.file.path,
				)?.frontmatter;

				const file = view.file;

				new ConfluencePerPageForm(this.app, {
					config: ConfluencePageConfig.conniePerPageConfig,
					initialValues:
						mapFrontmatterToConfluencePerPageUIValues(frontMatter),
					onSubmit: (values, close) => {
						const valuesToSet: Partial<ConfluencePageConfig.ConfluencePerPageAllValues> =
							{};
						for (const propertyKey in values) {
							if (
								Object.prototype.hasOwnProperty.call(
									values,
									propertyKey,
								)
							) {
								const element =
									values[
										propertyKey as keyof ConfluencePerPageUIValues
									];
								if (element.isSet) {
									valuesToSet[
										propertyKey as keyof ConfluencePerPageUIValues
									] = element.value as never;
								}
							}
						}
						this.adaptor.updateMarkdownValues(
							file.path,
							valuesToSet,
						);
						close();
					},
				}).open();
				return true;
			},
		});

		this.addSettingTab(new ConfluenceSettingTab(this.app, this));
	}

	override async onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			ConfluenceUploadSettings.DEFAULT_SETTINGS,
			{ mermaidTheme: "match-obsidian" },
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		await this.init();
	}
}
