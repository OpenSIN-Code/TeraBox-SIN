import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SIZE_QUEUES,
    filterStagingRows,
    isDevelopmentPath,
    isExcludedDevelopmentArtifact,
    shouldStageDevelopmentPath,
} from '../src/sin/transfer-filter.js';

// --- Narrowing core: media + documents under /Entwicklung stay eligible ---

test('media under /Entwicklung remains eligible', () => {
    for (const path of [
        '/Entwicklung/Fotos/hochzeit.jpg',
        '/Entwicklung/Videos/film.mp4',
        '/Entwicklung/Musik/song.mp3',
        '/ENTWICKLUNG/bild.PNG',
        '/Entwicklung/Scan/dokument.pdf',
    ]) {
        assert.equal(isExcludedDevelopmentArtifact(path), false, path);
    }
});

test('documents under /Entwicklung remain eligible', () => {
    for (const path of [
        '/Entwicklung/Notizen/ideen.docx',
        '/Entwicklung/Tabelle/kosten.xlsx',
        '/Entwicklung/Praesentation/deck.pptx',
        '/Entwicklung/Notizen/todo.txt',
        '/Entwicklung/Export/adressen.csv',
    ]) {
        assert.equal(isExcludedDevelopmentArtifact(path), false, path);
    }
});

// --- Unambiguous source extensions are excluded ---

test('unambiguous source files under /Entwicklung are excluded', () => {
    for (const path of [
        '/Entwicklung/app/main.py',
        '/Entwicklung/web/index.ts',
        '/Entwicklung/web/app.jsx',
        '/Entwicklung/tool/run.sh',
        '/Entwicklung/lib/engine.rs',
        '/Entwicklung/src/Main.java',
    ]) {
        assert.equal(isExcludedDevelopmentArtifact(path), true, path);
    }
});

// --- Dependency/build directories are excluded (any content) ---

test('dependency and build directories under /Entwicklung are excluded', () => {
    for (const path of [
        '/Entwicklung/proj/node_modules/left-pad/index.js',
        '/Entwicklung/proj/node_modules/data.bin',
        '/Entwicklung/proj/.git/objects/ab/cdef',
        '/Entwicklung/proj/__pycache__/mod.pyc',
        '/Entwicklung/proj/dist/bundle.js',
        '/Entwicklung/proj/build/output.bin',
        '/Entwicklung/proj/target/debug/app',
        '/Entwicklung/proj/.venv/lib/python3.12/site-packages/x.py',
        '/Entwicklung/proj/coverage/lcov.info',
    ]) {
        assert.equal(isExcludedDevelopmentArtifact(path), true, path);
    }
});

// Media wins over build directories: "Medien und Dokumente bleiben zulaessig".
test('media inside build directories remains eligible', () => {
    assert.equal(isExcludedDevelopmentArtifact('/Entwicklung/proj/node_modules/logo.png'), false);
    assert.equal(isExcludedDevelopmentArtifact('/Entwicklung/proj/dist/cover.jpg'), false);
});

// --- Lockfiles/manifests excluded by basename ---

test('lockfiles and manifests under /Entwicklung are excluded', () => {
    for (const path of [
        '/Entwicklung/proj/package-lock.json',
        '/Entwicklung/proj/pnpm-lock.yaml',
        '/Entwicklung/proj/yarn.lock',
        '/Entwicklung/proj/poetry.lock',
        '/Entwicklung/proj/Cargo.lock',
    ]) {
        assert.equal(isExcludedDevelopmentArtifact(path), true, path);
    }
});

// --- Ambiguous .json/.md/.zip: only on project/build path ---

test('ambiguous extensions excluded only on clear project/build path', () => {
    assert.equal(isExcludedDevelopmentArtifact('/Entwicklung/proj/node_modules/pkg/package.json'), true);
    assert.equal(isExcludedDevelopmentArtifact('/Entwicklung/proj/dist/README.md'), true);
    assert.equal(isExcludedDevelopmentArtifact('/Entwicklung/proj/build/archive.zip'), true);
    // Same extensions WITHOUT project/build context stay eligible.
    assert.equal(isExcludedDevelopmentArtifact('/Entwicklung/Notizen/readme.md'), false);
    assert.equal(isExcludedDevelopmentArtifact('/Entwicklung/Export/backup.zip'), false);
    assert.equal(isExcludedDevelopmentArtifact('/Entwicklung/Meta/sidecar.json'), false);
});

// --- Outside /Entwicklung: never excluded ---

