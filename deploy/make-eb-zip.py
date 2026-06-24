import os
import sys
import zipfile

staging = sys.argv[1]
zip_path = sys.argv[2]

with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _, files in os.walk(staging):
        for name in files:
            full = os.path.join(root, name)
            arc = os.path.relpath(full, staging).replace(os.sep, "/")
            zf.write(full, arc)

print(f"Created {zip_path}")