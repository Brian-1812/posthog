import { appendFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SyncHookJSONOutput } from "@anthropic-ai/claude-agent-sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { expect, it, vi } from "vitest";
import { MemoryWatchdogKillReader } from "../../server/memory-watchdog";
import {
  getMemoryKillHookTrust,
  MEMORY_KILL_HOOK_TOOL_NAME,
  registerMemoryKillHook,
} from "./memory-kill-hook";

it("trusts only session memory hooks without trusting user hooks", async () => {
  const hook = {
    key: "session:pre_tool_use:0:0",
    currentHash: "memory-pre-hash",
    source: "sessionFlags",
    eventName: "preToolUse",
    matcher: "Bash|Agent",
    handlerType: "mcpTool",
    server: "posthog-code-tools",
    tool: MEMORY_KILL_HOOK_TOOL_NAME,
  };
  const request = vi.fn().mockResolvedValue({
    data: [
      {
        hooks: [
          hook,
          {
            ...hook,
            key: "session:post_tool_use:0:0",
            eventName: "postToolUse",
            currentHash: "memory-post-hash",
          },
          { ...hook, key: "user:pre_tool_use:0:0", source: "user" },
          { ...hook, key: "other-tool", tool: "other_tool" },
          { ...hook, key: "other-server", server: "other-server" },
          { ...hook, key: "other-event", eventName: "stop" },
        ],
      },
    ],
  });
  expect(await getMemoryKillHookTrust({ request }, "/tmp/project")).toEqual({
    "session:pre_tool_use:0:0": { trusted_hash: "memory-pre-hash" },
    "session:post_tool_use:0:0": { trusted_hash: "memory-post-hash" },
  });
});

it("delivers Codex memory feedback and blocks an unchanged command after two stops over MCP", async () => {
  const dir = await mkdtemp(join(tmpdir(), "codex-memory-hook-"));
  const path = join(dir, "events.jsonl");
  const startedAtSeconds = 1_800_000_000;
  const server = new McpServer({ name: "test", version: "1.0.0" });
  const client = new Client({ name: "test", version: "1.0.0" });
  try {
    await writeFile(path, "");
    registerMemoryKillHook(server, {
      reader: new MemoryWatchdogKillReader(path),
      startedAtMs: startedAtSeconds * 1000,
      killRecordWaitMs: 0,
    });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    async function callHook(
      event: "PreToolUse" | "PostToolUse",
      command: string,
      sessionId = "parent",
      toolResponse?: unknown,
    ): Promise<SyncHookJSONOutput> {
      const result = await client.callTool({
        name: MEMORY_KILL_HOOK_TOOL_NAME,
        arguments: {
          session_id: sessionId,
          cwd: "/tmp/project",
          hook_event_name: event,
          tool_name: "Bash",
          tool_input: { command },
          tool_use_id: "exec-1",
          ...(event === "PostToolUse" ? { tool_response: toolResponse } : {}),
        },
      });
      expect(result.isError).not.toBe(true);
      const content = result.content as { type: string; text: string }[];
      return JSON.parse(content[0].text) as SyncHookJSONOutput;
    }

    const command = "npx next build";
    expect(await callHook("PreToolUse", command)).toEqual({ continue: true });
    for (const pid of [7, 8]) {
      await appendFile(
        path,
        `${JSON.stringify({
          event: "kill",
          ts: startedAtSeconds + pid,
          pid,
          comm: "bash",
          tree_rss: 22 * 1024 ** 3,
          current: 27 * 1024 ** 3,
          limit: 32 * 1024 ** 3,
          signal: "SIGKILL",
        })}\n`,
      );
      const output = await callHook(
        "PostToolUse",
        command,
        "parent",
        "Process exited with code 137\nFinal output:\n",
      );
      expect(output.hookSpecificOutput).toMatchObject({
        hookEventName: "PostToolUse",
        additionalContext: expect.stringContaining(`(pid ${pid})`),
      });
    }
    expect(
      (await callHook("PreToolUse", command)).hookSpecificOutput,
    ).toMatchObject({
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
    });
    expect(await callHook("PreToolUse", `${command} --help`)).toEqual({
      continue: true,
    });
    expect(
      (await callHook("PostToolUse", "echo done", "worker", { exit_code: 0 }))
        .hookSpecificOutput,
    ).toMatchObject({ additionalContext: expect.stringContaining("(pid 7)") });
    expect(
      await callHook("PostToolUse", "echo done", "worker", { exit_code: 0 }),
    ).toEqual({ continue: true });
    expect(
      (await callHook("PreToolUse", "pnpm test")).hookSpecificOutput,
    ).toMatchObject({
      hookEventName: "PreToolUse",
      updatedInput: {
        command: expect.stringContaining("flock"),
      },
    });
  } finally {
    await client.close();
    await server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
