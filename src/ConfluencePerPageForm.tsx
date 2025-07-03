import { Modal, App, FrontMatterCache } from "obsidian";
import ReactDOM from "react-dom";
import React, { useState, ChangeEvent } from "react";
import { ConfluencePageConfig } from "@markdown-confluence/lib";

export type ConfluencePerPageUIValues = {
	[K in keyof ConfluencePageConfig.ConfluencePerPageConfig]: {
		value:
			| ConfluencePageConfig.ConfluencePerPageConfig[K]["default"]
			| undefined;
		isSet: boolean;
	};
};

export function mapFrontmatterToConfluencePerPageUIValues(
	frontmatter: FrontMatterCache | undefined,
): ConfluencePerPageUIValues {
	const config = ConfluencePageConfig.conniePerPageConfig;
	const result: Partial<ConfluencePerPageUIValues> = {};

	if (!frontmatter) {
		throw new Error("Missing frontmatter");
	}

	for (const propertyKey in config) {
		if (config.hasOwnProperty(propertyKey)) {
			const {
				key,
				inputType,
				default: defaultValue,
			} = config[
				propertyKey as keyof ConfluencePageConfig.ConfluencePerPageConfig
			];
			const frontmatterValue = frontmatter[key];

			if (frontmatterValue !== undefined) {
				result[propertyKey as keyof ConfluencePerPageUIValues] = {
					value: frontmatterValue,
					isSet: true,
				};
			} else {
				switch (inputType) {
					case "options":
					case "array-text":
						result[propertyKey as keyof ConfluencePerPageUIValues] =
							{ value: defaultValue as never, isSet: false };
						break;
					case "boolean":
					case "text":
						result[propertyKey as keyof ConfluencePerPageUIValues] =
							{ value: undefined, isSet: false };
						break;
					default:
						throw new Error("Missing case for inputType");
				}
			}
		}
	}
	return result as ConfluencePerPageUIValues;
}

interface FormProps {
	config: ConfluencePageConfig.ConfluencePerPageConfig;
	initialValues: ConfluencePerPageUIValues;
	onSubmit: (values: ConfluencePerPageUIValues) => void;
}

interface ModalProps {
	config: ConfluencePageConfig.ConfluencePerPageConfig;
	initialValues: ConfluencePerPageUIValues;
	onSubmit: (values: ConfluencePerPageUIValues, close: () => void) => void;
}

const handleChange = (
	key: string,
	value: unknown,
	inputValidator: ConfluencePageConfig.InputValidator<unknown>,
	setValues: React.Dispatch<React.SetStateAction<ConfluencePerPageUIValues>>,
	setErrors: React.Dispatch<React.SetStateAction<Record<string, Error[]>>>,
	isSetValue: boolean,
) => {
	const validationResult = inputValidator(value);

	setValues((prevValues) => ({
		...prevValues,
		[key]: {
			...prevValues[key as keyof ConfluencePerPageUIValues],
			...(isSetValue ? { isSet: value } : { value }),
		},
	}));
	setErrors((prevErrors) => ({
		...prevErrors,
		[key]: validationResult.valid ? [] : validationResult.errors,
	}));
};

// Styles are now defined in styles.css

/**
 * Generic form field component that handles rendering different input types
 */