test('paths outside /Entwicklung are never excluded', () => {
    for (const path of [
        '/Personal/Entwicklung/photo.jpg',
        '/Fotos/app.py',
        '/Archive/node_modules.tar',
        '/Media/package-lock.json',
    ]) {
        assert.equal(isExcludedDevelopmentArtifact(path), false, path);
    }
});

// --- Compat helper documents the old broad rule ---

test('isDevelopmentPath still detects the top-level tree (compat only)', () => {
    assert.equal(isDevelopmentPath('/Entwicklung/private.bin'), true);
    assert.equal(isDevelopmentPath('/entwicklung/private.bin'), true);
    assert.equal(isDevelopmentPath('/Personal/Entwicklung/photo.jpg'), false);
});

// --- Invalid input ---

test('invalid paths throw', () => {
    for (const bad of ['', null, undefined, 17]) {
        assert.throws(() => isExcludedDevelopmentArtifact(bad), /non-empty string/);
    }
});

// --- Both size queues ---

test('small queue: bounds enforced with narrowed filter', () => {
    const q = SIZE_QUEUES.small;
    assert.equal(shouldStageDevelopmentPath('/Entwicklung/Fotos/a.jpg', 10, q), true);
    assert.equal(shouldStageDevelopmentPath('/Entwicklung/app/main.py', 10, q), false);
    assert.equal(shouldStageDevelopmentPath('/Entwicklung/Fotos/a.jpg', 0, q), false);
    assert.equal(shouldStageDevelopmentPath('/Entwicklung/Fotos/a.jpg', q.maxSize, q), true);
    assert.equal(shouldStageDevelopmentPath('/Entwicklung/Fotos/a.jpg', q.maxSize + 1, q), false);
});

test('big queue: bounds enforced with narrowed filter', () => {
    const q = SIZE_QUEUES.big;
    assert.equal(shouldStageDevelopmentPath('/Entwicklung/Filme/film.mp4', q.minSize, q), true);
    assert.equal(shouldStageDevelopmentPath('/Entwicklung/app/main.py', q.minSize, q), false);
    assert.equal(shouldStageDevelopmentPath('/Entwicklung/Filme/film.mp4', q.minSize - 1, q), false);
    assert.equal(shouldStageDevelopmentPath('/Fotos/gross.mp4', q.minSize, q), true);
});

// --- Synthetic mixed /Entwicklung batch across both queues ---

test('synthetic mixed batch: media/docs pass, code/build filtered, per queue', () => {
    const md5 = 'a'.repeat(32);
    const rows = [
        ['/Entwicklung/Fotos/hochzeit.jpg', 5_000_000, md5],
        ['/Entwicklung/Notizen/ideen.docx', 200_000, md5],
        ['/Entwicklung/app/main.py', 5_000, md5],
        ['/Entwicklung/proj/node_modules/left-pad/index.js', 8_000, md5],
        ['/Entwicklung/proj/package-lock.json', 90_000, md5],
        ['/Entwicklung/Notizen/readme.md', 3_000, md5],
        ['/Entwicklung/Export/backup.zip', 40_000_000, md5],
        ['/Entwicklung/Filme/film.mp4', 2_500_000_000, md5],
        ['/Entwicklung/Roh/video.mov', 900_000_000, md5],
        ['/Entwicklung/proj/dist/bundle.js', 300_000_000, md5],
    ];
    const small = new Set(filterStagingRows(rows, SIZE_QUEUES.small).map((row) => row[0]));
    assert.deepEqual(small, new Set([
        '/Entwicklung/Fotos/hochzeit.jpg',
        '/Entwicklung/Notizen/ideen.docx',
        '/Entwicklung/Notizen/readme.md',
        '/Entwicklung/Export/backup.zip',
    ]));
    const big = new Set(filterStagingRows(rows, SIZE_QUEUES.big).map((row) => row[0]));
    assert.deepEqual(big, new Set([
        '/Entwicklung/Filme/film.mp4',
        '/Entwicklung/Roh/video.mov',
    ]));
});

test('filter preserves order and validates rows argument', () => {
    const rows = [
        ['/Entwicklung/b.jpg', 5, 'a'.repeat(32)],
        ['/Entwicklung/a.jpg', 5, 'a'.repeat(32)],
    ];
    assert.deepEqual(
        filterStagingRows(rows, SIZE_QUEUES.small).map((row) => row[0]),
        ['/Entwicklung/b.jpg', '/Entwicklung/a.jpg'],
    );
    assert.throws(() => filterStagingRows(null, SIZE_QUEUES.small), /rows must be an array/);
});
