/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as vscodeTypes from './vscodeTypes';
import { TestModelCollection } from './testModel';
import { uriToPath } from './utils';
import * as vscode from 'vscode';

// Access LanguageModelTextPart and MarkdownString from vscode
// LanguageModelTextPart is directly on vscode namespace, not vscode.lm
const LanguageModelTextPart = (vscode as any).LanguageModelTextPart;
const MarkdownString = vscode.MarkdownString;

// Helper function to create text part - handles cases where LanguageModelTextPart might not be available
function createTextPart(text: string): any {
  if (LanguageModelTextPart)
    return new LanguageModelTextPart(text);

  // Fallback for older VS Code versions
  return { type: 'text', text };
}

// Parameter interfaces for each tool
export interface IRunTestsParameters {
  filePath?: string;
  testName?: string;
  projectName?: string;
}

export interface IDebugTestsParameters {
  filePath?: string;
  testName?: string;
  projectName?: string;
}

export interface IListTestsParameters {
  filePath?: string;
}

export interface IGenerateLocatorParameters {
  description: string;
}

export interface IGetTestResultsParameters {
  // No parameters needed
}

export interface IGetConfigParameters {
  // No parameters needed
}

export interface IRecordFromExistingTestParameters {
  testPath: string;
}

/**
 * Tool for running Playwright tests
 */
export class RunTestsTool implements vscodeTypes.LanguageModelTool<IRunTestsParameters> {
  constructor(
    private vscode: vscodeTypes.VSCode,
    private models: TestModelCollection,
    private testController: vscodeTypes.TestController,
    private runProfile: vscodeTypes.TestRunProfile
  ) {}

