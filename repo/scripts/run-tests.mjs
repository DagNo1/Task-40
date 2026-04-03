import { spawn } from "node:child_process";

const commands = [
  { label: "Backend Unit Tests", args: ["run", "test", "--workspace", "backend"] },
  { label: "Backend API Tests", args: ["run", "test:e2e", "--workspace", "backend"] },
  { label: "Frontend Tests", args: ["run", "test", "--workspace", "frontend"] }
];

function runNpm(args, label) {
  return new Promise((resolve) => {
    const proc = spawn("npm", args, { stdio: "inherit", shell: true });
    proc.on("close", (code) => {
      resolve({ label, code: code ?? 1 });
    });
  });
}

const results = [];
for (const command of commands) {
  console.log(`\n=== ${command.label} ===`);
  const result = await runNpm(command.args, command.label);
  results.push(result);
}

console.log("\n=== SentinelDesk Test Summary ===");
for (const result of results) {
  const status = result.code === 0 ? "PASS" : "FAIL";
  console.log(`${status} - ${result.label}`);
}

if (results.some((result) => result.code !== 0)) {
  console.log("\nOverall: FAIL");
  process.exit(1);
}

console.log("\nOverall: PASS");
