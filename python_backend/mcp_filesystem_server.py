import json
import sys
import os
import argparse
import pathlib
import shutil
import re
import stat
import datetime
from typing import Dict, Any, List, Union, Optional

BASE_ALLOWED_PATH = pathlib.Path(os.environ.get("MCP_FS_BASE_PATH", pathlib.Path(__file__).parent.resolve()))

def _is_within_base(path_to_check: Union[str, pathlib.Path]) -> bool:
    try:
        resolved_path = pathlib.Path(path_to_check).resolve()
        return BASE_ALLOWED_PATH in resolved_path.parents or BASE_ALLOWED_PATH == resolved_path
    except Exception:
        return False

def _resolve_path_safely(user_path_str: str) -> pathlib.Path:
    abs_path = (BASE_ALLOWED_PATH / user_path_str).resolve()
    if not _is_within_base(abs_path):
        raise PermissionError(f"Access to path '{user_path_str}' (resolved to '{abs_path}') is outside the allowed directory '{BASE_ALLOWED_PATH}'.")
    return abs_path

def handle_directory_tree(path: Optional[str] = None, max_depth: int = 3, include_files: bool = True) -> Dict[str, Any]:
    if path is None:
        return {"error": "Missing required parameter: path"}
    # max_depth and include_files are used directly from parameters

    try:
        root_path = _resolve_path_safely(path)
        if not root_path.is_dir():
            return {"error": f"Path '{path}' is not a directory."}

        tree: Dict[str, Any] = {}
        def build_tree(current_path: pathlib.Path, current_dict: Dict[str, Any], depth: int):
            if max_depth != 0 and depth > max_depth:
                return
            for item in sorted(current_path.iterdir()):
                if item.is_dir():
                    current_dict[item.name] = {}
                    build_tree(item, current_dict[item.name], depth + 1)
                elif include_files:
                    current_dict[item.name] = "file"

        build_tree(root_path, tree, 1)
        return {"result": tree}
    except PermissionError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Failed to generate directory tree: {str(e)}"}

