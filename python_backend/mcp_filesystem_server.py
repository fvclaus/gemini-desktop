import pathlib
import shutil
import re
import stat
import datetime
from typing import Dict, Any, List, Union, Optional, Tuple

# This script provides a function to generate filesystem tools and their schemas
# based on a dynamically provided base path.

def create_filesystem_tools(current_base_path_str: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
    """
    Creates and returns the tools schema, handlers, and a static schema representation
    for filesystem operations, scoped to the provided base_path.

    Returns:
        Tuple[List[Dict[str, Any]], Dict[str, Any], List[Dict[str, Any]]]:
            - Dynamically generated TOOLS_SCHEMA for the given base_path.
            - Dynamically generated TOOL_HANDLERS for the given base_path.
            - Static representation of TOOLS_SCHEMA for capabilities reporting.
    """
    try:
        resolved_base_path = pathlib.Path(current_base_path_str).resolve()
        if not resolved_base_path.is_dir():
            raise ValueError(f"The provided base path '{current_base_path_str}' (resolved to '{resolved_base_path}') is not a valid directory or does not exist.")
        BASE_ALLOWED_PATH = resolved_base_path
    except Exception as e:
        raise ValueError(f"Invalid base_path for filesystem tools: {e}")

    def _is_within_base(path_to_check: Union[str, pathlib.Path]) -> bool:
        try:
            resolved_target_path = pathlib.Path(path_to_check).resolve()
            return BASE_ALLOWED_PATH in resolved_target_path.parents or BASE_ALLOWED_PATH == resolved_target_path
        except Exception:
            return False

    def _resolve_path_safely(user_path_str: str) -> pathlib.Path:
        path_obj = pathlib.Path(user_path_str)
        if path_obj.is_absolute():
            abs_path = path_obj.resolve()
        else:
            abs_path = (BASE_ALLOWED_PATH / user_path_str).resolve()
        if not _is_within_base(abs_path): # Correctly call _is_within_base
            raise PermissionError(f"Access to path '{user_path_str}' (resolved to '{abs_path}') is outside the allowed workspace directory '{BASE_ALLOWED_PATH}'.")
        return abs_path

    def handle_directory_tree(path: Optional[str] = None, max_depth: int = 3, include_files: bool = True) -> Dict[str, Any]:
        if path is None: return {"error": "Missing required parameter: path"}
        try:
            root_path = _resolve_path_safely(path)
            if not root_path.is_dir(): return {"error": f"Path '{path}' is not a directory."}
            tree: Dict[str, Any] = {}
            def build_tree(current_path: pathlib.Path, current_dict: Dict[str, Any], depth: int):
                if max_depth != 0 and depth > max_depth: return
                for item in sorted(current_path.iterdir()):
                    if item.is_dir():
                        current_dict[item.name] = {}
                        build_tree(item, current_dict[item.name], depth + 1)
                    elif include_files: current_dict[item.name] = "file"
            build_tree(root_path, tree, 1)
            return {"result": tree}
        except PermissionError as e: return {"error": str(e)}
        except Exception as e: return {"error": f"Failed to generate directory tree: {str(e)}"}

    def handle_edit_file(path: Optional[str] = None, edits: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        if path is None: return {"error": "Missing required parameter: path"}
        if edits is None: edits = []
        try:
            file_path = _resolve_path_safely(path)
            if not file_path.is_file(): return {"error": f"File not found: {path}"}
            with open(file_path, 'r', encoding='utf-8') as f: lines = f.readlines()
            original_num_lines = len(lines)
            for edit in edits:
                op: Optional[str] = edit.get("operation")
                line_num: Optional[int] = edit.get("line_number")
                content: str = edit.get("content", "")
                num_to_delete: int = edit.get("num_lines_to_delete", 1)
                if not isinstance(line_num, int) or line_num <= 0: return {"error": f"Invalid line_number: {line_num}."}
                idx = line_num - 1
                if op == "insert":
                    if idx > len(lines): idx = len(lines)
                    insert_lines: List[str] = [l + '\n' for l in content.split('\n')]
                    if insert_lines and insert_lines[-1].endswith('\n\n'): insert_lines[-1] = insert_lines[-1][:-1]
                    elif insert_lines and not content.endswith('\n') and content != "": insert_lines[-1] += '\n'
                    lines = lines[:idx] + insert_lines + lines[idx:]
                elif op == "delete":
                    if idx >= len(lines): return {"error": f"Line number {line_num} out of range for delete (max {len(lines)})."}
                    del lines[idx : min(idx + num_to_delete, len(lines))]
                elif op == "replace":
                    if idx >= len(lines): return {"error": f"Line number {line_num} out of range for replace (max {len(lines)})."}
                    replace_lines: List[str] = [l + '\n' for l in content.split('\n')]
                    if replace_lines and replace_lines[-1].endswith('\n\n'): replace_lines[-1] = replace_lines[-1][:-1]
                    elif replace_lines and not content.endswith('\n') and content != "": replace_lines[-1] += '\n'
                    lines = lines[:idx] + replace_lines + lines[min(idx + num_to_delete, len(lines)):]
                else: return {"error": f"Unknown edit operation: {op}"}
            with open(file_path, 'w', encoding='utf-8') as f: f.writelines(lines)
            return {"result": f"File '{path}' edited. {len(lines) - original_num_lines} lines changed."}
        except PermissionError as e: return {"error": str(e)}
        except FileNotFoundError: return {"error": f"File not found: {path}"}
        except Exception as e: return {"error": f"Failed to edit file: {str(e)}"}

    def handle_get_file_info(path: Optional[str] = None) -> Dict[str, Any]:
        if path is None: return {"error": "Missing required parameter: path"}
        try:
            path_obj = _resolve_path_safely(path)
            if not path_obj.exists(): return {"error": f"Path not found: {path}"}
            stat_info = path_obj.stat()
            info: Dict[str, Union[str, int, bool]] = {
                "path": str(path_obj.relative_to(BASE_ALLOWED_PATH)),
                "name": path_obj.name,
                "type": "directory" if path_obj.is_dir() else "file" if path_obj.is_file() else "other",
                "size_bytes": stat_info.st_size,
                "permissions": stat.filemode(stat_info.st_mode),
                "last_modified": datetime.datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                "created": datetime.datetime.fromtimestamp(stat_info.st_ctime).isoformat(),
                "is_symlink": path_obj.is_symlink(),
            }
            if path_obj.is_symlink(): info["symlink_target"] = str(path_obj.resolve())
            return {"result": info}
        except PermissionError as e: return {"error": str(e)}
        except FileNotFoundError: return {"error": f"Path not found: {path}"}
        except Exception as e: return {"error": f"Failed to get file info: {str(e)}"}

    def handle_list_allowed_directories() -> Dict[str, Any]:
        return {"result": [str(BASE_ALLOWED_PATH)]}

    def handle_list_directory(path: Optional[str] = None, recursive: bool = False, max_depth: int = 0) -> Dict[str, Any]:
        if path is None: return {"error": "Missing required parameter: path"}
        try:
            dir_path = _resolve_path_safely(path)
            if not dir_path.is_dir(): return {"error": f"Path is not a directory: {path}"}
            results: List[Dict[str, str]] = []
            def list_items(current_path: pathlib.Path, current_depth: int):
                if recursive and max_depth != 0 and current_depth > max_depth: return
                for item in sorted(current_path.iterdir()):
                    item_type = "directory" if item.is_dir() else "file" if item.is_file() else "other"
                    results.append({"name": item.name, "path": str(item.relative_to(BASE_ALLOWED_PATH)), "type": item_type})
                    if recursive and item.is_dir(): list_items(item, current_depth + 1)
            if recursive: list_items(dir_path, 1)
            else:
                for item in sorted(dir_path.iterdir()):
                    item_type = "directory" if item.is_dir() else "file" if item.is_file() else "other"
                    results.append({"name": item.name, "path": str(item.relative_to(BASE_ALLOWED_PATH)), "type": item_type})
            return {"result": results}
        except PermissionError as e: return {"error": str(e)}
        except FileNotFoundError: return {"error": f"Directory not found: {path}"}
        except Exception as e: return {"error": f"Failed to list directory: {str(e)}"}

    def handle_move_file(source_path: Optional[str] = None, destination_path: Optional[str] = None) -> Dict[str, Any]:
        if source_path is None: return {"error": "Missing required parameter: source_path"}
        if destination_path is None: return {"error": "Missing required parameter: destination_path"}
        try:
            resolved_source_path = _resolve_path_safely(source_path)
            dest_obj = pathlib.Path(destination_path)
            if dest_obj.is_absolute(): resolved_dest_path = dest_obj.resolve()
            else: resolved_dest_path = (BASE_ALLOWED_PATH / destination_path).resolve()
            if not (BASE_ALLOWED_PATH in resolved_dest_path.parents or BASE_ALLOWED_PATH == resolved_dest_path.parent or BASE_ALLOWED_PATH == resolved_dest_path) :
                 raise PermissionError(f"Destination path '{destination_path}' (resolved to '{resolved_dest_path}') is outside allowed directory '{BASE_ALLOWED_PATH}'.")
            if not resolved_source_path.exists(): return {"error": f"Source path not found: {source_path}"}
            shutil.move(str(resolved_source_path), str(resolved_dest_path))
            return {"result": f"Moved '{source_path}' to '{destination_path}'."}
        except PermissionError as e: return {"error": str(e)}
        except FileNotFoundError: return {"error": f"Source path not found: {source_path}"}
        except Exception as e: return {"error": f"Failed to move file/directory: {str(e)}"}

    def handle_read_file(path: Optional[str] = None) -> Dict[str, Any]:
        if path is None: return {"error": "Missing required parameter: path"}
        try:
            file_path = _resolve_path_safely(path)
            if not file_path.is_file(): return {"error": f"Path is not a file or does not exist: {path}"}
            content = file_path.read_text(encoding='utf-8')
            return {"result": {"path": path, "content": content}}
        except PermissionError as e: return {"error": str(e)}
        except FileNotFoundError: return {"error": f"File not found: {path}"}
        except Exception as e: return {"error": f"Failed to read file: {str(e)}"}

    def handle_read_multiple_files(paths: Optional[List[str]] = None) -> Dict[str, Union[List[Dict[str, str]], str]]:
        if paths is None: paths = []
        results: List[Dict[str, str]] = []
        errors: List[Dict[str, str]] = []
        for current_path_str in paths:
            try:
                file_path = _resolve_path_safely(current_path_str)
                if not file_path.is_file():
                    errors.append({"path": current_path_str, "error": "Path is not a file or does not exist."}); continue
                content = file_path.read_text(encoding='utf-8')
                results.append({"path": current_path_str, "content": content})
            except PermissionError as e: errors.append({"path": current_path_str, "error": str(e)})
            except FileNotFoundError: errors.append({"path": current_path_str, "error": "File not found."})
            except Exception as e: errors.append({"path": current_path_str, "error": f"Failed to read file: {str(e)}"})
        response: Dict[str, Union[List[Dict[str, str]], str]] = {}
        if results: response["results"] = results
        if errors: response["errors"] = errors
        if not results and not errors: return {"error": "No paths provided or processed."}
        return response

    def handle_search_files(directory_path: Optional[str] = None, regex_pattern: Optional[str] = None, file_glob_pattern: str = "*", recursive: bool = True, case_sensitive: bool = False) -> Dict[str, Any]:
        if directory_path is None: return {"error": "Missing required parameter: directory_path"}
        if regex_pattern is None: return {"error": "Missing required parameter: regex_pattern"}
        try:
            dir_path = _resolve_path_safely(directory_path)
            if not dir_path.is_dir(): return {"error": f"Directory not found: {directory_path}"}
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
                                        "line_number": line_num, "match_start": match.start(),
                                        "match_end": match.end(), "line_content": line_content.rstrip('\n')
                                    })
                    except Exception: pass
            return {"result": matches}
        except PermissionError as e: return {"error": str(e)}
        except re.error as e: return {"error": f"Invalid regex pattern: {str(e)}"}
        except Exception as e: return {"error": f"Failed to search files: {str(e)}"}

    def handle_write_file(path: Optional[str] = None, content: Optional[str] = None, create_directories: bool = True, append: bool = False) -> Dict[str, Any]:
        if path is None: return {"error": "Missing required parameter: path"}
        if content is None: return {"error": "Missing required parameter: content"}
        try:
            file_path_obj = pathlib.Path(path)
            if file_path_obj.is_absolute(): resolved_file_path = file_path_obj.resolve()
            else: resolved_file_path = (BASE_ALLOWED_PATH / path).resolve()
            if not (BASE_ALLOWED_PATH in resolved_file_path.parents or BASE_ALLOWED_PATH == resolved_file_path.parent):
                 raise PermissionError(f"Write path '{path}' (resolved to '{resolved_file_path}') is outside allowed directory '{BASE_ALLOWED_PATH}'.")
            if create_directories: resolved_file_path.parent.mkdir(parents=True, exist_ok=True)
            mode = 'a' if append else 'w'
            with open(resolved_file_path, mode, encoding='utf-8') as f: f.write(content)
            action = "appended to" if append else "written to"
            return {"result": f"Content successfully {action} file: {path}"}
        except PermissionError as e: return {"error": str(e)}
        except Exception as e: return {"error": f"Failed to write file: {str(e)}"}

    LOCAL_TOOL_HANDLERS: Dict[str, Any] = {
        "directory_tree": handle_directory_tree, "edit_file": handle_edit_file,
        "get_file_info": handle_get_file_info, "list_allowed_directories": handle_list_allowed_directories,
        "list_directory": handle_list_directory, "move_file": handle_move_file,
        "read_file": handle_read_file, "read_multiple_files": handle_read_multiple_files,
        "search_files": handle_search_files, "write_file": handle_write_file,
    }

    # Dynamic schema based on the current BASE_ALLOWED_PATH (descriptions reflect this)
    LOCAL_TOOLS_SCHEMA: List[Dict[str, Any]] = [
        {"name": "directory_tree", "description": f"Get directory tree within '{BASE_ALLOWED_PATH}'. Paths relative to it.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}, "max_depth": {"type": "INTEGER", "default": 3}, "include_files": {"type": "BOOLEAN", "default": True}}, "required": ["path"]}},
        {"name": "edit_file", "description": f"Edit file within '{BASE_ALLOWED_PATH}'. Path relative.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}, "edits": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {"operation": {"type": "STRING", "enum": ["insert", "delete", "replace"]}, "line_number": {"type": "INTEGER"}, "content": {"type": "STRING"}, "num_lines_to_delete": {"type": "INTEGER", "default": 1}}, "required": ["operation", "line_number"]}}}, "required": ["path", "edits"]}},
        {"name": "get_file_info", "description": f"Get file/dir info within '{BASE_ALLOWED_PATH}'. Path relative.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}}, "required": ["path"]}},
        {"name": "list_allowed_directories", "description": f"List current base workspace: '{BASE_ALLOWED_PATH}'.", "input_schema": {"type": "OBJECT", "properties": {}, "required": []}},
        {"name": "list_directory", "description": f"List directory contents within '{BASE_ALLOWED_PATH}'. Path relative.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}, "recursive": {"type": "BOOLEAN", "default": False}, "max_depth": {"type": "INTEGER", "default": 0}}, "required": ["path"]}},
        {"name": "move_file", "description": f"Move file/dir within '{BASE_ALLOWED_PATH}'. Paths relative.", "input_schema": {"type": "OBJECT", "properties": {"source_path": {"type": "STRING"}, "destination_path": {"type": "STRING"}}, "required": ["source_path", "destination_path"]}},
        {"name": "read_file", "description": f"Read file within '{BASE_ALLOWED_PATH}'. Path relative.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}}, "required": ["path"]}},
        {"name": "read_multiple_files", "description": f"Read multiple files within '{BASE_ALLOWED_PATH}'. Paths relative.", "input_schema": {"type": "OBJECT", "properties": {"paths": {"type": "ARRAY", "items": {"type": "STRING"}}}, "required": ["paths"]}},
        {"name": "search_files", "description": f"Search files in dir within '{BASE_ALLOWED_PATH}'. Path relative.", "input_schema": {"type": "OBJECT", "properties": {"directory_path": {"type": "STRING"}, "regex_pattern": {"type": "STRING"}, "file_glob_pattern": {"type": "STRING", "default": "*"}, "recursive": {"type": "BOOLEAN", "default": True}, "case_sensitive": {"type": "BOOLEAN", "default": False}}, "required": ["directory_path", "regex_pattern"]}},
        {"name": "write_file", "description": f"Write to file within '{BASE_ALLOWED_PATH}'. Path relative.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}, "content": {"type": "STRING"}, "create_directories": {"type": "BOOLEAN", "default": True}, "append": {"type": "BOOLEAN", "default": False}}, "required": ["path", "content"]}}
    ]

    # Static schema for general capabilities reporting (descriptions are generic)
    STATIC_TOOLS_SCHEMA_FOR_CAPABILITIES: List[Dict[str, Any]] = [
        {"name": "directory_tree", "description": "Get directory tree. Paths relative to workspace.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}, "max_depth": {"type": "INTEGER", "default": 3}, "include_files": {"type": "BOOLEAN", "default": True}}, "required": ["path"]}},
        {"name": "edit_file", "description": "Edit file. Path relative to workspace.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}, "edits": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {"operation": {"type": "STRING", "enum": ["insert", "delete", "replace"]}, "line_number": {"type": "INTEGER"}, "content": {"type": "STRING"}, "num_lines_to_delete": {"type": "INTEGER", "default": 1}}, "required": ["operation", "line_number"]}}}, "required": ["path", "edits"]}},
        {"name": "get_file_info", "description": "Get file/dir info. Path relative to workspace.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}}, "required": ["path"]}},
        {"name": "list_allowed_directories", "description": "List current base workspace.", "input_schema": {"type": "OBJECT", "properties": {}, "required": []}},
        {"name": "list_directory", "description": "List directory contents. Path relative to workspace.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}, "recursive": {"type": "BOOLEAN", "default": False}, "max_depth": {"type": "INTEGER", "default": 0}}, "required": ["path"]}},
        {"name": "move_file", "description": "Move file/dir. Paths relative to workspace.", "input_schema": {"type": "OBJECT", "properties": {"source_path": {"type": "STRING"}, "destination_path": {"type": "STRING"}}, "required": ["source_path", "destination_path"]}},
        {"name": "read_file", "description": "Read file. Path relative to workspace.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}}, "required": ["path"]}},
        {"name": "read_multiple_files", "description": "Read multiple files. Paths relative to workspace.", "input_schema": {"type": "OBJECT", "properties": {"paths": {"type": "ARRAY", "items": {"type": "STRING"}}}, "required": ["paths"]}},
        {"name": "search_files", "description": "Search files in dir. Path relative to workspace.", "input_schema": {"type": "OBJECT", "properties": {"directory_path": {"type": "STRING"}, "regex_pattern": {"type": "STRING"}, "file_glob_pattern": {"type": "STRING", "default": "*"}, "recursive": {"type": "BOOLEAN", "default": True}, "case_sensitive": {"type": "BOOLEAN", "default": False}}, "required": ["directory_path", "regex_pattern"]}},
        {"name": "write_file", "description": "Write to file. Path relative to workspace.", "input_schema": {"type": "OBJECT", "properties": {"path": {"type": "STRING"}, "content": {"type": "STRING"}, "create_directories": {"type": "BOOLEAN", "default": True}, "append": {"type": "BOOLEAN", "default": False}}, "required": ["path", "content"]}}
    ]

    return LOCAL_TOOLS_SCHEMA, LOCAL_TOOL_HANDLERS, STATIC_TOOLS_SCHEMA_FOR_CAPABILITIES
#     except Exception as e:
#         print(f"An unexpected error occurred: {e}", file=sys.stderr)