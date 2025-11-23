# PyInstaller spec file for tray_runner
# Build with: pyinstaller --clean --noconfirm tray_runner.spec

block_cipher = None

import sys
from pathlib import Path

script = 'tray_runner.py'

# Collect data; minimal since we rely on installed packages

a = Analysis([
    script
],
    pathex=[str(Path(__file__).parent)],
    binaries=[],
    datas=[],
    hiddenimports=['pystray','PIL'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name='tray_runner',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # windowed
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
