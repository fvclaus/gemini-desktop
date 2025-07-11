import {
  test,
  expect,
  chromium,
  Browser,
  Page,
  BrowserContext,
} from '@playwright/test';
import {
  UserMessage,
  ToolResultMessage,
  LoadingMessage,
  ToolDecisionMessage,
} from '../src/app/services/chat.service';
import { Gemini25Pro } from '../src/app/domain/models';
import {
  SerializedAiMessage,
  SerializedChatSession,
  SerializedToolRequestMessage,
} from '../src/app/services/serialization.utils';

test.describe('ChatMessageComponent Visual Snapshots', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let electronApiMock!: Window['electronAPI'];
  let chatSession!: SerializedChatSession;

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext();
    page = await context.newPage();

    let id = 0;
    chatSession = {
      id: 'single-test-session',
      startTime: new Date(),
      messages: [
        {
          sender: 'user',
          type: 'message',
          text: 'Read the file hello_world.txt for me',
          timestamp: new Date(),
          id: `${id++}`,
        } as UserMessage,
        {
          sender: 'ai',
          type: 'tool_request',
          timestamp: new Date(),
          id: `${id++}`,
          showRequestedTools: true,
          model: Gemini25Pro.name,
          tools: [
            {
              serverName: 'filesystem',
              toolName: 'read_file',
              args: {
                path: 'hello_word.txt',
              },
            },
          ],
        } as SerializedToolRequestMessage,
        {
          sender: 'user',
          type: 'tool_decision',
          approval: 'approved',
          timestamp: new Date(),
          id: `${id++}`,
        } as ToolDecisionMessage,
        {
          sender: 'user',
          type: 'tool_decision',
          approval: 'rejected',
          timestamp: new Date(),
          id: `${id++}`,
        } as ToolDecisionMessage,
        {
          sender: 'system',
          type: 'tool_result',
          tool: {
            name: 'read_file',
            args: {
              path: 'hello_word.txt',
            },
          },
          result: {
            output: 'Success details.',
          },
          timestamp: new Date(),
          id: `${id++}`,
        } as ToolResultMessage,
        {
          sender: 'ai',
          type: 'message',
          text: 'The content of the file is:\n```\nSimulated result for read_file\n```',
          model: Gemini25Pro.name,
          htmlContent:
            '<p>The content of the file is:</p>\n<pre><code>Simulated result for read_file\n</code></pre>\n',
          timestamp: new Date(),
          id: `${id++}`,
        } as SerializedAiMessage,
        {
          sender: 'ai',
          type: 'loading',
          text: '...',
          timestamp: new Date(),
          id: 'msg9',
        } as LoadingMessage,
      ],
    };

    await page.addInitScript((chatSession) => {
      localStorage.setItem(
        'chat_session_history',
        JSON.stringify([chatSession]),
      );
      localStorage.setItem('api_key', '########');
    }, chatSession);

    type ElectronApiValues = {
      [func in keyof Window['electronAPI']]: {
        value: Awaited<ReturnType<Window['electronAPI'][func]>>;
        status: 'resolved' | 'rejected';
      };
    };

    const values: ElectronApiValues = {
      callMcpTool: { value: {}, status: 'resolved' },
      changeWorkspaceAndReload: { value: '', status: 'resolved' },
      getInitialWorkspace: { value: null, status: 'resolved' },
      getMcpServers: { value: [], status: 'resolved' },
      getSelectedWorkspace: { value: null, status: 'resolved' },
      showOpenDialog: {
        value: { canceled: true },
        status: 'resolved',
      } as const,
      onMcpServerStatus: { value: undefined, status: 'resolved' },
      onWorkspaceSelected: { value: undefined, status: 'resolved' },
      setToolVisibility: { value: undefined, status: 'resolved' },
    };
    await page.addInitScript((electronAPIValues: ElectronApiValues) => {
      function createPromise<T>({
        value,
        status,
      }: {
        value: T;
        status: string;
      }): Promise<T> {
        if (status === 'resolved') {
          return Promise.resolve(value);
        } else {
          return Promise.reject(value);
        }
      }
      window.electronAPI = {
        callMcpTool: () => createPromise(electronAPIValues.callMcpTool),
        changeWorkspaceAndReload: () =>
          createPromise(electronAPIValues.changeWorkspaceAndReload),
        getInitialWorkspace: () =>
          createPromise(electronAPIValues.getInitialWorkspace),
        getMcpServers: () => createPromise(electronAPIValues.getMcpServers),
        getSelectedWorkspace: () =>
          createPromise(electronAPIValues.getSelectedWorkspace),
        showOpenDialog: () => createPromise(electronAPIValues.showOpenDialog),
        onMcpServerStatus: () => {},
        onWorkspaceSelected: () => {},
        setToolVisibility: () =>
          createPromise(electronAPIValues.setToolVisibility),
      };
    }, values);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByText('Read the file hello_world.txt for me').click();
    await page.waitForSelector('app-chat-message');
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test('should display a user message correctly', async () => {
    await expect(
      page.locator(`[data-test-id="${chatSession.messages[0].id}"]`),
    ).toHaveScreenshot('user-message.png');
  });

  test('should display a tool request message correctly', async () => {
    await expect(
      page.locator(`[data-test-id="${chatSession.messages[1].id}"]`),
    ).toHaveScreenshot('tool-request-message.png');
  });

  test('should display a tool decision approved message correctly', async () => {
    await expect(
      page.locator(`[data-test-id="${chatSession.messages[2].id}"]`),
    ).toHaveScreenshot('tool-decision-approved-message.png');
  });

  test('should display a tool decision rejected message correctly', async () => {
    await expect(
      page.locator(`[data-test-id="${chatSession.messages[3].id}"]`),
    ).toHaveScreenshot('tool-decision-rejected-message.png');
  });

  test('should display a tool result message correctly', async () => {
    await expect(
      page.locator(`[data-test-id="${chatSession.messages[4].id}"]`),
    ).toHaveScreenshot('tool-result-message.png');
  });

  test('should display an AI text message correctly', async () => {
    await expect(
      page.locator(`[data-test-id="${chatSession.messages[5].id}"]`),
    ).toHaveScreenshot('ai-message.png');
  });

  test('should display a loading message correctly', async () => {
    await expect(
      page.locator(`[data-test-id="${chatSession.messages[6].id}"]`),
    ).toHaveScreenshot('loading-message.png');
  });
});
