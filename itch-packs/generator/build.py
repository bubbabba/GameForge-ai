"""Build every pack, zip it, and leave itch-page images next to the zips.

    python3 build.py [out_dir]       (default: ../dist)
"""
import os
import shutil
import sys

import pack_interiors
import pack_town

out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'dist'))
os.makedirs(out, exist_ok=True)
for mod in (pack_town, pack_interiors):
    root, stats = mod.build(out)
    zip_base = os.path.join(out, os.path.basename(root))
    shutil.make_archive(zip_base, 'zip', os.path.dirname(root), os.path.basename(root))
    shutil.rmtree(root)
    print(f'{zip_base}.zip', stats)