  async prepareInvocation(
    options: vscodeTypes.LanguageModelToolInvocationPrepareOptions<IRunTestsParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.PreparedToolInvocation> {
    const { filePath, testName, projectName } = options.input;

    let message = 'Run Playwright tests';
    if (testName)
      message += ` for test "${testName}"`;

    if (filePath)
      message += ` in file ${filePath}"`;

    if (projectName)
      message += ` for project ${projectName}`;


    return {
      invocationMessage: message,
      confirmationMessages: {
        title: 'Run Playwright Tests',
        message: new MarkdownString(
            message + '?\n\nThis will execute the tests in your workspace.'
        ),
      },
    };
  }

  async invoke(
    options: vscodeTypes.LanguageModelToolInvocationOptions<IRunTestsParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.LanguageModelToolResult> {
    const { filePath, testName } = options.input;

    if (!this.models.hasEnabledModels()) {
      return {
        content: [
          createTextPart('No Playwright tests found in the workspace. Please ensure you have a playwright.config file and tests defined.')
        ]
      };
    }

    try {
      const model = this.models.selectedModel();
      if (!model) {
        return {
          content: [
            createTextPart('No Playwright model is currently selected.')
          ]
        };
      }

      let testItem: vscodeTypes.TestItem | undefined;

      // Try to find the specific test item
      if (filePath || testName) {
        const findTest = (item: vscodeTypes.TestItem): vscodeTypes.TestItem | undefined => {
          const itemUri = item.uri ? uriToPath(item.uri) : '';
          const itemLabel = item.label || '';

          if (filePath && itemUri.includes(filePath)) {
            if (testName && itemLabel.includes(testName))
              return item;
            else if (!testName)
              return item;

          }

          // Search children
          const children = (item as any).children;
          if (children) {
            for (const [, child] of children) {
              const found = findTest(child);
              if (found)
                return found;

            }
          }
          return undefined;
        };

        this.testController.items.forEach(item => {
          if (!testItem)
            testItem = findTest(item);

        });
      }

      // Execute the test run
      const request = new this.vscode.TestRunRequest(
          testItem ? [testItem] : undefined,
          undefined,
          this.runProfile,
          false
      );

      // Trigger the test run by calling the run profile's handler
      await this.runProfile.runHandler(request, new this.vscode.CancellationTokenSource().token);

      let resultMessage = 'Test execution started';
      if (testName)
        resultMessage += ` for test "${testName}"`;
      else if (filePath)
        resultMessage += ` for file ${filePath}`;
      else
        resultMessage += ' for all tests';

      resultMessage += '. Check the Test Results view for details.';

      return {
        content: [
          createTextPart(resultMessage)
        ]
      };
    } catch (error: any) {
      return {
        content: [
          createTextPart(`Error running tests: ${error.message || String(error)}`)
        ]
      };
    }
  }
}

/**
 * Tool for debugging Playwright tests
 */
export class DebugTestsTool implements vscodeTypes.LanguageModelTool<IDebugTestsParameters> {
  constructor(
    private vscode: vscodeTypes.VSCode,
    private models: TestModelCollection,
    private testController: vscodeTypes.TestController,
    private debugProfile: vscodeTypes.TestRunProfile
  ) {}

  async prepareInvocation(
    options: vscodeTypes.LanguageModelToolInvocationPrepareOptions<IDebugTestsParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.PreparedToolInvocation> {
    const { filePath, testName, projectName } = options.input;

    let message = 'Debug Playwright tests';
    if (testName)
      message += ` for test "${testName}"`;

    if (filePath)
      message += ` in file ${filePath}"`;

    if (projectName)
      message += ` for project ${projectName}`;


    return {
      invocationMessage: message,
      confirmationMessages: {
        title: 'Debug Playwright Tests',
        message: new MarkdownString(
            message + '?\n\nThis will start a debug session for the tests in your workspace.'
        ),
      },
    };
  }

  async invoke(
    options: vscodeTypes.LanguageModelToolInvocationOptions<IDebugTestsParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.LanguageModelToolResult> {
    const { filePath, testName } = options.input;

    if (!this.models.hasEnabledModels()) {
      return {
        content: [
          createTextPart('No Playwright tests found in the workspace. Please ensure you have a playwright.config file and tests defined.')
        ]
      };
    }

    try {
      const model = this.models.selectedModel();
      if (!model) {
        return {
          content: [
            createTextPart('No Playwright model is currently selected.')
          ]
        };
      }

      let testItem: vscodeTypes.TestItem | undefined;

      // Try to find the specific test item
      if (filePath || testName) {
        const findTest = (item: vscodeTypes.TestItem): vscodeTypes.TestItem | undefined => {
          const itemUri = item.uri ? uriToPath(item.uri) : '';
          const itemLabel = item.label || '';

          if (filePath && itemUri.includes(filePath)) {
            if (testName && itemLabel.includes(testName))
              return item;
            else if (!testName)
              return item;

          }

          // Search children
          const children = (item as any).children;
          if (children) {
            for (const [, child] of children) {
              const found = findTest(child);
              if (found)
                return found;

            }
          }
          return undefined;
        };

        this.testController.items.forEach(item => {
          if (!testItem)
            testItem = findTest(item);

        });
      }

      // Execute the test debug
      const request = new this.vscode.TestRunRequest(
          testItem ? [testItem] : undefined,
          undefined,
          this.debugProfile,
          false
      );

      // Trigger the debug session by calling the debug profile's handler
      await this.debugProfile.runHandler(request, new this.vscode.CancellationTokenSource().token);

      let resultMessage = 'Debug session started';
      if (testName)
        resultMessage += ` for test "${testName}"`;
      else if (filePath)
        resultMessage += ` for file ${filePath}`;
      else
        resultMessage += ' for all tests';

      resultMessage += '. Check the Debug Console for details.';

      return {
        content: [
          createTextPart(resultMessage)
        ]
      };
    } catch (error: any) {
      return {
        content: [
          createTextPart(`Error debugging tests: ${error.message || String(error)}`)
        ]
      };
    }
  }
}

/**
 * Tool for listing Playwright tests
 */
export class ListTestsTool implements vscodeTypes.LanguageModelTool<IListTestsParameters> {
  constructor(
    private vscode: vscodeTypes.VSCode,
    private models: TestModelCollection,
    private testController: vscodeTypes.TestController
  ) {}

  async prepareInvocation(
    options: vscodeTypes.LanguageModelToolInvocationPrepareOptions<IListTestsParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.PreparedToolInvocation> {
    const { filePath } = options.input;

    const message = filePath
      ? `List Playwright tests in ${filePath}`
      : 'List all Playwright tests in the workspace';

    return {
      invocationMessage: message,
    };
  }

  async invoke(
    options: vscodeTypes.LanguageModelToolInvocationOptions<IListTestsParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.LanguageModelToolResult> {
    const { filePath } = options.input;

    if (!this.models.hasEnabledModels()) {
      return {
        content: [
          createTextPart('No Playwright tests found in the workspace.')
        ]
      };
    }

    try {
      const tests: Array<{ file: string; name: string; line?: number }> = [];

      const collectTests = (item: vscodeTypes.TestItem, level: number = 0) => {
        const itemUri = item.uri ? uriToPath(item.uri) : '';
        const itemLabel = item.label || '';
        const range = item.range;

        if (!filePath || itemUri.includes(filePath)) {
          if (itemUri && itemLabel) {
            tests.push({
              file: itemUri,
              name: itemLabel,
              line: range?.start.line
            });
          }
        }

        // Recursively collect children
        const children = (item as any).children;
        if (children) {
          for (const [, child] of children)
            collectTests(child, level + 1);

        }
      };

      this.testController.items.forEach(item => collectTests(item));

      if (tests.length === 0) {
        return {
          content: [
            createTextPart(filePath ? `No tests found in ${filePath}` : 'No tests found in the workspace')
          ]
        };
      }

      // Group tests by file
      const testsByFile = new Map<string, Array<{ name: string; line?: number }>>();
      for (const test of tests) {
        if (!testsByFile.has(test.file))
          testsByFile.set(test.file, []);

        testsByFile.get(test.file)!.push({ name: test.name, line: test.line });
      }

      let output = `Found ${tests.length} test(s) in ${testsByFile.size} file(s):\n\n`;

      for (const [file, fileTests] of testsByFile) {
        const workspaceFolder = this.vscode.workspace.workspaceFolders?.[0];
        const relativePath = workspaceFolder
          ? file.replace(uriToPath(workspaceFolder.uri), '').replace(/^[\\\/]/, '')
          : file;

        output += `**${relativePath}**\n`;
        for (const test of fileTests) {
          output += `  - ${test.name}`;
          if (test.line !== undefined)
            output += ` (line ${test.line + 1})`;

          output += '\n';
        }
        output += '\n';
      }

      return {
        content: [
          createTextPart(output)
        ]
      };
    } catch (error: any) {
      return {
        content: [
          createTextPart(`Error listing tests: ${error.message || String(error)}`)
        ]
      };
    }
  }
}

/**
 * Tool for generating Playwright locators
 */
export class GenerateLocatorTool implements vscodeTypes.LanguageModelTool<IGenerateLocatorParameters> {
  constructor(
    private vscode: vscodeTypes.VSCode,
    private models: TestModelCollection
  ) {}

  async prepareInvocation(
    options: vscodeTypes.LanguageModelToolInvocationPrepareOptions<IGenerateLocatorParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.PreparedToolInvocation> {
    return {
      invocationMessage: `Open Playwright inspector to locate: ${options.input.description}`,
      confirmationMessages: {
        title: 'Generate Playwright Locator',
        message: new MarkdownString(
            `Open Playwright inspector to generate a locator for: **${options.input.description}**\n\n` +
          'This will open the browser with the inspector enabled.'
        ),
      },
    };
  }

  async invoke(
    options: vscodeTypes.LanguageModelToolInvocationOptions<IGenerateLocatorParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.LanguageModelToolResult> {
    if (!this.models.hasEnabledModels()) {
      return {
        content: [
          createTextPart('No Playwright tests found in the workspace.')
        ]
      };
    }

    try {
      // Execute the inspect command
      await this.vscode.commands.executeCommand('pw.extension.command.inspect');

      return {
        content: [
          createTextPart(`Playwright inspector opened. Use it to identify and generate a locator for: ${options.input.description}\n\nOnce you pick an element, the locator will be copied to your clipboard.`)
        ]
      };
    } catch (error: any) {
      return {
        content: [
          createTextPart(`Error opening inspector: ${error.message || String(error)}`)
        ]
      };
    }
  }
}

/**
 * Tool for getting test results
 */
export class GetTestResultsTool implements vscodeTypes.LanguageModelTool<IGetTestResultsParameters> {
  constructor(
    private vscode: vscodeTypes.VSCode,
    private models: TestModelCollection,
    private testController: vscodeTypes.TestController
  ) {}

  async prepareInvocation(
    _options: vscodeTypes.LanguageModelToolInvocationPrepareOptions<IGetTestResultsParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.PreparedToolInvocation> {
    return {
      invocationMessage: 'Get results from the last Playwright test run',
    };
  }

  async invoke(
    _options: vscodeTypes.LanguageModelToolInvocationOptions<IGetTestResultsParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.LanguageModelToolResult> {
    try {
      // Get test results from the test controller
      const results: Array<{ name: string; state: string; message?: string }> = [];

      const collectResults = (item: vscodeTypes.TestItem) => {
        // Access test results if available
        const itemAny = item as any;
        if (itemAny.error || itemAny.status) {
          results.push({
            name: item.label || 'Unknown',
            state: itemAny.status || 'unknown',
            message: itemAny.error?.message
          });
        }

        const children = itemAny.children;
        if (children) {
          for (const [, child] of children)
            collectResults(child);

        }
      };

      this.testController.items.forEach(item => collectResults(item));

      if (results.length === 0)
        return { content: [createTextPart('No test results available. Please run tests first.')] };


      let output = '# Last Test Run Results\n\n';

      const passed = results.filter(r => r.state === 'passed').length;
      const failed = results.filter(r => r.state === 'failed').length;
      const skipped = results.filter(r => r.state === 'skipped').length;

      output += `**Summary**: ${passed} passed, ${failed} failed, ${skipped} skipped\n\n`;

      if (failed > 0) {
        output += '## Failed Tests\n\n';
        for (const result of results.filter(r => r.state === 'failed')) {
          output += `- **${result.name}**\n`;
          if (result.message)
            output += `  \`\`\`\n  ${result.message}\n  \`\`\`\n`;

        }
      }

      return {
        content: [
          createTextPart(output)
        ]
      };
    } catch (error: any) {
      return {
        content: [
          createTextPart(`Error getting configuration: ${error.message || String(error)}`)
        ]
      };
    }
  }
}

/**
 * Tool for getting Playwright configuration
 */
export class GetConfigTool implements vscodeTypes.LanguageModelTool<IGetConfigParameters> {
  constructor(
    private vscode: vscodeTypes.VSCode,
    private models: TestModelCollection
  ) {}

  async prepareInvocation(
    _options: vscodeTypes.LanguageModelToolInvocationPrepareOptions<IGetConfigParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.PreparedToolInvocation> {
    return {
      invocationMessage: 'Get Playwright configuration information',
    };
  }

  async invoke(
    _options: vscodeTypes.LanguageModelToolInvocationOptions<IGetConfigParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.LanguageModelToolResult> {
    if (!this.models.hasEnabledModels()) {
      return {
        content: [
          createTextPart('No Playwright configuration found in the workspace.')
        ]
      };
    }

    try {
      const model = this.models.selectedModel();
      if (!model) {
        return {
          content: [
            createTextPart('No Playwright model is currently selected.')
          ]
        };
      }

      const config = (model as any).config;
      const projects = model.enabledProjects ? model.enabledProjects() : [];

      let output = '# Playwright Configuration\n\n';

      if (config?.configFile)
        output += `**Config File**: ${config.configFile}\n\n`;


      if (config?.testDir)
        output += `**Test Directory**: ${config.testDir}\n\n`;


      if (projects.length > 0) {
        output += '## Projects\n\n';
        for (const project of projects) {
          const projectAny = project as any;
          output += `- **${projectAny.name || 'default'}**\n`;
          if (projectAny.testDir)
            output += `  - Test Dir: ${projectAny.testDir}\n`;

          if (projectAny.use?.browserName)
            output += `  - Browser: ${projectAny.use.browserName}\n`;

        }
        output += '\n';
      }

      const settings = this.vscode.workspace.getConfiguration('playwright');
      const envVars = settings.get('env');
      const reuseBrowser = settings.get('reuseBrowser');
      const showTrace = settings.get('showTrace');

      output += '## Extension Settings\n\n';
      output += `- **Reuse Browser**: ${reuseBrowser}\n`;
      output += `- **Show Trace**: ${showTrace}\n`;
      if (envVars && Object.keys(envVars).length > 0)
        output += `- **Environment Variables**: ${JSON.stringify(envVars, null, 2)}\n`;


      return {
        content: [
          createTextPart(output)
        ]
      };
    } catch (error: any) {
      return {
        content: [
          createTextPart(`Error getting configuration: ${error.message || String(error)}`)
        ]
      };
    }
  }
}

/**
 * Tool for recording Playwright tests from existing tests
 */
export class RecordFromExistingTestTool implements vscodeTypes.LanguageModelTool<IRecordFromExistingTestParameters> {
  constructor(
    private vscode: vscodeTypes.VSCode,
    private models: TestModelCollection
  ) {}

  async prepareInvocation(
    options: vscodeTypes.LanguageModelToolInvocationPrepareOptions<IRecordFromExistingTestParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.PreparedToolInvocation> {
    const { testPath } = options.input;

    const message = `Record Playwright test from existing test: ${testPath}`;

    return {
      invocationMessage: message,
      confirmationMessages: {
        title: 'Record from Existing Test',
        message: new MarkdownString(
            message + '?\n\nThis will start a Playwright recording session and run the existing test to capture its actions.'
        ),
      },
    };
  }

  async invoke(
    options: vscodeTypes.LanguageModelToolInvocationOptions<IRecordFromExistingTestParameters>,
    _token: vscodeTypes.CancellationToken
  ): Promise<vscodeTypes.LanguageModelToolResult> {
    const { testPath } = options.input;

    try {
      const savedFilePath = await this.vscode.commands.executeCommand('pw.extension.command.recordFromExistingTest', testPath) as string | undefined;

      let message = `Successfully recorded Playwright test from existing test: ${testPath}\n\n`;
      if (savedFilePath)
        message += `The recorded test has been saved to: ${savedFilePath}\n\n`;

      message += 'The recording has been completed. The existing test ran in the Playwright browser, ' +
        'and all actions were captured into a new Playwright test file. ' +
        'The recording automatically stopped when the existing test finished.';

      return {
        content: [createTextPart(message)],
      };
    } catch (error: any) {
      return {
        content: [
          createTextPart(
              `Failed to record from existing test: ${error.message || error}\n\n` +
              'Make sure:\n' +
              '1. The existing test path is correct\n' +
              '2. The Python environment is set up\n' +
              '3. Playwright config has --remote-debugging-port=19222 in launchOptions.args'
          ),
        ],
      };
    }
  }
}

/**
 * Register all Playwright language model tools
 */
export function registerLanguageModelTools(
  context: vscodeTypes.ExtensionContext,
  vscode: vscodeTypes.VSCode,
  models: TestModelCollection,
  testController: vscodeTypes.TestController,
  runProfile: vscodeTypes.TestRunProfile,
  debugProfile: vscodeTypes.TestRunProfile
): void {
  // Check if language model API is available
  const lmApi = (vscode as any).lm as any;
  if (!lmApi || !lmApi.registerTool) {
    console.log('Language Model API not available, skipping tool registration');
    return;
  }

  try {
    context.subscriptions.push(
        lmApi.registerTool('playwright_runTests', new RunTestsTool(vscode, models, testController, runProfile)),
        lmApi.registerTool('playwright_debugTests', new DebugTestsTool(vscode, models, testController, debugProfile)),
        lmApi.registerTool('playwright_listTests', new ListTestsTool(vscode, models, testController)),
        lmApi.registerTool('playwright_generateLocator', new GenerateLocatorTool(vscode, models)),
        lmApi.registerTool('playwright_getTestResults', new GetTestResultsTool(vscode, models, testController)),
        lmApi.registerTool('playwright_getConfig', new GetConfigTool(vscode, models)),
        lmApi.registerTool('playwright_recordFromExistingTest', new RecordFromExistingTestTool(vscode, models))
    );

    console.log('Playwright language model tools registered successfully');
  } catch (error) {
    console.error('Error registering language model tools:', error);
  }
}

