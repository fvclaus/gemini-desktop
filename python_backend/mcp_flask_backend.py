# python_backend/mcp_flask_backend.py
from mcp_chat_app import MCPChatApp
import sys
import os
import argparse
from flask import Flask, request, jsonify
import asyncio
import threading
import logging

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

flask_app = Flask(__name__)
chat_app = None
loop = None
loop_ready = threading.Event()


def start_async_loop():
    global loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop_ready.set()
    logger.info("Asyncio loop started and ready.")
    loop.run_forever()


async def initialize_chat_app():
    global chat_app
    if chat_app is None:
        chat_app = MCPChatApp()
        try:
            await chat_app.initialize_gemini()
            logger.info("MCPChatApp initialized successfully.")
        except Exception as e:
            logger.error(
                f"Failed to initialize MCPChatApp: {e}", exc_info=True)
            chat_app = None
            raise
    return chat_app


async def add_server_async(path):
    app = await initialize_chat_app()
    if not app:
        return {"status": "error", "message": "Chat app not initialized"}, 500
    try:
        added_tools = await app.connect_to_mcp_server(path)
        return {"status": "success", "message": f"Server '{os.path.basename(path)}' added.", "tools": added_tools}, 200
    except FileNotFoundError as e:
        return {"status": "error", "message": str(e)}, 404
    except ValueError as e:
        return {"status": "error", "message": str(e)}, 400
    except Exception as e:
        logger.error(f"Error adding server {path}: {e}", exc_info=True)
        return {"status": "error", "message": f"Failed to add server: {e}"}, 500


async def disconnect_server_async(path):
    app = await initialize_chat_app()
    if not app:
        return {"status": "error", "message": "Chat app not initialized"}, 500
    try:
        disconnected = await app.disconnect_mcp_server(path)
        if disconnected:
            return {"status": "success", "message": f"Server '{os.path.basename(path)}' disconnected."}, 200
        else:
            return {"status": "error", "message": f"Server '{os.path.basename(path)}' not found or already disconnected."}, 404
    except Exception as e:
        logger.error(f"Error disconnecting server {path}: {e}", exc_info=True)
        return {"status": "error", "message": f"Failed to disconnect server: {e}"}, 500


async def get_servers_async():
    app = await initialize_chat_app()
    if not app:
        return {"status": "error", "message": "Chat app not initialized"}, 500
    servers = []
    for path, resources in app.server_resources.items():
        servers.append({
            "path": path,
            "tools": sorted(resources.get('tools', [])),
            "status": resources.get('status', 'unknown')
        })
    return {"status": "success", "servers": servers}, 200


async def process_chat_async(message):
    app = await initialize_chat_app()
    if not app:
        return {"reply": "Error: Backend chat app not initialized."}, 500
    try:
        reply = await app.process_query(message)
        return {"reply": reply}, 200
    except Exception as e:
        logger.error(f"Error processing chat: {e}", exc_info=True)
        return {"reply": f"An error occurred: {e}"}, 500


async def set_api_key_async(api_key):
    app = await initialize_chat_app()
    if not app:
        return {"status": "error", "message": "Chat app not initialized"}, 500
    try:
        await app.set_api_key_and_reinitialize(api_key)
        return {"status": "success", "message": "API Key set and Gemini client re-initialized."}, 200
    except Exception as e:
        logger.error(
            f"Error setting API key and re-initializing: {e}", exc_info=True)
        return {"status": "error", "message": f"Failed to set API key: {e}"}, 500


@flask_app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    message = data.get('message')
    if not message:
        return jsonify({"reply": "No message provided."}), 400
    if not loop or not loop.is_running():
        return jsonify({"reply": "Backend loop not running."}), 500

    future = asyncio.run_coroutine_threadsafe(
        process_chat_async(message), loop)
    try:
        result, status_code = future.result(timeout=60)
        return jsonify(result), status_code
    except asyncio.TimeoutError:
        logger.error("Chat processing timed out.")
        return jsonify({"reply": "Error: Response timed out."}), 504
    except Exception as e:
        logger.error(
            f"Error getting result from chat future: {e}", exc_info=True)
        return jsonify({"reply": f"Error processing your request: {e}"}), 500


