# Dependency Management

This document outlines the approach to dependency management in the Obsidian Confluence Publisher plugin.

## Current Dependencies

The plugin has several key dependencies:

- **React & React DOM (v16.14.0)**: Used for building UI components.
- **TypeScript (v4.9.5)**: Used for static typing.
- **@markdown-confluence/lib (v5.5.2)**: Core functionality for converting Markdown to Confluence format.
- **@markdown-confluence/mermaid-electron-renderer (v5.5.2)**: Renders Mermaid diagrams.
- **confluence.js (v1.7.4)**: API client for Confluence.
- **mermaid (v9.3.0)**: Diagram generation library.
- **obsidian (v1.1.1)**: Obsidian API for plugin development.

## Upgrade Strategy

We follow these guidelines for dependency management:

1. **Minor and Patch Updates**: Apply regularly to get bug fixes and improvements.
2. **Major Version Updates**: Require careful assessment due to potential breaking changes.
3. **React and TypeScript**: Major version upgrades require coordinated planning due to their fundamental role in the codebase.

## Dependency Audit (2025-07-03)

- Minor and patch versions updated to latest compatible releases.
- Major version upgrades were identified but deferred to avoid breaking changes:
  - React 16 → 19
  - TypeScript 4 → 5
  - Mermaid 9 → 11
  - Obsidian 1.1 → 1.8
  - mime-types 2 → 3
  - confluence.js 1.7 → 2.0

## Future Upgrade Path

For React and Obsidian major version upgrades:

1. **Create a dedicated branch** for the migration
2. **Write comprehensive tests** before making changes
3. **Update type definitions** to accommodate API changes
4. **Address breaking changes** one component at a time
5. **Perform thorough testing** of all plugin features

## Notes on Specific Dependencies

- **React**: The transition from React 16 to 18+ involves substantial changes to the component lifecycle and event handling. A dedicated migration effort will be required.
- **confluence.js**: Version 2.0 has a different API structure that would require refactoring the MyBaseClient class.
- **Obsidian API**: Updates should align with the target Obsidian version supported by the plugin.
- **prosemirror-model**: Locked at version 1.14.3 via resolutions due to compatibility issues with @atlaskit dependencies.