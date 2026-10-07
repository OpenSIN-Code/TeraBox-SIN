/**
 * Narrowed transfer filter for `/Entwicklung` source trees.
 *
 * Background: the consumer-side rule `is_development_path` excludes the
 * ENTIRE top-level `/Entwicklung` tree from staging and upload in both
 * size queues (GitNexus: CRITICAL, 13 edges, 6 transfer processes).
 * That complete exclusion is too broad: media and documents stored under
 * `/Entwicklung` never reach the mirror.
 *
 * This module implements the NARROWED rule as pure functions with no
 * side effects (no network, no filesystem, no secrets):
 *
 * - Only unambiguous source-code extensions are excluded.
 * - Only known dependency/build directories are excluded.
 * - Ambiguous `.json`/`.md`/`.zip` (plus `.yaml`/`.yml`/`.toml`) are
 *   excluded ONLY on a clear project/build path.
 * - Media and documents always remain eligible.
 *
 * It is intentionally disjoint from the live transfer writers: importing
 * or testing this module never starts a transfer and never touches a
 * running writer. Consumers adopt it explicitly.
 */

/** Queue presets mirroring the two consumer size queues (bytes). */
export const SIZE_QUEUES = {
    small: { name: 'small', minSize: 1, maxSize: 100 * 1024 * 1024 },
    big: { name: 'big', minSize: 100 * 1024 * 1024 + 1, maxSize: Number.MAX_SAFE_INTEGER },
};

/** Unambiguous source-code extensions (lowercase, without dot). */
const SOURCE_EXTENSIONS = new Set([
    'js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'mts', 'cts',
    'py', 'pyw', 'rb', 'go', 'rs', 'java', 'kt', 'kts',
    'swift', 'c', 'h', 'cc', 'cpp', 'hpp', 'cxx', 'cs',
    'php', 'lua', 'pl', 'pm', 'r', 'scala', 'sc', 'sh',
    'bash', 'zsh', 'fish', 'ps1', 'ex', 'exs', 'erl',
    'hrl', 'dart', 'vue', 'svelte', 'sol', 'tf', 'hcl',
    'proto', 'graphql', 'gql', 'asm', 's', 'o', 'so',
    'a', 'class', 'jar', 'pyc', 'pyo',
]);

/** Dependency/build/output directory segments (lowercase). */
const BUILD_DIR_SEGMENTS = new Set([
    'node_modules', '.git', '__pycache__', '.venv', 'venv',
    'vendor', 'target', 'build', 'dist', 'out', '.next',
    '.nuxt', 'coverage', '.tox', '.eggs', 'pods',
    'deriveddata', '.gradle', '.idea', '.vscode', '.turbo',
]);

/** Lockfile/manifest basenames excluded wherever they appear (lowercase). */
const LOCKFILE_BASENAMES = new Set([
    'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock',
    'gemfile.lock', 'poetry.lock', 'pipfile.lock',
    'composer.lock', 'cargo.lock', 'go.sum', 'podfile.lock',
    'package.json', 'pyproject.toml', 'cargo.toml', 'go.mod',
]);

/** Ambiguous extensions: excluded only on a clear project/build path. */
const AMBIGUOUS_EXTENSIONS = new Set(['json', 'md', 'zip', 'yaml', 'yml', 'toml']);

/** Media extensions: never excluded. */
const MEDIA_EXTENSIONS = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif',
    'tif', 'tiff', 'bmp', 'svg', 'avif', 'ico',
    'mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v', '3gp',
    'mp3', 'wav', 'flac', 'm4a', 'ogg', 'oga', 'opus', 'aac',
]);

/** Document extensions: never excluded. */
const DOCUMENT_EXTENSIONS = new Set([
    'pdf', 'doc', 'docx', 'odt', 'rtf', 'txt',
    'xls', 'xlsx', 'ods', 'csv', 'tsv',
    'ppt', 'pptx', 'odp', 'epub', 'mobi', 'azw3',
]);

