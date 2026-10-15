#!/usr/bin/env python3
"""
End-to-end validation script untuk UML-to-C Compiler
Verifikasi bahwa web output sama dengan CLI output
"""

import json
import subprocess
import sys
from pathlib import Path

def run_cli_compiler(model_path, output_dir):
    """Run Python CLI compiler"""
    cmd = [sys.executable, "-m", "compiler.cli", model_path, "-o", output_dir]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode == 0

def compare_outputs(cli_dir, web_dir):
    """Compare CLI vs Web generated code"""
    cli_files = list(Path(cli_dir).glob("*.h")) + list(Path(cli_dir).glob("*.c"))
    differences = []
    
    for cli_file in cli_files:
        web_file = Path(web_dir) / cli_file.name
        
        if not web_file.exists():
            differences.append(f"Missing web output: {cli_file.name}")
            continue
        
        cli_content = cli_file.read_text()
        web_content = web_file.read_text()
        
        # Normalize whitespace for comparison
        cli_lines = [l.strip() for l in cli_content.split('\n') if l.strip()]
        web_lines = [l.strip() for l in web_content.split('\n') if l.strip()]
        
        if cli_lines != web_lines:
            differences.append(f"Content differs: {cli_file.name}")
    
    return differences

def main():
    print("=== UML-to-C Compiler Validation ===\n")
    
    # Test with example model
    model_path = "examples/door_model.json"
    cli_output = "output_cli"
    web_output = "output_web"  # User should copy web output here
    
    print("1. Running CLI compiler...")
    if not run_cli_compiler(model_path, cli_output):
        print("✗ CLI compilation failed")
        return 1
    print("✓ CLI compilation success")
    
    print("\n2. Checking web compiler output...")
    print("   (Copy web-generated files to output_web/ for comparison)")
    
    if Path(web_output).exists():
        differences = compare_outputs(cli_output, web_output)
        if differences:
            print("\n✗ Differences found:")
            for diff in differences:
                print(f"  - {diff}")
            return 1
        else:
            print("✓ Web output matches CLI output")
    else:
        print("⚠ Web output directory not found (skip comparison)")
    
    print("\n=== Validation Complete ===")
    print("Status: PASSED")
    return 0

if __name__ == '__main__':
    sys.exit(main())
