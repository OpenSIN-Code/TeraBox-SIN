#!/usr/bin/env node
import { chmod, copyFile, lstat, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wowRoot = resolve(process.argv[2] || process.env.WOW_MY_ZSH_ROOT || '/Users/jeremy/dev/wow-my-zsh');
const registryPath = join(wowRoot, 'shared', 'mcp', 'servers.json');
const profilesPath = join(wowRoot, 'shared', 'mcp', 'task-profiles.json');
const skillTarget = join(wowRoot, 'shared', 'skills', 'terabox-sin');
const binTarget = join(wowRoot, 'bin');

async function readJson(path) {
    return JSON.parse(await readFile(path, 'utf8'));
}

async function writeJsonAtomic(path, value) {
    const temp = `${path}.terabox-sin-${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
    await rm(path, { force: true });
    await import('node:fs/promises').then(({ rename }) => rename(temp, path));
}

async function replaceSymlink(path, target) {
    try {
        const stat = await lstat(path);
        if (!stat.isSymbolicLink()) throw new Error(`Refusing to replace non-symlink: ${path}`);
        await rm(path);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    await symlink(target, path);
}

async function main() {
    const registry = await readJson(registryPath);
    registry.servers ||= {};
    registry.servers['terabox-sin'] = {
        _note: 'Full TeraBox Storage Cloud integration. Every public method from the installed TeraBox-SIN fork is exposed, including reads, uploads, downloads, sharing and file-management writes.',
        transport: 'local',
        command: ['terabox-sin-mcp'],
        env: {},
        agents: ['claude', 'opencode', 'codex', 'cline', 'jcode', 'mimo'],
        tier: 'core',
        always_on: true,
        capabilities: [
            'cloud-storage', 'terabox', 'file-read', 'file-write', 'file-search',
            'file-upload', 'file-download', 'file-management', 'sharing', 'remote-download',
        ],
        permissions: {
            fs: 'scoped:${HOME}',
            network: 'scoped:terabox.com',
            shell: 'none',
            max_turns_per_session: 100,
        },
    };
    await writeJsonAtomic(registryPath, registry);

    const profiles = await readJson(profilesPath);
    profiles.profiles ||= {};
    profiles.profiles['terabox-storage'] = {
        description: 'Complete TeraBox Storage Cloud access through TeraBox-SIN.',
        capabilities: ['cloud-storage', 'terabox', 'file-read', 'file-write', 'file-upload', 'file-download', 'file-management', 'sharing'],
        preferred_servers: ['terabox-sin'],
        maximum_servers: 1,
    };
    await writeJsonAtomic(profilesPath, profiles);

    await mkdir(skillTarget, { recursive: true });
    await copyFile(join(projectRoot, 'SKILL.md'), join(skillTarget, 'SKILL.md'));
    await copyFile(join(projectRoot, 'docs', 'AGENT-USAGE.md'), join(skillTarget, 'AGENT-USAGE.md'));

    await mkdir(binTarget, { recursive: true });
    await replaceSymlink(join(binTarget, 'terabox-sin'), join(projectRoot, 'bin', 'terabox-sin'));
    await replaceSymlink(join(binTarget, 'terabox-sin-mcp'), join(projectRoot, 'bin', 'terabox-sin-mcp'));
    await chmod(join(projectRoot, 'bin', 'terabox-sin'), 0o755);
    await chmod(join(projectRoot, 'bin', 'terabox-sin-mcp'), 0o755);

    process.stdout.write(`${JSON.stringify({
        installed: true,
        project_root: projectRoot,
        wow_root: wowRoot,
        registry: registryPath,
        profile: 'terabox-storage',
        agents: registry.servers['terabox-sin'].agents,
    }, null, 2)}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
});
