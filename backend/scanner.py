# scanner.py
import os
import fnmatch
from pathlib import Path
from typing import Dict, List, Optional

# --- Logic Ported from project-mapper.py ---
# We exclude the DB directory itself to prevent recursion loops
EXCLUDED_FOLDERS = {
    "node_modules", ".git", "__pycache__", ".venv", ".mypy_cache",
    "_logs", "dist", "build", ".vscode", ".idea", "target", "out",
    "bin", "obj", "Debug", "Release", "logs", "data", "backend"
}

PREDEFINED_EXCLUDED_FILENAMES = {
    "package-lock.json", "yarn.lock", ".DS_Store", "Thumbs.db",
    "*.pyc", "*.pyo", "*.swp", "*.swo", "*.lock"
}

# Exact binary list from project-mapper.py for safety
FORCE_BINARY_EXTENSIONS = {
    ".tar.gz", ".gz", ".zip", ".rar", ".7z", ".bz2", ".xz", ".tgz",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".tif", ".tiff",
    ".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a",
    ".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp",
    ".exe", ".dll", ".so", ".o", ".a", ".lib", ".app", ".dmg", ".deb", ".rpm",
    ".db", ".sqlite", ".mdb", ".accdb", ".dat", ".idx", ".pickle", ".joblib",
    ".pyc", ".pyo", ".class", ".jar", ".wasm",
    ".ttf", ".otf", ".woff", ".woff2",
    ".iso", ".img", ".bin", ".bak", ".data", ".asset", ".pak"
}

class ProjectScanner:
    def __init__(self, root_path: str):
        self.root_path = Path(root_path).resolve()

    def is_binary(self, file_path: Path) -> bool:
        """
        Determines if a file is binary based on extension or content sniffing.
        Ported from project-mapper.py
        """
        # 1. Extension Check
        if "".join(file_path.suffixes).lower() in FORCE_BINARY_EXTENSIONS:
            return True
        
        # 2. Content Sniff (First 1024 bytes)
        try:
            with open(file_path, 'rb') as f:
                return b'\0' in f.read(1024)
        except (IOError, PermissionError):
            return True
        except Exception:
            return True

    def is_excluded_name(self, name: str) -> bool:
        """Checks glob patterns for filenames."""
        return any(fnmatch.fnmatch(name, pat) for pat in PREDEFINED_EXCLUDED_FILENAMES)

    def scan(self) -> Dict:
        """
        Returns a JSON-serializable tree structure for the React Frontend.
        """
        if not self.root_path.exists():
            return {"error": "Path does not exist"}
        
        return self._scan_recursive(self.root_path)

    def _scan_recursive(self, current_path: Path) -> Dict:
        node = {
            "name": current_path.name,
            "path": str(current_path), # Absolute path for the backend to use later
            "rel_path": str(current_path.relative_to(self.root_path.parent)), # Display path
            "type": "folder" if current_path.is_dir() else "file",
            "checked": True, # UI Default: Checked
            "children": []
        }

        if current_path.is_dir():
            # Auto-uncheck excluded folders (Node Modules, etc.)
            if current_path.name in EXCLUDED_FOLDERS:
                node["checked"] = False
            
            try:
                # Sort directories first, then files
                items = sorted(list(current_path.iterdir()), key=lambda x: (x.is_file(), x.name.lower()))
                
                for item in items:
                    # Safety: Skip hidden files if desired, or strictly follow exclusion list
                    child = self._scan_recursive(item)
                    node["children"].append(child)
            except PermissionError:
                node["error"] = "Permission Denied"

        else:
            # File Logic
            if self.is_binary(current_path):
                node["type"] = "binary"
                node["checked"] = False # Auto-uncheck binaries
            elif self.is_excluded_name(current_path.name):
                node["checked"] = False # Auto-uncheck lockfiles/etc

        return node