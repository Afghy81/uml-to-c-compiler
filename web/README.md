# UML-to-C Compiler — 3-Mode Interactive Web Workspace

Antarmuka web interaktif berbasis **Model-Driven Architecture (MDA)** untuk memodelkan, mem-parsing, dan mentranslasikan model UML / xtUML ke kode **Procedural ANSI C (`.h` & `.c`)**.

## 3-Mode Interactive Left Panel (`Single Source of Truth: canonicalXtUmlJson`)

Panel kiri telah direfaktor menjadi tiga tab interaktif yang tersinkronisasi penuh terhadap satu state kanonik (`window.canonicalXtUmlJson`), sementara panel kanan menampilkan **`C OUTPUT`**:

1. **`1. Visual` (Interactive Visual UML Modeler)**
   - Merender diagram UML secara grafis (SVG Class Diagram Blueprint, Interactive Class Cards, State Machine Diagram, dan Action OAL Control-Flow Diagram).
   - Memungkinkan pengguna menambah/menghapus **Class**, **Atribut** (beserta tipe `float`, `int`, `bool`, `string` dan visibilitas), **Metode** (beserta return type dan body OAL), serta **Relasi (`R1..Rn`)** secara langsung tanpa menulis JSON/XML manual.
   - Setiap perubahan visual otomatis memperbarui XML/XMI di **`2. Parsing`**, kode JSON di **`3. Translasi UML`**, serta mengompilasi ulang output C di **`C OUTPUT`**.

2. **`2. Parsing` (XML / XMI Diagram Parser & Semantic Entity Tagging)**
   - Menyediakan editor input dan tombol upload untuk file **XML / XMI** (`<uml:Model>`, `<packagedElement xmi:type="uml:Class">`, `<ownedAttribute>`, `<ownedOperation>`, maupun simple XML `<class>`).
   - Melakukan analisis sintaksis & semantik serta menampilkan log identifikasi entitas secara eksplisit, misalnya:
     > *"Teridentifikasi Class: `Sensor` — memiliki atribut `suhu` (tipe: `float`) dan metode `bacaData()`"*
   - Menampilkan tabel **Intermediate Representation (AST Node)** (`Class("Sensor")`, `Field(name="suhu", type="float", visibility="private")`, `Method(name="bacaData", return_type="void", params=[])`) beserta target pemetaannya ke ANSI C.
   - Otomatis mengonversi hasil ekstraksi XML ke skema **xtUML `.json`** dan menyinkronkannya ke **`1. Visual`** serta **`3. Translasi UML`**.

3. **`3. Translasi UML` (Canonical xtUML `.json` Editor)**
   - Menampilkan kode **xtUML `.json`** yang siap dikompilasi (dilengkapi tombol Format `✨` dan Clear `🗑️`).
   - Klik **`▶ Compile / Translate`** di toolbar atas untuk mentranslasikan `.json` ke kode C prosedural di panel **`C OUTPUT`** (`Sensor.h`, `Sensor.c`, `Controller.h`, `Controller.c`, `main.c`).

## Cara Menjalankan

```bash
cd web
python -m http.server 8000
```

Buka browser di `http://localhost:8000` (gunakan `Ctrl+F5` untuk hard refresh).
