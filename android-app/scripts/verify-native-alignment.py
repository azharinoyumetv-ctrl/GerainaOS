"""Check actual ELF load-segment alignment, in addition to APK container zipalign."""
import json
import struct
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
libraries = []
with zipfile.ZipFile(root / "releases/Geraina-POS-1.2.4.apk") as package:
    for name in package.namelist():
        if not name.endswith(".so"):
            continue
        assert name.split("/")[1] in ("arm64-v8a", "x86_64"), name
        data = package.read(name)
        assert data[:4] == b"\x7fELF" and data[4] == 2 and data[5] == 1
        start = struct.unpack_from("<Q", data, 32)[0]
        size, count = struct.unpack_from("<HH", data, 54)
        alignments = []
        for index in range(count):
            entry = start + index * size
            if struct.unpack_from("<I", data, entry)[0] == 1:
                offset, address = struct.unpack_from("<QQ", data, entry + 8)
                alignment = struct.unpack_from("<Q", data, entry + 48)[0]
                assert alignment >= 16384 and offset % 16384 == address % 16384, (name, alignment)
                alignments.append(alignment)
        assert alignments
        libraries.append({"library": name, "loadAlignments": alignments})
assert libraries
report = {"status": "passed", "pageSize": 16384, "libraries": libraries}
(root / "build/native-library-alignment.json").write_text(json.dumps(report, indent=2))
print(f"All {len(libraries)} 64-bit native libraries pass 16 KB ELF load-segment checks.")
