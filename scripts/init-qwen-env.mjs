import fs from "node:fs";
import path from "node:path";

const repo = process.cwd();
const venv = path.join(repo, ".venv-qwen-voice-design");
const python = process.env.QWEN_PYTHON || path.join(venv, "bin", "python");
const cfg = {
  python,
  renderPy: path.join(repo, "packages", "tts-core", "qwen", "render.py"),
  ckpt: "data/tts/ckpts/output_06052026_120000_12HZ_36L_1.7B.pt",
  language: "Spanish",
};
const out = path.join(repo, "data", "tts", "qwen-env.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
const current = fs.existsSync(out) ? fs.readFileSync(out, "utf8") : "";
const next = JSON.stringify(cfg, null, 2);
if (current !== next) {
  fs.writeFileSync(out, next);
  process.stdout.write(`[init-qwen-env] ${python}\n`);
}
