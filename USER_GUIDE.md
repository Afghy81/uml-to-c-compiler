# UML-to-C Compiler — User Guide

## 📖 Daftar Isi
1. [Overview](#overview) 2. [Instalasi](#instalasi) 3. [Quick Start](#quick-start)
4. [CLI](#cli) 5. [Web Interface](#web-interface) 6. [Model Format](#model-format)
7. [xtUML BridgePoint Langsung](#xtuml-bridgepoint-langsung) 8. [Runtime](#runtime)
9. [Contoh](#contoh) 10. [Troubleshooting](#troubleshooting) 11. [Lanjutan](#lanjutan)

---

## Overview

Kompiler menerjemahkan **model UML/xtUML → C99 embedded-ready**. Input fleksibel:

| Input | Contoh | Parser |
|-------|--------|--------|
| JSON native | `examples/door_model.json` | `parser/json_loader.py` |
| JSON envelope xtUML VM | `ref_xtuml_python/vending_machine.json` | `json_loader._normalizeXtuml` |
| **.xtuml mentah BP 7.x** | `VendingMachine.xtuml` / workspace folder | **`parser/xtuml_loader.py` / `web/xtuml_parser.js`** |

Semua dinormalisasi ke **IR yang sama** (`ir/metamodel.py` + `ir_builder.py`) lalu di-emit jadi `*.h/*.c + runtime_c` tanpa `malloc`.

Fitur: class/attribute/operation, FSM (state/event/transition), relationship pointer, subset OAL, pool statis, event queue ring-buffer.

---

## Instalasi

- Python 3.8+, GCC (MinGW / TDM-GCC)
- Tanpa `pip install` — stdlib only.

```powershell
cd c:\Users\Afghy\Documents\Coding\PPPL\uml-to-c-compiler
python -m compiler.cli --help
```

---

## Quick Start

### JSON (lama, tetap jalan)

```powershell
python -m compiler.cli examples\calculator.json -o output
Copy-Item examples\calculator_main.c output\main.c -Force
cd output; gcc -I. -Iruntime_c Calculator.c main.c -o calculator.exe; .\calculator.exe
```

### xtUML mentah (baru — tanpa JSON manual)

```powershell
# satu file
python -m compiler.cli "C:\BridgePoint\workspace\pppl_project\models\pppl_project\drink\VendingMachine\VendingMachine.xtuml" -o output -v

# seluruh workspace (semua .xtuml digabung)
python -m compiler.cli "C:\BridgePoint\workspace\pppl_project" -o output -v --dump-json imported.json
cd output; gcc -I. -Iruntime_c VendingMachine.c main.c -o vm.exe
```

### Web (JSON maupun .xtuml)

```powershell
cd web; python -m http.server 8000
# buka http://localhost:8000
# paste isi .xtuml mentah ATAU JSON lalu Compile
# atau Open File -> pilih *.xtuml / *.json (multi-file didukung)
```

---

## CLI

```
python -m compiler.cli <model> -o <out> [-v] [--dump-json FILE]

<model> = .json | .xtuml | folder/workspace berisi .xtuml
```

| Flag | Makna |
|------|-------|
| `-o, --output` | folder output (default `output`) |
| `-v, --verbose` | tampilkan tipe input (xtUML vs JSON) + per-class |
| `--dump-json FILE` | simpan JSON native hasil normalisasi (debug) |

Deteksi otomatis: jika path adalah folder berisi `*.xtuml` atau file mengandung `// BP ... persistence-version` + `within ... is`, dianggap xtUML.

### Wrapper lama

`python tools/xtuml_import.py <input> -o model.json` masih ada — hanya memanggil `xtuml_loader.xtuml_to_dict`.

---

## Web Interface

**Start:** `python -m http.server 8000` dari `web/` (bukan dari root — lihat log 404 sebelumnya jika salah folder).

**Fitur:**
- Input: JSON atau `.xtuml` mentah (paste atau multi-file upload)
- Deteksi: sebelum `JSON.parse`, `compiler.js` cek `// BP` / `persistence-version` / `within`; jika ya → `xtuml_parser.js:parseXtumlText` lalu IR yang sama.
- Output: dropdown dinamis menampilkan **semua** `*.h/*.c` ter-generate (multi-class), bukan hanya class pertama.
- Download: mengunduh semua file sekaligus.

Alur paste `.xtuml` yang sebelumnya error `Unexpected token '/'` kini langsung ter-compile.

---

## Model Format

### JSON native (minimal)

```json
{
  "name": "MySystem",
  "classes": [{
    "name": "MyClass",
    "attributes": [{"name": "value", "type": "int", "default": "0"}],
    "operations": [{"name": "increment", "return_type": "void", "body": "self->value++"}]
  }],
  "relationships": []
}
```

### FSM

```json
{"name":"Door","states":[{"name":"Locked","is_initial":true},{"name":"Unlocked"}],
 "transitions":[{"from":"Locked","to":"Unlocked","event":"unlock"}]}
```

### .xtuml mentah (BridgePoint 7.x)

```
within pppl_project::drink is
  @key_letters("VendingMachine"); @class_num(1);
  class VendingMachine is  currentState: integer;  end class;
end;

// + file InstanceStateMachine/*.xtuml:
@state_num(1); @dialect("oal"); state Idle;
transition Idle [ProductSelected] => CheckStock is ...
```

Parser (Python/JS) ekstrak `within / class / attr: type; / @event_num / @state_num / transition` via regex stdlib → emit JSON native yang sama.

---

## xtUML BridgePoint Langsung

| Skenario | Perintah |
|----------|----------|
| File tunggal | `python -m compiler.cli path/to/Class.xtuml -o out` |
| Folder | `python -m compiler.cli path/to/drink -o out` |
| Workspace | `python -m compiler.cli "C:\BridgePoint\workspace\pppl_project" -o out` |
| Web single | paste 1 file `.xtuml` |
| Web multi | Open File pilih beberapa `*.xtuml` (digabung sebelum parse) |

Representasi teknis: `tools/xtuml_import.py` sekarang wrapper; sumber kebenaran ada di `compiler/parser/xtuml_loader.py` (produksi) dan `web/xtuml_parser.js` (port browser). Keduanya menangkap owner class dari `within` terakhir.

---

## Runtime

`runtime_c/`:

| Header | Fungsi |
|--------|--------|
| `uml_types.h` | `UML_InstanceHeader_t`, `uml_string_t`, alias `int32_t/float/bool` |
| `uml_pool.h` | `DEFINE_STATIC_POOL` / pool statis per class |
| `uml_event_queue.h` | ring buffer event FIFO |
| `uml_port.h` | `UML_ASSERT`, `UML_LOG` |

Kompilasi:

```powershell
gcc -I. -Iruntime_c *.c -o app.exe
# atau Copy-Item -Recurse runtime_c output\
```

---

## Contoh

### Calculator (stateless)

```powershell
python -m compiler.cli examples\calculator.json -o output
Copy-Item examples\calculator_main.c output\main.c -Force
cd output; gcc -I. -Iruntime_c Calculator.c main.c -o calculator.exe
```

### Door FSM

```powershell
python -m compiler.cli examples\door_model.json -o output
# tulis main.c yang kirim event, lalu gcc -I. -Iruntime_c Door.c main.c -o door.exe
```

### VendingMachine dari workspace (multi-class asli `vending_machine.json` 8 class → 17 file)

```powershell
python -m compiler.cli ..\ref_xtuml_python\vending_machine.json -o output -v
# atau langsung dari .xtuml workspace
python -m compiler.cli "C:\BridgePoint\workspace\pppl_project" -o output -v
```

---

## Troubleshooting

| Gejala | Sebab | Solusi |
|--------|-------|--------|
| `Unexpected token '/'` di web saat paste .xtuml | `xtuml_parser.js` belum ter-load (cache) | **Ctrl+F5** (hard refresh) |
| `GET /compiler.js 404` | `http.server` dijalankan dari root, bukan `web/` | `cd web; python -m http.server 8000` → `http://localhost:8000/` |
| `uml_types.h: No such file` | runtime tidak di include path | `Copy-Item -Recurse runtime_c output\` + `gcc -I. -Iruntime_c ...` |
| `cli: error: required: model` | argumen hilang | `python -m compiler.cli examples\door_model.json -o output` |
| `Unknown type inst_ref` | ada di model baru — sudah difix | update ke versi terbaru (forward typedef + `_mapType`) |

---

## Lanjutan

### Custom type

Edit `codegen/c_writer.py:map_type`.

### FSM dispatch

Tiap class aktif hasilkan `Class_dispatch_event(self, evt)` + enum `CLASS_STATE_*` / `CLASS_EVENT_*`.

### Validasi

```powershell
python tests/test_compiler.py
python -m http.server 8000  # Run Tests di UI
```

---

## Struktur Proyek (aktual)

```
uml-to-c-compiler/
├── compiler/parser/xtuml_loader.py   # NEW — .xtuml mentah -> dict
├── compiler/cli.py                   # deteksi otomatis xtUML vs JSON
├── web/xtuml_parser.js               # NEW — port browser
├── web/compiler.js                   # compile() deteksi xtUML dulu
├── tools/xtuml_import.py             # wrapper kompatibilitas
└── (lainnya: ir/, codegen/, runtime_c/, examples/, tests/)
```

## Arsitektur & Deployment (ringkasan presentasi)

Lihat `PLANNING_UML_TO_C_COMPILER.md` Bab 4–8 untuk diagram pipeline, IR metamodel, pemetaan UML→C, runtime, dan deployment. Versi kini menambahkan **jalur xtUML mentah** sebagai first-class input.

**Last Updated:** 2026-10-15
