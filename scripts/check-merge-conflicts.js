#!/usr/bin/env node
/* eslint-disable no-console */
const { execSync } = require("node:child_process");

const searchPattern = "<<<<<<<|=======|>>>>>>>";

function run(command) {
  try {
    execSync(command, { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const rgCommand = `rg --pcre2 --glob '!node_modules' --glob '!.next' --glob '!.git' --glob '!coverage' --glob '!dist' --glob '!scripts/check-merge-conflicts.js' --glob '!.husky/*' "${searchPattern}" .`;
const gitGrepCommand = `git grep --line-number --color=never -E "${searchPattern}" -- . ':(exclude)node_modules' ':(exclude).next' ':(exclude)coverage' ':(exclude)dist' ':(exclude)scripts/check-merge-conflicts.js' ':(exclude).husky'`;

const found = (() => {
  if (run(rgCommand)) {
    return true;
  }

  try {
    execSync(gitGrepCommand, { stdio: "pipe" });
    return true;
  } catch (error) {
    if (error.status === 1) {
      return false;
    }
    throw error;
  }
})();

if (found) {
  console.error("ERROR: Git conflict markers found. Please resolve them before committing.");
  process.exit(1);
}

console.log("No merge conflict markers detected.");