const FormField = ({
	fieldKey,
	config,
	values,
	errors,
	setValues,
	setErrors,
}: {
	fieldKey: string;
	config: ConfluencePageConfig.FrontmatterConfig<unknown, ConfluencePageConfig.InputType>;
	values: ConfluencePerPageUIValues;
	errors: Record<string, Error[]>;
	setValues: React.Dispatch<React.SetStateAction<ConfluencePerPageUIValues>>;
	setErrors: React.Dispatch<React.SetStateAction<Record<string, Error[]>>>;
}) => {
	// Helper function to get the strongly typed value from the values object
	const getValue = () => values[fieldKey as keyof ConfluencePerPageUIValues].value;
	const getIsSet = () => values[fieldKey as keyof ConfluencePerPageUIValues].isSet as boolean;
	
	// Handler for the isSet checkbox
	const handleIsSetChange = (e: ChangeEvent<HTMLInputElement>) => {
		handleChange(
			fieldKey,
			e.target.checked,
			config.inputValidator,
			setValues,
			setErrors,
			true
		);
	};
	
	// Render the appropriate input control based on inputType
	const renderInputControl = () => {
		switch (config.inputType) {
			case "text":
				return (
					<input
						type="text"
						id={fieldKey}
						value={(getValue() as string) ?? ""}
						onChange={(e: ChangeEvent<HTMLInputElement>) =>
							handleChange(
								fieldKey,
								e.target.value,
								config.inputValidator,
								setValues,
								setErrors,
								false
							)
						}
					/>
				);
				
			case "boolean":
				return (
					<input
						type="checkbox"
						id={fieldKey}
						checked={getValue() as boolean}
						onChange={(e: ChangeEvent<HTMLInputElement>) =>
							handleChange(
								fieldKey,
								e.target.checked,
								config.inputValidator,
								setValues,
								setErrors,
								false
							)
						}
					/>
				);
				
			case "array-text":
				return (
					<div>
						{(getValue() as string[]).map((value, index) => (
							<input
								key={`${fieldKey}-${index}`}
								type="text"
								value={value}
								onChange={(e: ChangeEvent<HTMLInputElement>) => {
									const newArray = [...(getValue() as string[])];
									newArray[index] = e.target.value;
									handleChange(
										fieldKey,
										newArray,
										config.inputValidator,
										setValues,
										setErrors,
										false
									);
								}}
							/>
						))}
						<button
							type="button"
							onClick={() => {
								const newArray = [...(getValue() as string[]), ""];
								handleChange(
									fieldKey,
									newArray,
									config.inputValidator,
									setValues,
									setErrors,
									false
								);
							}}
						>
							+
						</button>
					</div>
				);
				
			case "options":
				const typedConfig = config as ConfluencePageConfig.FrontmatterConfig<
					ConfluencePageConfig.PageContentType,
					"options"
				>;
				return (
					<select
						id={fieldKey}
						value={getValue() as ConfluencePageConfig.PageContentType}
						onChange={(e: ChangeEvent<HTMLSelectElement>) =>
							handleChange(
								fieldKey,
								e.target.value as ConfluencePageConfig.PageContentType,
								config.inputValidator,
								setValues,
								setErrors,
								false
							)
						}
					>
						{typedConfig.selectOptions.map((option) => (
							<option key={option} value={option}>
								{option}
							</option>
						))}
					</select>
				);
				
			default:
				return <div>Unsupported input type: {config.inputType}</div>;
		}
	};
	
	// Render errors if any
	const renderErrors = () => {
		if ((errors[fieldKey]?.length ?? 0) > 0) {
			return (
				<td colSpan={3}>
					<div className="error">
						{(errors[fieldKey] ?? []).map((error) => (
							<p key={error.message}>{error.message}</p>
						))}
					</div>
				</td>
			);
		}
		return null;
	};
	
	return (
		<>
			<tr key={fieldKey}>
				<td>
					<label htmlFor={fieldKey}>{config.key}</label>
				</td>
				<td>
					{renderInputControl()}
				</td>
				<td>
					<input
						type="checkbox"
						id={`${fieldKey}-isSet`}
						checked={getIsSet()}
						onChange={handleIsSetChange}
					/>
				</td>
			</tr>
			<tr key={`${fieldKey}-errors`}>
				{renderErrors()}
			</tr>
		</>
	);
};

const ConfluenceForm: React.FC<FormProps> = ({
	config,
	initialValues,
	onSubmit,
}) => {
	const [values, setValues] =
		useState<ConfluencePerPageUIValues>(initialValues);
	const [errors, setErrors] = useState<Record<string, Error[]>>({});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		onSubmit(values as ConfluencePerPageUIValues);
	};

	return (
		<form onSubmit={handleSubmit} className="confluence-page-form">
			<h1>Update Confluence Page Settings</h1>
			<table>
				<thead>
					<tr>
						<th>YAML Key</th>
						<th>Value</th>
						<th>Update</th>
					</tr>
				</thead>
				<tbody>
					{Object.entries(config).map(([key, fieldConfig]) => (
						<FormField 
							key={key}
							fieldKey={key}
							config={fieldConfig}
							values={values}
							errors={errors}
							setValues={setValues}
							setErrors={setErrors}
						/>
					))}
				</tbody>
			</table>
			<button type="submit" className="mod-cta">Submit</button>
		</form>
	);
};

export class ConfluencePerPageForm extends Modal {
	modalProps: ModalProps;

	constructor(app: App, modalProps: ModalProps) {
		super(app);
		this.modalProps = modalProps;
	}

	override onOpen() {
		const { contentEl } = this;
		const test: FormProps = {
			...this.modalProps,
			onSubmit: (values) => {
				const boundClose = this.close.bind(this);
				this.modalProps.onSubmit(values, boundClose);
			},
		};
		ReactDOM.render(React.createElement(ConfluenceForm, test), contentEl);
	}

	override onClose() {
		const { contentEl } = this;
		ReactDOM.unmountComponentAtNode(contentEl);
		contentEl.empty();
	}
}
