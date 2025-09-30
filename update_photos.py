#!/usr/bin/env python3
"""
Atualiza photos/photos.json e (opcional) faz git add/commit/push.

Uso:
  python update_photos.py                 # só gera/atualiza o JSON
  python update_photos.py --push          # gera JSON e faz commit/push
  python update_photos.py --rename        # renomeia arquivos p/ nomes seguros
  python update_photos.py --rename --push # tudo de uma vez

Requisitos:
  - Python 3.8+
  - Git instalado e repositório já configurado (remote "origin" ok, login salvo)
"""
from __future__ import annotations
import argparse
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from typing import List, Tuple

# Config
PHOTOS_DIR = Path("photos")
JSON_PATH  = PHOTOS_DIR / "photos.json"
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp"}

def slugify(name: str) -> str:
    """Remove acentos, espaços e caracteres ruins."""
    n = unicodedata.normalize("NFKD", name)
    n = n.encode("ascii", "ignore").decode("ascii")
    n = n.lower()
    n = re.sub(r"[^a-z0-9._-]+", "-", n).strip("-")
    n = re.sub(r"-{2,}", "-", n)
    return n

def list_images() -> List[Path]:
    if not PHOTOS_DIR.exists():
        PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for p in PHOTOS_DIR.iterdir():
        if p.is_file() and p.suffix.lower() in ALLOWED_EXT:
            files.append(p)
    # ordena por mtime asc (antigas primeiro)
    files.sort(key=lambda p: p.stat().st_mtime)
    return files

def safe_rename(files: List[Path]) -> Tuple[List[Path], int]:
    """Garante nomes 'seguros'; renomeia quando necessário."""
    renamed = 0
    out = []
    used = set()
    for p in files:
        safe = slugify(p.name)
        if not safe:
            safe = "foto"
        # preserva extensão
        ext = p.suffix.lower()
        base = Path(safe).stem
        candidate = base + ext
        i = 1
        # evita colisão de nomes
        while candidate in used or (p.parent / candidate).exists() and (p.name != candidate):
            candidate = f"{base}-{i}{ext}"
            i += 1
        if candidate != p.name:
            p_new = p.with_name(candidate)
            p.rename(p_new)
            renamed += 1
            out.append(p_new)
            used.add(candidate)
        else:
            out.append(p)
            used.add(p.name)
    # reordena após renomear
    out.sort(key=lambda x: x.stat().st_mtime)
    return out, renamed

def write_json(files: List[Path]) -> int:
    data = {
        "images": [f.name for f in files]  # nomes relativos dentro de photos/
    }
    JSON_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return len(data["images"])

def run(cmd: List[str]) -> int:
    print(">", " ".join(cmd))
    return subprocess.call(cmd)

def do_git_push(message: str) -> None:
    # adiciona somente a pasta photos (mais seguro)
    rc = run(["git", "add", "photos"])
    if rc != 0: sys.exit(rc)
    # commit (se houver mudanças)
    rc = run(["git", "commit", "-m", message])
    if rc != 0:
        print("⚠️ Nada para commit? (pode já estar atualizado)")
    # push
    rc = run(["git", "push"])
    if rc != 0: sys.exit(rc)

def main():
    ap = argparse.ArgumentParser(description="Gera photos/photos.json e faz push opcional")
    ap.add_argument("--push", action="store_true", help="faz git add/commit/push")
    ap.add_argument("--rename", action="store_true", help="renomeia arquivos para nomes seguros")
    args = ap.parse_args()

    files = list_images()
    if not files:
        print("⚠️ Nenhuma imagem encontrada em 'photos/'.")
        # ainda assim cria/zera o JSON:
        write_json([])
        if args.push:
            do_git_push("chore(photos): atualizar photos.json (vazio)")
        return

    if args.rename:
        files, n = safe_rename(files)
        if n:
            print(f"✏️  Renomeados {n} arquivo(s) para nomes seguros.")

    count = write_json(files)
    print(f"✅ photos.json atualizado com {count} imagem(ns).")

    if args.push:
        do_git_push(f"chore(photos): atualizar photos.json ({count} imagens)")

if __name__ == "__main__":
    main()
