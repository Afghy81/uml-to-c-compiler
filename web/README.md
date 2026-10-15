# UML-to-C Compiler - Web Interface

Web-based compiler interface untuk mentranslasi model UML (JSON) ke kode C.

## Screenshot

Interface dengan split-panel: JSON input di kiri, C output di kanan.

## Features

✓ **Real-time Compilation** - Compile model UML ke C dengan satu klik
✓ **Multi-file Output** - Generate header (.h), source (.c), dan main files
✓ **Syntax Highlighting** - Dark theme dengan line numbers
✓ **File Management** - Load JSON, download generated C code
✓ **Keyboard Shortcuts** - Ctrl+Enter compile, Ctrl+S download

## Usage

### Start Web Server

```bash
cd web
python -m http.server 8000
```

Buka browser: `http://localhost:8000`

### Compile Model

1. **Input JSON model** di panel kiri (atau load file dengan 📁 Open JSON)
2. **Click ▶ Compile** (atau tekan Ctrl+Enter)
3. **View generated code** di panel kanan
4. **Switch files** dengan dropdown (Door.h, Door.c, main.c)
5. **Download** semua file dengan 💾 Download

### Keyboard Shortcuts

- `Ctrl+Enter` - Compile model
- `Ctrl+S` - Download all files

## Model Format

JSON model sama dengan CLI version:

```json
{
  "name": "ModelName",
  "classes": [
    {
      "name": "ClassName",
      "is_active": true,
      "attributes": [...],
      "operations": [...],
      "state_machine": {...}
    }
  ]
}
```

## Architecture

- `index.html` - Web interface layout
- `style.css` - VSCode-inspired dark theme
- `compiler.js` - UML-to-C compiler logic (JavaScript port)
- `app.js` - UI event handlers & file management

## Browser Support

Modern browsers with ES6 support:
- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+