@flask_app.route('/servers', methods=['POST'])
def add_server():
    data = request.get_json()
    path = data.get('path')
    if not path:
        return jsonify({"status": "error", "message": "No server path provided."}), 400
    if not loop or not loop.is_running():
        return jsonify({"status": "error", "message": "Backend loop not running."}), 500

    future = asyncio.run_coroutine_threadsafe(add_server_async(path), loop)
    try:
        result, status_code = future.result(timeout=30)
        return jsonify(result), status_code
    except asyncio.TimeoutError:
        logger.error(f"Adding server {path} timed out.")
        return jsonify({"status": "error", "message": "Error: Adding server timed out."}), 504
    except Exception as e:
        logger.error(
            f"Error getting result from add_server future: {e}", exc_info=True)
        return jsonify({"status": "error", "message": f"Error adding server: {e}"}), 500


@flask_app.route('/servers', methods=['DELETE'])
def delete_server():
    data = request.get_json()
    path = data.get('path')
    if not path:
        return jsonify({"status": "error", "message": "No server path provided for deletion."}), 400
    if not loop or not loop.is_running():
        return jsonify({"status": "error", "message": "Backend loop not running."}), 500

    future = asyncio.run_coroutine_threadsafe(
        disconnect_server_async(path), loop)
    try:
        result, status_code = future.result(timeout=30)
        return jsonify(result), status_code
    except asyncio.TimeoutError:
        logger.error(f"Disconnecting server {path} timed out.")
        return jsonify({"status": "error", "message": "Error: Disconnecting server timed out."}), 504
    except Exception as e:
        logger.error(
            f"Error getting result from delete_server future: {e}", exc_info=True)
        return jsonify({"status": "error", "message": f"Error disconnecting server: {e}"}), 500


@flask_app.route('/servers', methods=['GET'])
def get_servers():
    if not loop or not loop.is_running():
        return jsonify({"status": "error", "message": "Backend loop not running."}), 500

    future = asyncio.run_coroutine_threadsafe(get_servers_async(), loop)
    try:
        result, status_code = future.result(timeout=10)
        return jsonify(result), status_code
    except asyncio.TimeoutError:
        logger.error("Getting servers timed out.")
        return jsonify({"status": "error", "message": "Error: Getting server list timed out."}), 504
    except Exception as e:
        logger.error(
            f"Error getting result from get_servers future: {e}", exc_info=True)
        return jsonify({"status": "error", "message": f"Error getting servers: {e}"}), 500


@flask_app.route('/set-api-key', methods=['POST'])
def set_api_key():
    data = request.get_json()
    api_key = data.get('apiKey')
    if not api_key:
        return jsonify({"status": "error", "message": "No API key provided."}), 400
    if not loop or not loop.is_running():
        return jsonify({"status": "error", "message": "Backend loop not running."}), 500

    future = asyncio.run_coroutine_threadsafe(set_api_key_async(api_key), loop)
    try:
        result, status_code = future.result(
            timeout=20)  # Timeout for re-initialization
        return jsonify(result), status_code
    except asyncio.TimeoutError:
        logger.error("Setting API key timed out.")
        return jsonify({"status": "error", "message": "Error: Setting API key timed out."}), 504
    except Exception as e:
        logger.error(
            f"Error getting result from set_api_key future: {e}", exc_info=True)
        return jsonify({"status": "error", "message": f"Error setting API key: {e}"}), 500


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='MCP Gemini Flask Backend')
    parser.add_argument('--port', type=int, default=5001,
                        help='Port to run the backend on')
    args = parser.parse_args()

    thread = threading.Thread(target=start_async_loop, daemon=True)
    thread.start()

    if not loop_ready.wait(timeout=10):
        logger.error("Asyncio loop did not start within timeout.")
        sys.exit(1)

    if loop:
        init_future = asyncio.run_coroutine_threadsafe(
            initialize_chat_app(), loop)
        try:
            init_future.result(timeout=20)
            if chat_app is None:
                logger.error("Chat app initialization returned None.")
                sys.exit(1)
            logger.info("Chat app initialized successfully via asyncio loop.")
        except Exception as e:
            logger.error(
                f"Error during chat app initialization: {e}", exc_info=True)
            # Don't exit if init fails due to no key, allow setting it later
            logger.warning(
                "Initial Gemini initialization failed, likely no API key. Waiting for key to be set.")
            # chat_app will still be None if it failed badly
            if chat_app is None:
                chat_app = MCPChatApp()  # Create instance even if init fails
                logger.info(
                    "Created MCPChatApp instance despite initial Gemini failure.")

    else:
        logger.error("Asyncio loop not available after waiting.")
        sys.exit(1)

    logger.info(f"Starting Flask server on 127.0.0.1:{args.port}")
    flask_app.run(host='127.0.0.1', port=args.port)
