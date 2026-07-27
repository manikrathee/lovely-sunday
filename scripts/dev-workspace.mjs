#!/usr/bin/env node
import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const services = [
  {
    name: "astro",
    color: "\u001b[36m",
    args: ["run", "dev:astro", "--", "--host", "127.0.0.1", ...process.argv.slice(2)],
  },
  {
    name: "storybook",
    color: "\u001b[35m",
    args: ["run", "storybook", "--", "--host", "127.0.0.1"],
  },
];
const children = new Set();
let stopping = false;

function prefixOutput(stream, label, color) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      if (line) process.stdout.write(`${color}[${label}]\u001b[0m ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (pending) process.stdout.write(`${color}[${label}]\u001b[0m ${pending}\n`);
  });
}

function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}

for (const service of services) {
  const child = spawn(npmCommand, service.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);
  prefixOutput(child.stdout, service.name, service.color);
  prefixOutput(child.stderr, service.name, service.color);
  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!stopping && code !== 0) {
      console.error(`[dev] ${service.name} stopped (${signal ?? `exit ${code}`}); shutting down workspace.`);
      process.exitCode = code ?? 1;
      stop();
    }
    if (children.size === 0) process.exit(process.exitCode ?? 0);
  });
}

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));
