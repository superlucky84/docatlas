import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toCodexAgentToml } from './codex.js';
import { hashText, normalizeText, parseFrontmatter } from './text.js';

export const KIT_DIRECTORY = fileURLToPath(new URL('../../agent-kit/', import.meta.url));

const decoder = new TextDecoder('utf-8', { fatal: true });

export class AgentKitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AgentKitError';
  }
}

export function compareVersions(left, right) {
  const a = String(left).split('.').map(Number);
  const b = String(right).split('.').map(Number);
  for (let index = 0; index < 3; index++) {
    if (a[index] !== b[index]) {
      return a[index] - b[index];
    }
  }
  return 0;
}

async function readSource(kitDir, entry) {
  let text;
  try {
    text = decoder.decode(await fs.readFile(path.join(kitDir, ...entry.path.split('/'))));
  } catch (error) {
    throw new AgentKitError('Cannot read agent-kit/' + entry.path + ': ' + error.message);
  }
  if (hashText(text) !== entry.sha256) {
    throw new AgentKitError('agent-kit/' + entry.path + ' does not match agent-kit/manifest.json');
  }
  return normalizeText(text);
}

// Loads the packaged kit and verifies every source against the manifest.
// Full authoring checks live in scripts/agent-kit.js.
export async function loadKit(kitDir = KIT_DIRECTORY) {
  let manifest;
  try {
    manifest = JSON.parse(decoder.decode(await fs.readFile(path.join(kitDir, 'manifest.json'))));
  } catch (error) {
    throw new AgentKitError('Cannot read agent-kit/manifest.json: ' + error.message);
  }
  if (manifest?.schema !== 1 || typeof manifest.kitVersion !== 'string' || !Array.isArray(manifest.items)) {
    throw new AgentKitError('agent-kit/manifest.json has an unsupported format');
  }
  const items = [];
  for (const item of manifest.items) {
    const skill = await readSource(kitDir, item.skill);
    const agent = await readSource(kitDir, item.agent);
    let policy;
    if (item.invocationPolicy) {
      if (item.invocationPolicy.path !== 'skills/' + item.name + '/agents/openai.yaml') {
        throw new AgentKitError('Invalid skill invocation policy path.');
      }
      const text = await readSource(kitDir, item.invocationPolicy);
      if (!/^policy:\n {2}allow_implicit_invocation: (true|false)\s*$/.test(text)) {
        throw new AgentKitError('Invalid skill invocation policy.');
      }
      policy = { text, sha256: hashText(text) };
    }
    let fields;
    let body;
    try {
      ({ fields, body } = parseFrontmatter(agent));
    } catch (error) {
      throw new AgentKitError('agent-kit/' + item.agent.path + ': ' + error.message);
    }
    const codexAgent = toCodexAgentToml({ name: item.name, description: fields.description, body });
    items.push({
      name: item.name,
      version: item.version,
      default: item.default === true,
      requires: Array.isArray(item.requires) ? item.requires.filter(name => typeof name === 'string') : [],
      files: {
        skill: { text: skill, sha256: hashText(skill) },
        agent: { text: agent, sha256: hashText(agent) },
        codexAgent: { text: codexAgent, sha256: hashText(codexAgent) },
        ...(policy ? { policy } : {})
      },
      previous: Array.isArray(item.previous) ? item.previous : []
    });
  }
  return { kitVersion: manifest.kitVersion, items };
}
