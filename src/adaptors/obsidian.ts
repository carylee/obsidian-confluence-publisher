import { Vault, MetadataCache, App, TFile, MarkdownView, EditorPosition } from "obsidian";
import {
	ConfluenceUploadSettings,
	BinaryFile,
	FilesToUpload,
	LoaderAdaptor,
	MarkdownFile,
	ConfluencePageConfig,
} from "@markdown-confluence/lib";
import { lookup } from "mime-types";

export default class ObsidianAdaptor implements LoaderAdaptor {
	vault: Vault;
	metadataCache: MetadataCache;
	settings: ConfluenceUploadSettings.ConfluenceSettings;
	app: App;

	constructor(
		vault: Vault,
		metadataCache: MetadataCache,
		settings: ConfluenceUploadSettings.ConfluenceSettings,
		app: App,
	) {
		this.vault = vault;
		this.metadataCache = metadataCache;
		this.settings = settings;
		this.app = app;
	}

	async getMarkdownFilesToUpload(): Promise<FilesToUpload> {
		const files = this.vault.getMarkdownFiles();
		const filesToPublish = [];
		for (const file of files) {
			try {
				if (file.path.endsWith(".excalidraw")) {
					continue;
				}

				const fileFM = this.metadataCache.getCache(file.path);
				if (!fileFM) {
					throw new Error("Missing File in Metadata Cache");
				}
				const frontMatter = fileFM.frontmatter;

				if (
					(file.path.startsWith(this.settings.folderToPublish) &&
						(!frontMatter ||
							frontMatter["connie-publish"] !== false)) ||
					(frontMatter && frontMatter["connie-publish"] === true)
				) {
					filesToPublish.push(file);
				}
			} catch {
				//ignore
			}
		}
		const filesToUpload = [];

		for (const file of filesToPublish) {
			const markdownFile = await this.loadMarkdownFile(file.path);
			filesToUpload.push(markdownFile);
		}

		return filesToUpload;
	}

	async loadMarkdownFile(absoluteFilePath: string): Promise<MarkdownFile> {
		const file = this.app.vault.getAbstractFileByPath(absoluteFilePath);
		if (!(file instanceof TFile)) {
			throw new Error("Not a TFile");
		}

		const fileFM = this.metadataCache.getCache(file.path);
		if (!fileFM) {
			throw new Error("Missing File in Metadata Cache");
		}
		const frontMatter = fileFM.frontmatter;

		const parsedFrontMatter: Record<string, unknown> = {};
		if (frontMatter) {
			for (const [key, value] of Object.entries(frontMatter)) {
				parsedFrontMatter[key] = value;
			}
		}

		return {
			pageTitle: file.basename,
			folderName: file.parent.name,
			absoluteFilePath: file.path,
			fileName: file.name,
			contents: await this.vault.cachedRead(file),
			frontmatter: parsedFrontMatter,
		};
	}

	async readBinary(
		path: string,
		referencedFromFilePath: string,
	): Promise<BinaryFile | false> {
		const testing = this.metadataCache.getFirstLinkpathDest(
			path,
			referencedFromFilePath,
		);
		if (testing) {
			const files = await this.vault.readBinary(testing);
			const mimeType =
				lookup(testing.extension) || "application/octet-stream";
			return {
				contents: files,
				filePath: testing.path,
				filename: testing.name,
				mimeType: mimeType,
			};
		}

		return false;
	}
	async updateMarkdownValues(
		absoluteFilePath: string,
		values: Partial<ConfluencePageConfig.ConfluencePerPageAllValues>,
	): Promise<void> {
		const config = ConfluencePageConfig.conniePerPageConfig;
		const file = this.app.vault.getAbstractFileByPath(absoluteFilePath);
		if (file instanceof TFile) {
			// Find the active view and save editor state before modifying front matter
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			let savedCursor: EditorPosition | null = null;
			let savedScrollInfo: { top: number; left: number } | null = null;
			
			if (activeView && activeView.file && activeView.file.path === file.path && activeView.editor) {
				// Only save state if the active file is the one being modified
				savedCursor = activeView.editor.getCursor('head');
				savedScrollInfo = activeView.editor.getScrollInfo();
			}
			
			// Process the front matter changes
			this.app.fileManager.processFrontMatter(file, (fm) => {
				for (const propertyKey in config) {
					if (!config.hasOwnProperty(propertyKey)) {
						continue;
					}

					const { key } =
						config[
							propertyKey as keyof ConfluencePageConfig.ConfluencePerPageConfig
						];
					const value =
						values[
							propertyKey as keyof ConfluencePageConfig.ConfluencePerPageAllValues
						];
					if (propertyKey in values) {
						fm[key] = value;
					}
				}
			});
			
			// Restore editor state after a short delay to let Obsidian process the changes
			// NOTE: The setTimeout approach is used because Obsidian doesn't provide hooks
			// for "after front matter processing is complete". This is a common pattern in Obsidian plugins.
			// The delay gives Obsidian time to finish processing the file updates before we attempt to restore state.
			if (activeView && activeView.file && activeView.file.path === file.path && activeView.editor) {
				setTimeout(() => {
					// Double-check that the view and editor are still available and valid
					// This guards against cases where the user quickly switches to a different file
					if (activeView && activeView.editor) {
						// First restore focus to the editor
						activeView.editor.focus();
						
						// Then restore cursor position if we saved it
						if (savedCursor) {
							activeView.editor.setCursor(savedCursor);
						}
						
						// Finally restore scroll position if we saved it
						if (savedScrollInfo) {
							activeView.editor.scrollTo(savedScrollInfo.left, savedScrollInfo.top);
						}
					}
				}, 100); // Increased timeout for better reliability
			}
		}
	}
}
