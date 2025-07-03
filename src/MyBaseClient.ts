import {
	Api,
	Client,
	Config,
	RequestConfig,
	AuthenticationService,
} from "confluence.js";
import { requestUrl } from "obsidian";
import { RequiredConfluenceClient } from "@markdown-confluence/lib";

const ATLASSIAN_TOKEN_CHECK_FLAG = "X-Atlassian-Token";
const ATLASSIAN_TOKEN_CHECK_NOCHECK_VALUE = "no-check";

export class MyBaseClient implements Client {
	protected urlSuffix = "/wiki/rest";

	constructor(protected readonly config: Config) {}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected paramSerializer(parameters: Record<string, any>): string {
		const parts: string[] = [];

		Object.entries(parameters).forEach(([key, value]) => {
			if (value === null || typeof value === "undefined") {
				return;
			}

			if (Array.isArray(value)) {
				// eslint-disable-next-line no-param-reassign
				value = value.join(",");
			}

			if (value instanceof Date) {
				// eslint-disable-next-line no-param-reassign
				value = value.toISOString();
			} else if (value !== null && typeof value === "object") {
				// eslint-disable-next-line no-param-reassign
				value = JSON.stringify(value);
			} else if (value instanceof Function) {
				const part = value();

				return part && parts.push(part);
			}

			parts.push(`${this.encode(key)}=${this.encode(value)}`);

			return;
		});

		return parts.join("&");
	}

	protected encode(value: string) {
		return encodeURIComponent(value)
			.replace(/%3A/gi, ":")
			.replace(/%24/g, "$")
			.replace(/%2C/gi, ",")
			.replace(/%20/g, "+")
			.replace(/%5B/gi, "[")
			.replace(/%5D/gi, "]");
	}

	protected removeUndefinedProperties(
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		obj: Record<string, any>,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
	): Record<string, any> {
		return Object.entries(obj)
			.filter(([, value]) => typeof value !== "undefined")
			.reduce(
				(accumulator, [key, value]) => ({
					...accumulator,
					[key]: value,
				}),
				{},
			);
	}

	/**
	 * Send a request to the Confluence API.
	 * This method has been simplified to use promises exclusively and remove legacy callback support.
	 * 
	 * @param requestConfig The request configuration
	 * @returns A promise that resolves to the response data
	 */
	async sendRequest<T>(
		requestConfig: RequestConfig,
	): Promise<T> {
		try {
			// Handle content-type header normalization
			const contentType = (requestConfig.headers ?? {})["content-type"]?.toString();
			if (requestConfig.headers && contentType) {
				requestConfig.headers["Content-Type"] = contentType;
				delete requestConfig?.headers["content-type"];
			}

			// Serialize query parameters
			const params = this.paramSerializer(requestConfig.params);

			// Determine content type and prepare request body
			const requestContentType =
				(requestConfig.headers ?? {})["Content-Type"]?.toString() ??
				"application/json";

			const requestBody = requestContentType.startsWith("multipart/form-data")
				? [
					requestConfig.data.getHeaders(),
					requestConfig.data.getBuffer().buffer,
				  ]
				: [{}, JSON.stringify(requestConfig.data)];

			// Build the final request config for Obsidian's requestUrl function
			const modifiedRequestConfig = {
				...requestConfig,
				headers: this.removeUndefinedProperties({
					"User-Agent": "Obsidian.md",
					Accept: "application/json",
					[ATLASSIAN_TOKEN_CHECK_FLAG]: this.config.noCheckAtlassianToken
						? ATLASSIAN_TOKEN_CHECK_NOCHECK_VALUE
						: undefined,
					...this.config.baseRequestConfig?.headers,
					Authorization: await AuthenticationService.getAuthenticationToken(
						this.config.authentication,
						{
							// eslint-disable-next-line @typescript-eslint/naming-convention
							baseURL: this.config.host,
							url: `${this.config.host}${this.urlSuffix}`,
							method: requestConfig.method ?? "GET",
						},
					),
					...requestConfig.headers,
					"Content-Type": requestContentType,
					...requestBody[0],
				}),
				url: `${this.config.host}${this.urlSuffix}${requestConfig.url}?${params}`,
				body: requestBody[1],
				method: requestConfig.method?.toUpperCase() ?? "GET",
				contentType: requestContentType,
				throw: false,
			};
			delete modifiedRequestConfig.data;

			// Execute the request
			const response = await requestUrl(modifiedRequestConfig);

			// Handle error status codes
			if (response.status >= 400) {
				throw new HTTPError(`Received a ${response.status}`, {
					status: response.status,
					data: response.text,
				});
			}

			// Call optional middleware
			this.config.middlewares?.onResponse?.(response.json);

			// Return the JSON response
			return response.json as T;
		} catch (error: unknown) {
			console.warn({ httpError: error, requestConfig });
			
			// Normalize the error before passing it to middleware
			const normalizedError = this.normalizeError(error);
			
			// For error middleware, we need to pass a value that matches what the library expects
			// Since we're not using Axios, we pass the error directly and let the middleware handle it
			if (this.config.middlewares?.onError) {
				// Bypass the typing requirement - the middleware will handle it
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				this.config.middlewares.onError(normalizedError as any);
			}
			
			// Re-throw the normalized error
			throw normalizedError;
		}
	}
	
	/**
	 * Normalize errors to provide a consistent error interface
	 */
	private normalizeError(error: unknown): Error {
		// The error is already normalized
		if (error instanceof Error) {
			return error;
		}
		
		// Create a new error with the stringified error object
		return new Error(
			typeof error === 'object' ? JSON.stringify(error) : String(error)
		);
	}
}

export interface ErrorData {
	data: unknown;
	status: number;
}

export class HTTPError extends Error {
	constructor(
		msg: string,
		public response: ErrorData,
	) {
		super(msg);

		// Set the prototype explicitly.
		Object.setPrototypeOf(this, HTTPError.prototype);
	}
}

export class ObsidianConfluenceClient
	extends MyBaseClient
	implements RequiredConfluenceClient
{
	content = new Api.Content(this);
	space = new Api.Space(this);
	contentAttachments = new Api.ContentAttachments(this);
	contentLabels = new Api.ContentLabels(this);
	users = new Api.Users(this);
}
