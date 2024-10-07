#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync as execSyncDefault } from "child_process";
import { fileURLToPath } from "url";

// Name of the configuration file containing module configurations
const CONFIG_FILE = ".git-setup-submodules";

export default function setupSubmodules(execSync = execSyncDefault) {
  // Check if .gitmodules exists
  if (fs.existsSync(".gitmodules")) {
    console.log(".gitmodules already initialized");
    process.exit(0);
  }

  // Read module configurations from the configuration file
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`Configuration file '${CONFIG_FILE}' not found.`);
    process.exit(1);
  }

  const modulesContent = fs.readFileSync(CONFIG_FILE, "utf8");
  const lines = modulesContent.split(/\r?\n/);

  // Get remote URL to support either HTTPS or SSH
  let remoteUrl;
  try {
    remoteUrl = execSync("git config --get remote.origin.url", {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    console.error("Failed to get remote origin URL. Is this a git repository?");
    process.exit(1);
  }

  // Remove the last component of the URL to get the base URL
  const remoteUrlBase = remoteUrl.replace(/[^/]*$/, "");

  let submodulesAdded = false; // Flag to check if any submodules were added

  console.log("Starting...");
  console.log("│");
  lines.forEach((line) => {
    line = line.trim();
    // Skip empty lines or lines starting with '#' or '//'
    if (!line || line.startsWith("#") || line.startsWith("//")) {
      return;
    }

    // Remove inline comments starting with '//'
    const commentIndex = line.indexOf("//");
    if (commentIndex !== -1) {
      line = line.substring(0, commentIndex).trim();
    }

    // Parse for branch/tag
    let [moduleStr, branchOrTag] = line.split("#");
    moduleStr = moduleStr.trim();
    if (branchOrTag) {
      branchOrTag = branchOrTag.trim();
    }

    // Parse for local folder name
    let [modulePath, localFolderName] = moduleStr.split(":");
    modulePath = modulePath.trim();
    if (localFolderName) {
      localFolderName = localFolderName.trim();
    }

    // Extract module name and destination path
    const pathParts = modulePath.split("/");
    const moduleName = pathParts[pathParts.length - 1];
    const destinationPath = pathParts.slice(0, -1).join("/");

    // Default local folder name to module name if not specified
    if (!localFolderName) {
      localFolderName = moduleName;
    }

    // The local folder where the submodule will be placed
    const submodulePath = path.join(destinationPath, localFolderName);

    // Default branch or tag
    if (!branchOrTag) {
      branchOrTag = "main";
    }

    // Log details about the module being set up
    console.log(
      `├── Setting up '${moduleName}' module at '${submodulePath}' on branch/tag '${branchOrTag}'...`
    );

    // Set the project git URL
    const projectUrl = `${remoteUrlBase}${moduleName}.git`;

    // Check if we have access to the module
    try {
      execSync(`git ls-remote "${projectUrl}"`, { stdio: "ignore" });
      console.log(`│   └── ✅ You have access to '${moduleName}'`);

      // Create the .gitmodules file if it doesn't exist
      if (!fs.existsSync(".gitmodules")) {
        fs.writeFileSync(".gitmodules", "");
      }

      // Check if .gitmodules is writable
      try {
        fs.accessSync(".gitmodules", fs.constants.W_OK);
      } catch (err) {
        console.error("│   └── ❌ Cannot write to .gitmodules");
        process.exit(1);
      }

      // Prevent duplicate entries
      try {
        execSync(
          `git config -f .gitmodules --unset-all "submodule.${submodulePath}.branch"`,
          {
            stdio: "ignore",
          }
        );
      } catch (err) {
        // Ignore if the config doesn't exist
      }

      // Add the submodule
      execSync(`git submodule add --force "${projectUrl}" "${submodulePath}"`, {
        stdio: "inherit",
      });

      // Set the branch
      execSync(
        `git config -f .gitmodules --add "submodule.${submodulePath}.branch" ${branchOrTag}`,
        { stdio: "inherit" }
      );

      // Update to the latest code in that submodule
      execSync(`git -C "${submodulePath}" pull origin ${branchOrTag}`, {
        stdio: "inherit",
      });

      // Unstage the submodule addition
      execSync(`git restore --staged "${submodulePath}"`, { stdio: "inherit" });

      submodulesAdded = true; // At least one submodule was added
    } catch (err) {
      console.error(
        `│   └── ❌ You don't have access to '${moduleName}' module.`
      );
      // Continue to next module
    } finally {
      console.log("│");
    }
  });

  // Unstage .gitmodules if it exists and at least one submodule was added
  if (submodulesAdded && fs.existsSync(".gitmodules")) {
    execSync("git restore --staged .gitmodules", { stdio: "inherit" });
  }

  console.log("🏁 Submodules setup completed successfully.");
}

// Execute the function when the script is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupSubmodules();
}
