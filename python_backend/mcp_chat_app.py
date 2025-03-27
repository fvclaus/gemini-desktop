# python_backend/mcp_chat_app.py
import asyncio
import sys
import os
from dotenv import load_dotenv
from contextlib import AsyncExitStack
from typing import List, Dict, Any, Optional, Tuple, Set
import logging

from google import genai
from google.genai import types as genai_types
from google.genai import errors as genai_errors
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

load_dotenv()


class MCPChatApp:
    def __init__(self, gemini_model_name: str = "gemini-1.5-flash-latest"):
        self.gemini_model_name = gemini_model_name
        self.gemini_sync_client: Optional[genai.Client] = None
        self.gemini_client: Optional[genai.client.AsyncClient] = None
        self.mcp_tools: List[Any] = []
        self.tool_to_session: Dict[str, ClientSession] = {}
        self.chat_history: List[genai_types.Content] = []
        self.connected_server_paths: Set[str] = set()
        self.server_resources: Dict[str, Dict[str, Any]] = {}
        self.cached_gemini_declarations: Optional[List[genai_types.FunctionDeclaration]] = None
        self.gemini_tools_dirty: bool = True
        self.status_check_task: Optional[asyncio.Task] = None
        self.api_key: Optional[str] = None

    async def initialize_gemini(self):
        api_key_to_use = self.api_key or os.getenv("GEMINI_API_KEY")
        if not api_key_to_use:
            logger.error(
                "GEMINI_API_KEY not found in environment variables or instance.")
            raise ValueError("GEMINI_API_KEY is required.")
        try:
            self.gemini_sync_client = genai.Client(api_key=api_key_to_use)
            self.gemini_client = self.gemini_sync_client.aio
            logger.info("Gemini async client initialized successfully.")
            if not self.status_check_task or self.status_check_task.done():
                self.status_check_task = asyncio.create_task(
                    self._periodic_status_checker())
                logger.info("Started periodic server status checker.")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            self.gemini_client = None  # Ensure client is None on failure
            self.gemini_sync_client = None
            raise

    async def set_api_key_and_reinitialize(self, new_key: str):
        logger.info("Received new API key, attempting to re-initialize Gemini.")
        self.api_key = new_key
        try:
            await self.initialize_gemini()
            logger.info(
                "Gemini client re-initialized successfully with new API key.")
        except Exception as e:
            logger.error(
                f"Failed to re-initialize Gemini with new API key: {e}")
            self.api_key = None  # Revert if initialization fails
            raise

    async def _check_server_status(self, path: str, session: ClientSession):
        try:
            await session.list_tools()
            if self.server_resources.get(path, {}).get('status') == 'error':
                logger.info(
                    f"Server '{os.path.basename(path)}' recovered, setting status to 'connected'.")
                self.server_resources[path]['status'] = 'connected'
        except Exception as e:
            if self.server_resources.get(path, {}).get('status') == 'connected':
                logger.warning(
                    f"Server '{os.path.basename(path)}' became unresponsive: {e}. Setting status to 'error'.")
                self.server_resources[path]['status'] = 'error'

    async def _periodic_status_checker(self, interval_seconds: int = 10):
        while True:
            await asyncio.sleep(interval_seconds)
            logger.debug("Running periodic server status check...")
            tasks = []
            for path, resources in list(self.server_resources.items()):
                if 'session' in resources:
                    tasks.append(self._check_server_status(
                        path, resources['session']))
            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        try:
                            path = list(self.server_resources.keys())[i]
                            logger.error(
                                f"Error during periodic status check gather for {path}: {result}", exc_info=result)
                        except IndexError:
                            logger.error(
                                f"Error during periodic status check gather (index {i}): {result}", exc_info=result)
            logger.debug("Periodic server status check finished.")

    async def connect_to_mcp_server(self, server_script_path: str) -> List[str]:
        if not os.path.exists(server_script_path):
            logger.error(f"MCP server script not found: {server_script_path}")
            raise FileNotFoundError(
                f"Server script not found: {server_script_path}")

        if server_script_path in self.connected_server_paths:
            logger.warning(
                f"Server script '{server_script_path}' is already connected. Skipping.")
            raise ValueError(
                f"Server '{os.path.basename(server_script_path)}' is already connected.")

        is_python = server_script_path.endswith('.py')
        is_js = server_script_path.endswith('.js')
        if not (is_python or is_js):
            logger.warning(
                f"Unsupported server script type: {server_script_path}. Skipping.")
            raise ValueError(
                f"Unsupported server script type: {server_script_path}")

        command = sys.executable if is_python else "node"
        server_params = StdioServerParameters(
            command=command,
            args=[server_script_path],
            env=None
        )

        server_stack = AsyncExitStack()
        added_to_connected_paths = False
        try:
            logger.info(
                f"Connecting to MCP server: {server_script_path} using '{command}'")
            stdio_transport = await server_stack.enter_async_context(stdio_client(server_params))
            stdio, write = stdio_transport
            session = await server_stack.enter_async_context(ClientSession(stdio, write))
            await session.initialize()
            logger.info(f"Connected to MCP server: {server_script_path}")

            self.connected_server_paths.add(server_script_path)
            added_to_connected_paths = True

            response = await session.list_tools()
            server_tools = response.tools
            logger.info(
                f"Server {server_script_path} provides tools: {[tool.name for tool in server_tools]}")

            added_tools_names = []
            for tool in server_tools:
                if tool.name in self.tool_to_session:
                    logger.warning(
                        f"Tool name conflict: '{tool.name}' already exists. Skipping tool from {server_script_path}.")
                else:
                    self.mcp_tools.append(tool)
                    self.tool_to_session[tool.name] = session
                    added_tools_names.append(tool.name)
                    self.gemini_tools_dirty = True

            self.server_resources[server_script_path] = {
                'session': session,
                'stack': server_stack,
                'tools': added_tools_names,
                'status': 'connected',
            }
            logger.info(f"Stored resources for server: {server_script_path}")
            return added_tools_names
        except Exception as e:
            logger.error(
                f"Failed to connect to or initialize MCP server {server_script_path}: {e}", exc_info=True)
            await server_stack.aclose()
            if added_to_connected_paths:
                self.connected_server_paths.discard(server_script_path)
                logger.info(
                    f"Removed {server_script_path} from connected_server_paths due to connection error after initial add.")
            raise

    async def disconnect_mcp_server(self, server_script_path: str) -> bool:
        if server_script_path not in self.server_resources:
            logger.warning(
                f"Attempted to disconnect non-existent server: {server_script_path}")
            return False

        logger.info(f"Disconnecting MCP server: {server_script_path}")
        resources = self.server_resources.pop(server_script_path)
        stack = resources['stack']
        tools_to_remove = resources['tools']

        try:
            await stack.aclose()
            logger.info(
                f"Successfully closed resources for server: {server_script_path}")
        except Exception as e:
            logger.error(
                f"Error closing resources for server {server_script_path}: {e}", exc_info=True)

        self.connected_server_paths.discard(server_script_path)

        self.mcp_tools = [
            tool for tool in self.mcp_tools if tool.name not in tools_to_remove]
        for tool_name in tools_to_remove:
            self.tool_to_session.pop(tool_name, None)

        if tools_to_remove:
            self.gemini_tools_dirty = True
            logger.info(
                f"Removed tools from disconnected server {server_script_path}: {tools_to_remove}")

        logger.info(f"Successfully disconnected server: {server_script_path}")
        return True

    def get_gemini_tool_declarations(self) -> List[genai_types.FunctionDeclaration]:
        if not self.gemini_tools_dirty and self.cached_gemini_declarations is not None:
            return self.cached_gemini_declarations

        logger.info("Generating Gemini tool declarations.")
        declarations = []
        type_mapping = {
            'string': 'STRING',
            'number': 'NUMBER',
            'integer': 'INTEGER',
            'boolean': 'BOOLEAN',
            'array': 'ARRAY',
            'object': 'OBJECT',
        }

        for mcp_tool in self.mcp_tools:
            try:
                if hasattr(mcp_tool.inputSchema, 'model_dump'):
                    mcp_schema_dict = mcp_tool.inputSchema.model_dump(
                        exclude_none=True)
                elif isinstance(mcp_tool.inputSchema, dict):
                    mcp_schema_dict = mcp_tool.inputSchema
                else:
                    logger.warning(
                        f"MCP tool '{mcp_tool.name}' has unexpected inputSchema type: {type(mcp_tool.inputSchema)}. Skipping.")
                    continue

                if mcp_schema_dict.get('type', '').lower() != 'object':
                    logger.warning(
                        f"MCP tool '{mcp_tool.name}' has non-OBJECT inputSchema ('{mcp_schema_dict.get('type')}'). Skipping for Gemini.")
                    continue

                gemini_properties = {}
                required_props = mcp_schema_dict.get('required', [])
                valid_properties_found = False

                for prop_name, prop_schema_dict in mcp_schema_dict.get('properties', {}).items():
                    if not isinstance(prop_schema_dict, dict):
                        logger.warning(
                            f"Property '{prop_name}' in tool '{mcp_tool.name}' has non-dict schema. Skipping property.")
                        continue

                    mcp_type = prop_schema_dict.get('type', '').lower()
                    gemini_type_str = type_mapping.get(mcp_type)

                    if gemini_type_str:
                        gemini_properties[prop_name] = genai_types.Schema(
                            type=gemini_type_str,
                            description=prop_schema_dict.get('description')
                        )
                        valid_properties_found = True
                    else:
                        logger.warning(
                            f"Property '{prop_name}' in tool '{mcp_tool.name}' has unmappable MCP type '{mcp_type}'. Skipping property.")

                if valid_properties_found or not mcp_schema_dict.get('properties'):
                    gemini_params_schema = genai_types.Schema(
                        type='OBJECT',
                        properties=gemini_properties if gemini_properties else None,
                        required=required_props if required_props and gemini_properties else None
                    )

                    declaration = genai_types.FunctionDeclaration(
                        name=mcp_tool.name,
                        description=mcp_tool.description,
                        parameters=gemini_params_schema,
                    )
                    declarations.append(declaration)
                else:
                    logger.warning(
                        f"Skipping tool '{mcp_tool.name}' for Gemini: No valid properties could be mapped from its OBJECT schema.")

            except Exception as e:
                logger.error(
                    f"Failed to convert MCP tool '{mcp_tool.name}' to Gemini declaration: {e}. Skipping this tool.", exc_info=True)
                continue

        self.cached_gemini_declarations = declarations
        self.gemini_tools_dirty = False
        logger.info(f"Cached {len(declarations)} Gemini tool declarations.")
        return declarations

    async def execute_mcp_tool(self, tool_name: str, args: Dict[str, Any]) -> Optional[str]:
        if tool_name not in self.tool_to_session:
            logger.error(
                f"Attempted to call unknown or disconnected MCP tool: {tool_name}")
            return f"Error: Tool '{tool_name}' not found or its server is disconnected."

        session = self.tool_to_session[tool_name]
        server_path = None
        for path, resources in self.server_resources.items():
            if resources['session'] == session:
                server_path = path
                break

        if not server_path:
            logger.error(
                f"Could not find server path for tool '{tool_name}' with session {session}. This shouldn't happen.")
            return f"Error: Internal error finding server for tool '{tool_name}'."

        try:
            logger.info(f"Executing MCP tool '{tool_name}' with args: {args}")
            response = await session.call_tool(tool_name, args)
            logger.info(f"MCP tool '{tool_name}' executed successfully.")
            if self.server_resources[server_path]['status'] == 'error':
                logger.info(
                    f"Server '{os.path.basename(server_path)}' recovered, setting status to 'connected'.")
                self.server_resources[server_path]['status'] = 'connected'
            return response.content
        except Exception as e:
            logger.error(
                f"Error executing MCP tool '{tool_name}' on server '{server_path}': {e}", exc_info=True)
            if server_path:
                self.server_resources[server_path]['status'] = 'error'
            return f"Error executing tool '{tool_name}': {e}"

    async def process_query(self, query: str) -> str:
        if not self.gemini_client:
            return "Error: Gemini client not initialized. Please set your API key via settings."

        self.chat_history.append(genai_types.Content(
            role="user", parts=[genai_types.Part(text=query)]))

        gemini_function_declarations = self.get_gemini_tool_declarations()
        gemini_tools = [genai_types.Tool(
            function_declarations=gemini_function_declarations)] if gemini_function_declarations else None
        config = genai_types.GenerateContentConfig(
            tools=gemini_tools) if gemini_tools else None

        try:
            response = await self.gemini_client.models.generate_content(
                model=self.gemini_model_name,
                contents=self.chat_history,
                config=config,
            )

            if not response.candidates or not response.candidates[0].content:
                feedback = response.prompt_feedback if hasattr(
                    response, 'prompt_feedback') else None
                if feedback and feedback.block_reason:
                    logger.warning(
                        f"Gemini response blocked: {feedback.block_reason}")
                    if self.chat_history and self.chat_history[-1].role == "user":
                        self.chat_history.pop()
                    return f"Response blocked due to: {feedback.block_reason}. {getattr(feedback, 'block_reason_message', '')}"
                if self.chat_history and self.chat_history[-1].role == "user":
                    self.chat_history.pop()
                return "Error: No response content from Gemini."

            model_content = response.candidates[0].content

            if not model_content.parts:
                logger.warning("Received model content with empty parts.")
                if self.chat_history and self.chat_history[-1].role == "user":
                    self.chat_history.pop()
                return "Received an empty response from the AI."

            self.chat_history.append(model_content)

            function_calls_to_execute = [
                part.function_call for part in model_content.parts if hasattr(part, 'function_call') and part.function_call
            ]

            if function_calls_to_execute:
                tool_response_parts = []
                for function_call in function_calls_to_execute:
                    tool_name = function_call.name
                    tool_args = dict(function_call.args)
                    logger.info(
                        f"Gemini requested tool call: {tool_name} with args: {tool_args}")
                    tool_result = await self.execute_mcp_tool(tool_name, tool_args)
                    tool_response_parts.append(genai_types.Part.from_function_response(
                        name=tool_name,
                        response={
                            "result": tool_result if tool_result is not None else "Error executing tool."},
                    ))

                if tool_response_parts:
                    self.chat_history.append(genai_types.Content(
                        role="tool", parts=tool_response_parts))
                    response = await self.gemini_client.models.generate_content(
                        model=self.gemini_model_name,
                        contents=self.chat_history,
                        config=config,
                    )

                    if not response.candidates or not response.candidates[0].content:
                        feedback = response.prompt_feedback if hasattr(
                            response, 'prompt_feedback') else None
                        if feedback and feedback.block_reason:
                            logger.warning(
                                f"Gemini response blocked after tool call: {feedback.block_reason}")
                            if len(self.chat_history) >= 2 and self.chat_history[-1].role == "tool" and self.chat_history[-2].role == "model":
                                self.chat_history.pop()
                                self.chat_history.pop()
                            return f"Response blocked after tool call: {feedback.block_reason}. {getattr(feedback, 'block_reason_message', '')}"
                        if len(self.chat_history) >= 2 and self.chat_history[-1].role == "tool" and self.chat_history[-2].role == "model":
                            self.chat_history.pop()
                            self.chat_history.pop()
                        return "Error: No response content from Gemini after tool execution."

                    final_model_content = response.candidates[0].content

                    if not final_model_content.parts:
                        logger.warning(
                            "Received final model content with empty parts after tool call.")
                        if len(self.chat_history) >= 2 and self.chat_history[-1].role == "tool" and self.chat_history[-2].role == "model":
                            self.chat_history.pop()
                            self.chat_history.pop()
                        return "Received empty response after tool call (no parts)."

                    self.chat_history.append(final_model_content)
                    if final_model_content.parts and hasattr(final_model_content.parts[0], 'text') and final_model_content.parts[0].text is not None:
                        return final_model_content.parts[0].text
                    else:
                        return "Received empty response after tool call (no text part)."
                else:
                    logger.error(
                        "function_calls_to_execute was present, but tool_response_parts became empty.")
                    return "Error: Tool calls were requested but no responses could be generated."

            elif model_content.parts and hasattr(model_content.parts[0], 'text') and model_content.parts[0].text is not None:
                return model_content.parts[0].text
            else:
                return "Received response with no text."

        except genai_errors.APIError as e:
            logger.error(f"Gemini API error: {e}")
            if self.chat_history and self.chat_history[-1].role == "user":
                self.chat_history.pop()
            return f"Gemini API Error: {e.message}"
        except Exception as e:
            logger.error(f"Error processing query: {e}", exc_info=True)
            if self.chat_history and self.chat_history[-1].role == "user":
                self.chat_history.pop()
            return f"An unexpected error occurred: {e}"

    async def cleanup(self):
        logger.info("Cleaning up MCPChatApp resources...")
        if self.status_check_task and not self.status_check_task.done():
            self.status_check_task.cancel()
            try:
                await self.status_check_task
            except asyncio.CancelledError:
                logger.info("Periodic status checker task cancelled.")
            except Exception as e:
                logger.error(
                    f"Error during status checker task cleanup: {e}", exc_info=True)
            self.status_check_task = None
        server_paths = list(self.server_resources.keys())
        for path in server_paths:
            await self.disconnect_mcp_server(path)
        logger.info("MCPChatApp cleanup complete.")