function assertCanonicalPath(path) {
    if (typeof path !== 'string' || !path) {
        throw new Error('canonical inventory path must be a non-empty string');
    }
    return path;
}

export function splitSegments(path) {
    assertCanonicalPath(path);
    return path.replace(/^\/+/, '').split('/').filter(Boolean);
}

/**
 * Compatibility helper mirroring the OLD broad consumer rule:
 * true when the top-level segment is `Entwicklung` (case-insensitive).
 * Kept for documentation/migration only — NOT used for exclusion.
 */
export function isDevelopmentPath(path) {
    const segments = splitSegments(path);
    return segments.length > 0 && segments[0].toLowerCase() === 'entwicklung';
}

function extensionOf(basename) {
    const dot = basename.lastIndexOf('.');
    if (dot <= 0 || dot === basename.length - 1) return '';
    return basename.slice(dot + 1).toLowerCase();
}

function hasBuildSegment(segments) {
    return segments.some((segment) => {
        const lower = segment.toLowerCase();
        if (BUILD_DIR_SEGMENTS.has(lower)) return true;
        return lower.endsWith('.egg-info');
    });
}

/**
 * Narrowed exclusion check.
 *
 * Returns true ONLY for unambiguous code/build artifacts inside the
 * top-level `/Entwicklung` tree. Everything else — media, documents,
 * and any path outside `/Entwicklung` — returns false (eligible).
 */
export function isExcludedDevelopmentArtifact(path) {
    assertCanonicalPath(path);
    if (!isDevelopmentPath(path)) return false;
    const segments = splitSegments(path);
    const basename = segments[segments.length - 1] ?? '';
    const lowerBase = basename.toLowerCase();
    const ext = extensionOf(lowerBase);

    // Media and documents are always eligible.
    if (MEDIA_EXTENSIONS.has(ext) || DOCUMENT_EXTENSIONS.has(ext)) return false;

    // Known dependency/build directories anywhere below /Entwicklung.
    // This also covers ambiguous .json/.md/.zip on a clear project path.
    if (hasBuildSegment(segments)) return true;

    // Lockfiles/manifests by exact basename.
    if (LOCKFILE_BASENAMES.has(lowerBase)) return true;

    // Unambiguous source-code extensions.
    if (SOURCE_EXTENSIONS.has(ext)) return true;

    // Ambiguous .json/.md/.zip/.yaml/.toml OUTSIDE a project/build path
    // stay eligible (media-adjacent metadata, notes, exports).
    if (AMBIGUOUS_EXTENSIONS.has(ext)) return false;

    return false;
}

/**
 * Queue-aware staging decision for one candidate row.
 *
 * @param {string} path canonical inventory path (`/...`).
 * @param {number} size file size in bytes.
 * @param {{minSize:number,maxSize:number}} queue one of SIZE_QUEUES (or custom bounds).
 * @returns {boolean} true when the row may be staged/uploaded.
 */
export function shouldStageDevelopmentPath(path, size, queue) {
    assertCanonicalPath(path);
    if (!Number.isFinite(size)) throw new Error('size must be a finite number');
    const bounds = queue ?? SIZE_QUEUES.small;
    if (size < bounds.minSize || size > bounds.maxSize) return false;
    return !isExcludedDevelopmentArtifact(path);
}

/**
 * Pure staging filter preserving input order.
 *
 * @param {Array} rows inventory rows; path taken via `pathOf`.
 * @param {{minSize:number,maxSize:number}} queue size-queue bounds.
 * @param {(row:any)=>string} pathOf path accessor (default: row[0]).
 * @param {(row:any)=>number} sizeOf size accessor (default: row[1]).
 */
export function filterStagingRows(rows, queue, pathOf = (row) => row[0], sizeOf = (row) => row[1]) {
    if (!Array.isArray(rows)) throw new Error('rows must be an array');
    return rows.filter((row) => shouldStageDevelopmentPath(pathOf(row), Number(sizeOf(row)), queue));
}
