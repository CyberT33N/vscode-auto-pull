/**
 * Controllable in-process replacement for the `vscode` module, wired through
 * the vitest resolve alias. It exposes exactly the API surface the extension
 * consumes plus inspection helpers for assertions.
 */

/**
 * Status-bar item double with visibility counters.
 */
export interface StubStatusBarItem {
  /**
   * Current rendered text.
   */
  text: string;
  /**
   * Current hover tooltip.
   */
  tooltip: string;
  /**
   * Number of times the item was shown.
   */
  showCount: number;
  /**
   * Number of times the item was hidden.
   */
  hideCount: number;
  /**
   * Marks the item visible.
   */
  show(): void;
  /**
   * Marks the item hidden.
   */
  hide(): void;
  /**
   * Releases the item (mirrors the host disposable surface).
   */
  dispose(): void;
}

/**
 * Git API double shape used by the stub.
 */
export interface StubGitApi {
  /**
   * Resolved Git binary metadata.
   */
  git: { path: string };
  /**
   * Repositories reported by the fake API.
   */
  repositories: unknown[];
}

/**
 * Git extension export double shape used by the stub.
 */
export interface StubGitExtension {
  /**
   * Exports surface consumed by the extension host integration.
   */
  exports?: {
    /**
     * Returns the fake Git API or throws to simulate a disabled extension.
     *
     * @param version - Requested API version.
     * @returns The fake API.
     */
    getAPI(version: 1): StubGitApi;
  };
}

interface StubState {
  configValues: Map<string, unknown>;
  gitExtension: StubGitExtension | undefined;
  outputLines: string[];
  commands: Map<string, (...args: unknown[]) => unknown>;
  configChangeListeners: ((event: {
    affectsConfiguration(section: string): boolean;
  }) => unknown)[];
  statusBarItem: StubStatusBarItem | undefined;
}

const state: StubState = {
  configValues: new Map(),
  gitExtension: undefined,
  outputLines: [],
  commands: new Map(),
  configChangeListeners: [],
  statusBarItem: undefined,
};

/**
 * Resets all stub state between tests.
 */
export function resetVscodeStub(): void {
  state.configValues = new Map();
  state.gitExtension = undefined;
  state.outputLines = [];
  state.commands = new Map();
  state.configChangeListeners = [];
  state.statusBarItem = undefined;
}

/**
 * Replaces the `autoPull` configuration values returned by the stub.
 *
 * @param values - Raw setting values keyed without the section prefix.
 */
export function stubSetConfiguration(values: Record<string, unknown>): void {
  state.configValues = new Map(Object.entries(values));
}

/**
 * Sets or removes the fake built-in Git extension.
 *
 * @param extension - Extension double or undefined for "not installed".
 */
export function stubSetGitExtension(extension: StubGitExtension | undefined): void {
  state.gitExtension = extension;
}

/**
 * @returns All output-channel lines captured so far.
 */
export function stubGetOutputLines(): readonly string[] {
  return state.outputLines;
}

/**
 * @returns Registered commands by identifier.
 */
export function stubGetCommands(): ReadonlyMap<string, (...args: unknown[]) => unknown> {
  return state.commands;
}

/**
 * @returns Registered configuration-change listeners.
 */
export function stubGetConfigChangeListeners(): readonly ((event: {
  affectsConfiguration(section: string): boolean;
}) => unknown)[] {
  return state.configChangeListeners;
}

/**
 * @returns The status-bar item created by the extension, if any.
 */
export function stubGetStatusBarItem(): StubStatusBarItem | undefined {
  return state.statusBarItem;
}

/**
 * Alignment enum compatible with `vscode.StatusBarAlignment`.
 */
export const StatusBarAlignment = { Left: 1, Right: 2 } as const;

/**
 * Window namespace double.
 */
export const window = {
  /**
   * Creates an output channel double appending to the captured line list.
   *
   * @param _name - Channel title (ignored by the double).
   * @returns Sink with `appendLine`.
   */
  createOutputChannel(_name: string): { appendLine(line: string): void; dispose(): void } {
    return {
      appendLine: (line: string) => {
        state.outputLines.push(line);
      },
      dispose(): void {},
    };
  },
  /**
   * Creates the singleton status-bar item double.
   *
   * @param _alignment - Alignment value (ignored by the double).
   * @param _priority - Priority value (ignored by the double).
   * @returns Status-bar double with counters.
   */
  createStatusBarItem(_alignment: number, _priority: number): StubStatusBarItem {
    const item: StubStatusBarItem = {
      text: '',
      tooltip: '',
      showCount: 0,
      hideCount: 0,
      show() {
        item.showCount += 1;
      },
      hide() {
        item.hideCount += 1;
      },
      dispose() {},
    };
    state.statusBarItem = item;

    return item;
  },
};

/**
 * Commands namespace double recording registrations.
 */
export const commands = {
  /**
   * Registers a command callback.
   *
   * @param command - Command identifier.
   * @param callback - Handler to record.
   * @returns A no-op disposable.
   */
  registerCommand(command: string, callback: (...args: unknown[]) => unknown): { dispose(): void } {
    state.commands.set(command, callback);

    return { dispose(): void {} };
  },
};

/**
 * Workspace namespace double.
 */
export const workspace = {
  /**
   * Returns a configuration double reading the stub values.
   *
   * @param _section - Configuration section (values are stored flat).
   * @returns Object with a `get` read surface.
   */
  getConfiguration(_section: string): { get(key: string): unknown } {
    return {
      get: (key: string): unknown => state.configValues.get(key),
    };
  },
  /**
   * Records a configuration-change listener.
   *
   * @param listener - Listener to record.
   * @returns A no-op disposable.
   */
  onDidChangeConfiguration(listener: (event: {
    affectsConfiguration(section: string): boolean;
  }) => unknown): { dispose(): void } {
    state.configChangeListeners.push(listener);

    return { dispose(): void {} };
  },
};

/**
 * Extensions namespace double.
 */
export const extensions = {
  /**
   * Resolves the fake built-in Git extension by identifier.
   *
   * @param extensionId - Requested extension identifier.
   * @returns The configured double or undefined.
   */
  getExtension(extensionId: string): StubGitExtension | undefined {
    return extensionId === 'vscode.git' ? state.gitExtension : undefined;
  },
};
