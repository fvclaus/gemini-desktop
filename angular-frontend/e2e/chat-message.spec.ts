import {
  test,
  expect,
  chromium,
  Browser,
  Page,
  BrowserContext,
} from '@playwright/test';
import { ChatSession } from '../src/app/services/chat-session.interface';
import {
  UserMessage,
  AiMessage,
  ToolRequestMessage,
  ToolResultMessage,
  LoadingMessage,
  ToolDecisionMessage,
} from '../src/app/services/chat.service';

test.describe('ChatMessageComponent Visual Snapshots', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let electronApiMock!: Window['electronAPI'];
  let chatSession!: ChatSession;

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
          tools: [
            {
              name: 'read_file',
              args: {
                path: 'hello_word.txt',
              },
            },
          ],
        } as ToolRequestMessage,
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
          result: 'Success details.',
          timestamp: new Date(),
          id: `${id++}`,
        } as ToolResultMessage,
        {
          sender: 'ai',
          type: 'message',
          text: 'The content of the file is:\n```\nSimulated result for read_file\n```',
          htmlContent:
            '<p>The content of the file is:</p>\n<pre><code>Simulated result for read_file\n</code></pre>\n',
          timestamp: new Date(),
          id: `${id++}`,
        } as AiMessage,
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

    const values = {
      callMcpTool: { value: null, status: 'resolved' },
      changeWorkspaceAndReload: { value: '', status: 'resolved' },
      getInitialWorkspace: { value: null, status: 'resolved' },
      getMcpServers: { value: [], status: 'resolved' },
      getSelectedWorkspace: { value: null, status: 'resolved' },
      showOpenDialog: { value: { canceled: true }, status: 'resolved' },
      onMcpServerStatus: { value: undefined, status: 'resolved' },
      onWorkspaceSelected: { value: undefined, status: 'resolved' },
    };
    await page.addInitScript((electronAPIValues) => {
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
        callMcpTool: () =>
          createPromise({
            ...electronAPIValues.callMcpTool,
            status: electronAPIValues.callMcpTool.status as
              | 'resolved'
              | 'rejected',
          }),
        changeWorkspaceAndReload: () =>
          createPromise({
            ...electronAPIValues.changeWorkspaceAndReload,
            status: electronAPIValues.changeWorkspaceAndReload.status as
              | 'resolved'
              | 'rejected',
          }),
        getInitialWorkspace: () =>
          createPromise({
            ...electronAPIValues.getInitialWorkspace,
            status: electronAPIValues.getInitialWorkspace.status as
              | 'resolved'
              | 'rejected',
          }),
        getMcpServers: () =>
          createPromise({
            ...electronAPIValues.getMcpServers,
            status: electronAPIValues.getMcpServers.status as
              | 'resolved'
              | 'rejected',
          }),
        getSelectedWorkspace: () =>
          createPromise({
            ...electronAPIValues.getSelectedWorkspace,
            status: electronAPIValues.getSelectedWorkspace.status as
              | 'resolved'
              | 'rejected',
          }),
        showOpenDialog: () =>
          createPromise({
            ...(electronAPIValues.showOpenDialog as {
              value: { canceled: boolean };
              status: 'resolved' | 'rejected';
            }),
            status: electronAPIValues.showOpenDialog.status as
              | 'resolved'
              | 'rejected',
          }),
        onMcpServerStatus: (callback) => {},
        onWorkspaceSelected: (callback) => {},
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