def handle_edit_file(path: Optional[str] = None, edits: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    if path is None:
        return {"error": "Missing required parameter: path"}
    if edits is None: # Check if edits list itself is None
        edits = []

    try:
        file_path = _resolve_path_safely(path)
        if not file_path.is_file():
            return {"error": f"File not found: {path}"}

        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        original_num_lines = len(lines)

        for edit in edits:
            op: Optional[str] = edit.get("operation")
            line_num: Optional[int] = edit.get("line_number")
            content: str = edit.get("content", "")
            num_to_delete: int = edit.get("num_lines_to_delete", 1)

            if not isinstance(line_num, int) or line_num <= 0:
                return {"error": f"Invalid line_number: {line_num}. Must be a positive integer."}

            idx = line_num - 1

            if op == "insert":
                if idx > len(lines): # Allow inserting at the end
                    idx = len(lines)
                insert_lines: List[str] = [l + '\n' for l in content.split('\n')]
                if insert_lines and insert_lines[-1].endswith('\n\n'): # Handle trailing newline from split
                    insert_lines[-1] = insert_lines[-1][:-1]
                elif insert_lines and not content.endswith('\n') and content != "": # ensure last line has newline if content itself doesn't end with one
                     insert_lines[-1] += '\n'

                lines = lines[:idx] + insert_lines + lines[idx:]
            elif op == "delete":
                if idx >= len(lines):
                    return {"error": f"Line number {line_num} out of range for delete (max {len(lines)})."}
                del lines[idx : min(idx + num_to_delete, len(lines))]
            elif op == "replace":
                if idx >= len(lines):
                     return {"error": f"Line number {line_num} out of range for replace (max {len(lines)})."}
                replace_lines: List[str] = [l + '\n' for l in content.split('\n')]
                if replace_lines and replace_lines[-1].endswith('\n\n'):
                    replace_lines[-1] = replace_lines[-1][:-1]
                elif replace_lines and not content.endswith('\n') and content != "":
                     replace_lines[-1] += '\n'

                lines = lines[:idx] + replace_lines + lines[min(idx + num_to_delete, len(lines)):]
            else:
                return {"error": f"Unknown edit operation: {op}"}

        with open(file_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        return {"result": f"File '{path}' edited successfully. {len(lines) - original_num_lines} lines changed."}
    except PermissionError as e:
        return {"error": str(e)}
    except FileNotFoundError:
        return {"error": f"File not found: {path}"}
    except Exception as e:
        return {"error": f"Failed to edit file: {str(e)}"}

def handle_get_file_info(path: Optional[str] = None) -> Dict[str, Any]:
    try:
        if path is None:
             return {"error": "Missing required parameter: path"}
        path_obj = _resolve_path_safely(path)
        if not path_obj.exists():
            return {"error": f"Path not found: {path}"}

        stat_info = path_obj.stat()
        info: Dict[str, Union[str, int, bool]] = {
            "path": str(path_obj),
            "name": path_obj.name,
            "type": "directory" if path_obj.is_dir() else "file" if path_obj.is_file() else "other",
            "size_bytes": stat_info.st_size,
            "permissions": stat.filemode(stat_info.st_mode),
            "last_modified": datetime.datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
            "created": datetime.datetime.fromtimestamp(stat_info.st_ctime).isoformat(), # Note: ctime is platform dependent
            "is_symlink": path_obj.is_symlink(),
        }
        if path_obj.is_symlink():
            info["symlink_target"] = str(path_obj.resolve())
        return {"result": info}
    except PermissionError as e:
        return {"error": str(e)}
    except FileNotFoundError:
        return {"error": f"Path not found: {path}"}
    except Exception as e:
        return {"error": f"Failed to get file info: {str(e)}"}

def handle_list_allowed_directories() -> Dict[str, Any]: # No arguments needed
    return {"result": [str(BASE_ALLOWED_PATH)]}

def handle_list_directory(path: Optional[str] = None, recursive: bool = False, max_depth: int = 0) -> Dict[str, Any]:
    try:
        if path is None:
             return {"error": "Missing required parameter: path"}
        dir_path = _resolve_path_safely(path)
        if not dir_path.is_dir():
            return {"error": f"Path is not a directory: {path}"}

        results: List[Dict[str, str]] = []

        def list_items(current_path: pathlib.Path, current_depth: int):
            if recursive and max_depth != 0 and current_depth > max_depth:
                return

            for item in sorted(current_path.iterdir()):
                item_type = "directory" if item.is_dir() else "file" if item.is_file() else "other"
                results.append({"name": item.name, "path": str(item.relative_to(BASE_ALLOWED_PATH)), "type": item_type})
                if recursive and item.is_dir():
                    list_items(item, current_depth + 1)

        if recursive:
            list_items(dir_path, 1)
        else:
            for item in sorted(dir_path.iterdir()):
                item_type = "directory" if item.is_dir() else "file" if item.is_file() else "other"
                results.append({"name": item.name, "path": str(item.relative_to(BASE_ALLOWED_PATH)), "type": item_type})

        return {"result": results}
    except PermissionError as e:
        return {"error": str(e)}
    except FileNotFoundError:
        return {"error": f"Directory not found: {path}"}
    except Exception as e:
        return {"error": f"Failed to list directory: {str(e)}"}

def handle_move_file(source_path: Optional[str] = None, destination_path: Optional[str] = None) -> Dict[str, Any]:
    try:
        if source_path is None:
             return {"error": "Missing required parameter: source_path"}
        if destination_path is None:
             return {"error": "Missing required parameter: destination_path"}
        
        resolved_source_path = _resolve_path_safely(source_path)
        # For destination, we resolve its parent to ensure the move stays within bounds
        # The final component (dest_path.name) might not exist yet.
        dest_parent_path_for_check = (BASE_ALLOWED_PATH / destination_path).parent.resolve()

        if not _is_within_base(dest_parent_path_for_check):
             raise PermissionError(f"Destination path '{destination_path}' is outside the allowed directory '{BASE_ALLOWED_PATH}'.")

        resolved_dest_path = (BASE_ALLOWED_PATH / destination_path).resolve() # Final destination path

        if not resolved_source_path.exists():
            return {"error": f"Source path not found: {source_path}"}

        shutil.move(str(resolved_source_path), str(resolved_dest_path))
        return {"result": f"Moved '{source_path}' to '{destination_path}' successfully."}
    except PermissionError as e:
        return {"error": str(e)}
    except FileNotFoundError:
        return {"error": f"Source path not found: {source_path}"}
    except Exception as e:
        return {"error": f"Failed to move file/directory: {str(e)}"}

def handle_read_file(path: Optional[str] = None) -> Dict[str, Any]:
    try:
        if path is None:
             return {"error": "Missing required parameter: path"}
        file_path = _resolve_path_safely(path)
        if not file_path.is_file():
            return {"error": f"Path is not a file or does not exist: {path}"}
        content = file_path.read_text(encoding='utf-8')
        return {"result": {"path": path, "content": content}}
    except PermissionError as e:
        return {"error": str(e)}
    except FileNotFoundError:
        return {"error": f"File not found: {path}"}
    except Exception as e:
        return {"error": f"Failed to read file: {str(e)}"}

def handle_read_multiple_files(paths: Optional[List[str]] = None) -> Dict[str, Union[List[Dict[str, str]], str]]:
    if paths is None:
        paths = [] # Default to empty list if None
    results: List[Dict[str, str]] = []
    errors: List[Dict[str, str]] = []
    for current_path_str in paths: # Renamed path_str to avoid conflict with outer scope if any
        try:
            file_path = _resolve_path_safely(current_path_str)
            if not file_path.is_file():
                errors.append({"path": current_path_str, "error": "Path is not a file or does not exist."})
                continue
            content = file_path.read_text(encoding='utf-8')
            results.append({"path": current_path_str, "content": content})
        except PermissionError as e:
            errors.append({"path": current_path_str, "error": str(e)})
        except FileNotFoundError:
            errors.append({"path": current_path_str, "error": "File not found."})
        except Exception as e:
            errors.append({"path": current_path_str, "error": f"Failed to read file: {str(e)}"})

    response: Dict[str, Union[List[Dict[str, str]], str]] = {}
    if results:
        response["results"] = results
    if errors:
        response["errors"] = errors
    if not results and not errors:
        return {"error": "No paths provided or processed."}
    return response


def handle_search_files(directory_path: Optional[str] = None,
                          regex_pattern: Optional[str] = None,
                          file_glob_pattern: str = "*", # Renamed from file_glob
                          recursive: bool = True,
                          case_sensitive: bool = False) -> Dict[str, Any]:
    try:
        if directory_path is None:
             return {"error": "Missing required parameter: directory_path"}
        if regex_pattern is None:
             return {"error": "Missing required parameter: regex_pattern"}

        dir_path = _resolve_path_safely(directory_path)
        if not dir_path.is_dir():
            return {"error": f"Directory not found: {directory_path}"}

        flags = 0 if case_sensitive else re.IGNORECASE
        compiled_regex = re.compile(regex_pattern, flags)

        matches: List[Dict[str, Union[str, int]]] = []

        file_iterator = dir_path.rglob(file_glob_pattern) if recursive else dir_path.glob(file_glob_pattern)

        for file_path in file_iterator:
            if file_path.is_file():
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        for line_num, line_content in enumerate(f, 1):
                            for match in compiled_regex.finditer(line_content):
                                matches.append({
                                    "file_path": str(file_path.relative_to(BASE_ALLOWED_PATH)),
                                    "line_number": line_num,
                                    "match_start": match.start(),
                                    "match_end": match.end(),
                                    "line_content": line_content.rstrip('\n')
                                })
                except Exception:
                    pass # Skip files that can't be read
        return {"result": matches}
    except PermissionError as e:
        return {"error": str(e)}
    except re.error as e:
        return {"error": f"Invalid regex pattern: {str(e)}"}
    except Exception as e:
        return {"error": f"Failed to search files: {str(e)}"}

def handle_write_file(path: Optional[str] = None,
                        content: Optional[str] = None,
                        create_directories: bool = True,
                        append: bool = False) -> Dict[str, Any]:
    # Renamed path_str to path, content remains content
    # Renamed create_dirs to create_directories
    # Renamed append_mode to append
    try:
        if path is None:
             return {"error": "Missing required parameter: path"}
        if content is None:
             return {"error": "Missing required parameter: content"}

        # Resolve parent for permission check, actual file might not exist
        file_parent_path_for_check = (BASE_ALLOWED_PATH / path).parent.resolve()
        if not _is_within_base(file_parent_path_for_check):
             raise PermissionError(f"Write path '{path}' is outside the allowed directory '{BASE_ALLOWED_PATH}'.")

        file_path = (BASE_ALLOWED_PATH / path).resolve()

        if create_directories:
            file_path.parent.mkdir(parents=True, exist_ok=True)

        mode = 'a' if append else 'w'
        with open(file_path, mode, encoding='utf-8') as f:
            f.write(content)

        action = "appended to" if append else "written to"
        return {"result": f"Content successfully {action} file: {path}"}
    except PermissionError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Failed to write file: {str(e)}"}

TOOL_HANDLERS: Dict[str, Any] = {
    "directory_tree": handle_directory_tree,
    "edit_file": handle_edit_file,
    "get_file_info": handle_get_file_info,
    "list_allowed_directories": handle_list_allowed_directories,
    "list_directory": handle_list_directory,
    "move_file": handle_move_file,
    "read_file": handle_read_file,
    "read_multiple_files": handle_read_multiple_files,
    "search_files": handle_search_files,
    "write_file": handle_write_file,
}

TOOLS_SCHEMA: List[Dict[str, Any]] = [
    {
        "name": "directory_tree",
        "description": "Get the directory tree structure as a nested dictionary.",
        "input_schema": {
            "type": "OBJECT",
            "properties": {
                "path": {"type": "STRING", "description": "The root directory path to generate the tree from."},
                "max_depth": {"type": "INTEGER", "description": "Maximum depth to traverse. 0 for no limit.", "default": 3},
                "include_files": {"type": "BOOLEAN", "description": "Whether to include files in the tree.", "default": True}
            },
            "required": ["path"]
        }
    },
    {
        "name": "edit_file",
        "description": "Edit a file by applying a list of changes (insert, delete, replace lines).",
        "input_schema": {
            "type": "OBJECT",
            "properties": {
                "path": {"type": "STRING", "description": "Path to the file to edit."},
                "edits": {
                    "type": "ARRAY",
                    "description": "A list of edit operations to perform.",
                    "items": {
                        "type": "OBJECT",
                        "title": "EditOperationItem",
                        "description": "An individual edit operation.",
                        "nullable": False,
                        "properties": {
                            "operation": {"type": "STRING", "enum": ["insert", "delete", "replace"], "description": "Type of edit operation."},
                            "line_number": {"type": "INTEGER", "description": "1-based line number for the operation. For 'insert', content is inserted before this line. For 'delete'/'replace', this is the starting line."},
                            "content": {"type": "STRING", "description": "Content for 'insert' or 'replace' operations. For multi-line, use \\n."},
                            "num_lines_to_delete": {"type": "INTEGER", "description": "Number of lines to delete for 'delete' or 'replace' operation. Defaults to 1 if not provided for delete/replace."}
                        },
                        "required": ["operation", "line_number"]
                    }
                }
            },
            "required": ["path", "edits"]
        }
    },
    {
        "name": "get_file_info",
        "description": "Get information about a file or directory (size, type, permissions, dates).",
        "input_schema": {
            "type": "OBJECT",
            "properties": {
                "path": {"type": "STRING", "description": "Path to the file or directory."}
            },
            "required": ["path"]
        }
    },
    {
        "name": "list_allowed_directories",
        "description": "List base directories the server is allowed to access.",
        "input_schema": {"type": "OBJECT", "properties": {},"required": []}
    },
    {
        "name": "list_directory",
        "description": "List contents of a directory.",
        "input_schema": {
            "type": "OBJECT",
            "properties": {
                "path": {"type": "STRING", "description": "Path to the directory to list."},
                "recursive": {"type": "BOOLEAN", "description": "List recursively.", "default": False},
                "max_depth": {"type": "INTEGER", "description": "Maximum depth for recursive listing (if recursive is true). 0 for no limit.", "default": 0}
            },
            "required": ["path"]
        }
    },
    {
        "name": "move_file",
        "description": "Move or rename a file or directory.",
        "input_schema": {
            "type": "OBJECT",
            "properties": {
                "source_path": {"type": "STRING", "description": "Current path of the file or directory."},
                "destination_path": {"type": "STRING", "description": "New path for the file or directory."}
            },
            "required": ["source_path", "destination_path"]
        }
    },
    {
        "name": "read_file",
        "description": "Read the content of a file.",
        "input_schema": {
            "type": "OBJECT",
            "properties": {
                "path": {"type": "STRING", "description": "Path to the file to read."}
            },
            "required": ["path"]
        }
    },
    {
        "name": "read_multiple_files",
        "description": "Read the content of multiple files.",
        "input_schema": {
            "type": "OBJECT",
            "properties": {
                "paths": {
                    "type": "ARRAY",
                    "description": "A list of file paths to read.",
                    "items": {"type": "STRING", "title": "FilePathItem", "description": "A file path string.", "nullable": False}
                }
            },
            "required": ["paths"]
        }
    },
    {
        "name": "search_files",
        "description": "Search for a regex pattern in files within a directory.",
        "input_schema": {
            "type": "OBJECT",
            "properties": {
                "directory_path": {"type": "STRING", "description": "The directory to search within."},
                "regex_pattern": {"type": "STRING", "description": "The Python regex pattern to search for."},
                "file_glob_pattern": {"type": "STRING", "description": "Glob pattern to filter files (e.g., '*.txt', '**/*.py'). Defaults to '*' (all files).", "default": "*"},
                "recursive": {"type": "BOOLEAN", "description": "Search recursively in subdirectories.", "default": True},
                "case_sensitive": {"type": "BOOLEAN", "description": "Perform a case-sensitive search.", "default": False}
            },
            "required": ["directory_path", "regex_pattern"]
        }
    },
    {
        "name": "write_file",
        "description": "Write content to a file, overwriting or appending if it exists, creating if not.",
        "input_schema": {
            "type": "OBJECT",
            "properties": {
                "path": {"type": "STRING", "description": "Path to the file to write."},
                "content": {"type": "STRING", "description": "Content to write to the file."},
                "create_directories": {"type": "BOOLEAN", "description": "Create parent directories if they don't exist.", "default": True},
                "append": {"type": "BOOLEAN", "description": "Append to the file if it exists, instead of overwriting.", "default": False}
            },
            "required": ["path", "content"]
        }
    }
]

def main():
    parser = argparse.ArgumentParser(description="MCP Filesystem Server")
    parser.add_argument('--mcp-capabilities', action='store_true', help='Output MCP capabilities and exit.')
    args = parser.parse_args()

    if args.mcp_capabilities:
        # Assuming TOOLS_SCHEMA is List[Dict[str, Any]] and resources is List[Any]
        capabilities: Dict[str, Union[str, List[Dict[str, Any]], List[Any]]] = {
            "name": "python_filesystem_server",
            "description": "A Python-based MCP server for filesystem operations.",
            "tools": TOOLS_SCHEMA,
            "resources": []
        }
        print(json.dumps(capabilities))
        sys.stdout.flush()
        return

    # Process stdin requests
    for line in sys.stdin:
        current_request_id: Optional[Union[str, int, float]] = None # Store ID for current request
        response_payload: Dict[str, Any] # To build the final JSON response

        try:
            request_data = json.loads(line)
            current_request_id = request_data.get("id")
            tool_name = request_data.get("tool_name")
            arguments = request_data.get("arguments", {})

            if tool_name in TOOL_HANDLERS:
                # Call handler with keyword arguments by unpacking the arguments dictionary
                tool_result_or_error = TOOL_HANDLERS[tool_name](**arguments)
            else:
                tool_result_or_error = {"error": f"Unknown tool: {tool_name}"}

            # Construct response, ensuring 'id' is always present
            response_payload = {"id": current_request_id}
            if "error" in tool_result_or_error:
                response_payload["error"] = tool_result_or_error["error"]
            else:
                # For tools like read_multiple_files that might have "results" and "errors"
                # or just "result" for others.
                response_payload.update(tool_result_or_error)

        except json.JSONDecodeError:
            # current_request_id might still be None if JSON was malformed before 'id' field
            response_payload = {"id": current_request_id, "error": "Invalid JSON request."}
        except Exception as e:
            # current_request_id might be set or None
            response_payload = {"id": current_request_id, "error": f"An unexpected error occurred: {str(e)}"}

        print(json.dumps(response_payload))
        sys.stdout.flush()

if __name__ == '__main__':
    main()