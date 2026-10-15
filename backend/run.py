import os
import sys

# Ensure backend directory is in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

try:
    import uvicorn
except ModuleNotFoundError:
    # Auto-detect and switch to virtual environment python if invoked from global python
    root_dir = os.path.dirname(backend_dir)
    possible_venv_pythons = [
        os.path.join(root_dir, ".venv", "Scripts", "python.exe"),
        os.path.join(backend_dir, ".venv", "Scripts", "python.exe"),
        os.path.join(root_dir, "venv", "Scripts", "python.exe"),
        os.path.join(backend_dir, "venv", "Scripts", "python.exe"),
        os.path.join(root_dir, ".venv", "bin", "python"),
        os.path.join(backend_dir, ".venv", "bin", "python"),
        os.path.join(root_dir, "venv", "bin", "python"),
        os.path.join(backend_dir, "venv", "bin", "python"),
    ]
    venv_python = next((p for p in possible_venv_pythons if os.path.isfile(p)), None)
    if venv_python and os.path.abspath(sys.executable) != os.path.abspath(venv_python):
        print(f"[INFO] Detected virtual environment. Launching with: {venv_python}")
        import subprocess
        result = subprocess.run([venv_python] + sys.argv)
        sys.exit(result.returncode)
    else:
        print("[ERROR] 'uvicorn' is not installed in this Python environment.")
        print("Please run using the project virtual environment:")
        print("  ..\\venv\\Scripts\\python.exe run.py")
        sys.exit(1)

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
