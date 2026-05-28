"""Per-language runtime configurations: image, compile, run commands."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Runtime:
    image: str          # Docker image, pre-pulled
    extension: str
    compile: list[str] | None       # commands run inside sandbox to compile (or None)
    run: list[str]                  # command to execute
    entrypoint_filename: str        # canonical name we mount into /workspace


RUNTIMES: dict[str, Runtime] = {
    "python": Runtime(
        image="sdc-runtime-python:3.12",
        extension="py",
        compile=None,
        run=["python", "/workspace/main.py"],
        entrypoint_filename="main.py",
    ),
    "java": Runtime(
        image="sdc-runtime-java:21",
        extension="java",
        compile=["javac", "-d", "/workspace/build", "@sources.txt"],
        run=["java", "-Xss8m", "-cp", "/workspace/build", "Main"],
        entrypoint_filename="Main.java",
    ),
    "cpp": Runtime(
        image="sdc-runtime-cpp:13",
        extension="cpp",
        compile=["g++", "-O2", "-std=c++20", "/workspace/main.cpp", "-o", "/workspace/main"],
        run=["/workspace/main"],
        entrypoint_filename="main.cpp",
    ),
    "go": Runtime(
        image="sdc-runtime-go:1.22",
        extension="go",
        compile=["go", "build", "-o", "/workspace/main", "/workspace/"],
        run=["/workspace/main"],
        entrypoint_filename="main.go",
    ),
    "typescript": Runtime(
        image="sdc-runtime-node:20",
        extension="ts",
        compile=["npx", "-y", "tsx", "--version"],  # tsx runs TS directly
        run=["npx", "-y", "tsx", "/workspace/main.ts"],
        entrypoint_filename="main.ts",
    ),
    "javascript": Runtime(
        image="sdc-runtime-node:20",
        extension="js",
        compile=None,
        run=["node", "/workspace/main.js"],
        entrypoint_filename="main.js",
    ),
}
