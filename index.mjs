#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execSync as execSyncDefault } from "child_process";
import { fileURLToPath } from "url";

// Default configuration file name
const DEFAULT_CONFIG_FILE = ".git-setup-submodules";

/**
 * Parse command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {object} Parsed options
 */
export function parseArgs(args) {
  const options = {
    config: DEFAULT_CONFIG_FILE,
    dryRun: false,
    defaultBranch: "main",
    help: false,
    quiet: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--dry-run":
      case "-n":
        options.dryRun = true;
        break;
      case "--quiet":
      case "-q":
        options.quiet = true;
        break;
      case "--config":
      case "-c":
        options.config = args[++i];
        break;
      case "--default-branch":
      case "-b":
        options.defaultBranch = args[++i];
        break;
      default:
        if (arg.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          console.error('Use --help for usage information.');
          process.exit(1);
        }
    }
  }

  return options;
}

/**
 * Display help message
 */
export function showHelp() {
  console.log(`
git-setup-submodules - Automate Git submodule setup from a configuration file

USAGE:
  git-setup-submodules [OPTIONS]
  npx git-setup-submodules [OPTIONS]

OPTIONS:
  -h, --help              Show this help message
  -n, --dry-run           Preview changes without executing git commands
  -q, --quiet             Suppress non-essential output
  -c, --config <path>     Path to config file (default: .git-setup-submodules)
  -b, --default-branch <name>
                          Default branch when not specified (default: main)

CONFIGURATION FILE FORMAT:
  Each line: <remote-path>[:<local-path>][#<branch-or-tag>]

  Examples:
    libs/utils              # Clone 'utils' to libs/utils on default branch
    apps/website:site       # Clone 'website' to apps/site
    libs/logger#v1.2.3      # Clone 'logger' on tag v1.2.3
    apps/api:backend#dev    # Clone 'api' to apps/backend on dev branch

  Lines starting with '#' or '//' are comments.
  Inline comments with '//' are supported.

EXAMPLES:
  git-setup-submodules
  git-setup-submodules --dry-run
  git-setup-submodules --config ./submodules.conf
  git-setup-submodules --default-branch master
`);
}

/**
 * Parse a single configuration line into module information
 * @param {string} line - Raw line from config file
 * @param {string} defaultBranch - Default branch to use if not specified
 * @returns {object|null} Parsed module info or null if line should be skipped
 */
export function parseConfigLine(line, defaultBranch = "main") {
  // Trim whitespace
  line = line.trim();

  // Skip empty lines or full-line comments
  if (!line || line.startsWith("#") || line.startsWith("//")) {
    return null;
  }

  // Remove inline comments (but not inside the path)
  const commentIndex = line.indexOf(" //");
  if (commentIndex !== -1) {
    line = line.substring(0, commentIndex).trim();
  }
  // Also handle // without space at end
  const commentIndex2 = line.indexOf("//");
  if (commentIndex2 !== -1 && !line.substring(0, commentIndex2).includes("://")) {
    line = line.substring(0, commentIndex2).trim();
  }

  // Validate: no empty line after comment removal
  if (!line) {
    return null;
  }

  // Parse for branch/tag (split on first #)
  let branchOrTag = defaultBranch;
  const hashIndex = line.indexOf("#");
  let moduleStr = line;
  if (hashIndex !== -1) {
    moduleStr = line.substring(0, hashIndex).trim();
    branchOrTag = line.substring(hashIndex + 1).trim() || defaultBranch;
  }

  // Parse for local folder name (split on first :)
  let modulePath;
  let localFolderName;
  const colonIndex = moduleStr.indexOf(":");
  if (colonIndex !== -1) {
    modulePath = moduleStr.substring(0, colonIndex).trim();
    localFolderName = moduleStr.substring(colonIndex + 1).trim();
  } else {
    modulePath = moduleStr.trim();
    localFolderName = null;
  }

  // Validate module path
  if (!modulePath) {
    return { error: "Empty module path" };
  }

  // Check for invalid characters (shell metacharacters)
  const invalidChars = /[;&|`$(){}[\]<>\\'"!*?]/;
  if (invalidChars.test(modulePath) || (localFolderName && invalidChars.test(localFolderName))) {
    return { error: `Invalid characters in path: ${line}` };
  }

  // Check for spaces in paths
  if (modulePath.includes(" ") || (localFolderName && localFolderName.includes(" "))) {
    return { error: `Spaces not allowed in paths: ${line}` };
  }

  // Extract module name and destination path
  const pathParts = modulePath.split("/");
  const moduleName = pathParts[pathParts.length - 1];
  const destinationPath = pathParts.slice(0, -1).join("/");

  // Validate module name
  if (!moduleName) {
    return { error: `Invalid module path (no module name): ${line}` };
  }

  // Default local folder name to module name if not specified
  if (!localFolderName) {
    localFolderName = moduleName;
  }

  // The local folder where the submodule will be placed
  const submodulePath = destinationPath
    ? path.join(destinationPath, localFolderName)
    : localFolderName;

  return {
    moduleName,
    modulePath,
    localFolderName,
    destinationPath,
    submodulePath,
    branchOrTag,
    originalLine: line,
  };
}

/**
 * Main function to setup submodules
 * @param {Function} execSync - execSync function (for testing)
 * @param {object} options - CLI options
 * @returns {object} Result with success and failure counts
 */
export default function setupSubmodules(
  execSync = execSyncDefault,
  options = {}
) {
  const {
    config: configFile = DEFAULT_CONFIG_FILE,
    dryRun = false,
    defaultBranch = "main",
    quiet = false,
  } = options;

  const log = quiet ? () => {} : console.log;
  const logError = console.error;

  // Check if .gitmodules exists
  if (fs.existsSync(".gitmodules")) {
    log(".gitmodules already exists - submodules may already be initialized");
    return { success: 0, failed: 0, skipped: true };
  }

  // Read module configurations from the configuration file
  if (!fs.existsSync(configFile)) {
    logError(`Configuration file '${configFile}' not found.`);
    process.exit(1);
  }

  const modulesContent = fs.readFileSync(configFile, "utf8");
  const lines = modulesContent.split(/\r?\n/);

  // Get remote URL to support either HTTPS or SSH
  let remoteUrl;
  try {
    remoteUrl = execSync("git config --get remote.origin.url", {
      encoding: "utf8",
    }).trim();
  } catch (error) {
    logError("Failed to get remote origin URL. Is this a git repository?");
    process.exit(1);
  }

  // Remove the last component of the URL to get the base URL
  const remoteUrlBase = remoteUrl.replace(/[^/]*$/, "");

  let successCount = 0;
  let failedCount = 0;

  if (dryRun) {
    log("DRY RUN MODE - No changes will be made");
    log("│");
  } else {
    log("Setting up submodules...");
    log("│");
  }

  for (const rawLine of lines) {
    const parsed = parseConfigLine(rawLine, defaultBranch);

    // Skip null (empty lines, comments)
    if (parsed === null) {
      continue;
    }

    // Handle parsing errors
    if (parsed.error) {
      logError(`├── ❌ ${parsed.error}`);
      logError("│");
      failedCount++;
      continue;
    }

    const { moduleName, submodulePath, branchOrTag } = parsed;

    // Log details about the module being set up
    log(
      `├── Setting up '${moduleName}' at '${submodulePath}' on branch/tag '${branchOrTag}'...`
    );

    // Set the project git URL
    const projectUrl = `${remoteUrlBase}${moduleName}.git`;

    if (dryRun) {
      log(`│   ├── Would check access to: ${projectUrl}`);
      log(`│   ├── Would add submodule to: ${submodulePath}`);
      log(`│   └── Would set branch: ${branchOrTag}`);
      log("│");
      successCount++;
      continue;
    }

    // Check if we have access to the module
    try {
      execSync(`git ls-remote "${projectUrl}"`, { stdio: "ignore" });
    } catch (err) {
      const errorMsg = err.message || "Unknown error";
      if (errorMsg.includes("Authentication failed") || errorMsg.includes("Permission denied")) {
        logError(`│   └── ❌ Access denied to '${moduleName}' - check your credentials`);
      } else if (errorMsg.includes("not found") || errorMsg.includes("does not exist")) {
        logError(`│   └── ❌ Repository '${moduleName}' not found at ${projectUrl}`);
      } else if (errorMsg.includes("Could not resolve host")) {
        logError(`│   └── ❌ Network error - could not reach ${projectUrl}`);
      } else {
        logError(`│   └── ❌ Failed to access '${moduleName}': ${errorMsg}`);
      }
      log("│");
      failedCount++;
      continue;
    }

    log(`│   ├── ✅ Access verified`);

    try {
      // Create the .gitmodules file if it doesn't exist
      if (!fs.existsSync(".gitmodules")) {
        fs.writeFileSync(".gitmodules", "");
      }

      // Check if .gitmodules is writable
      try {
        fs.accessSync(".gitmodules", fs.constants.W_OK);
      } catch (err) {
        logError("│   └── ❌ Cannot write to .gitmodules - check file permissions");
        log("│");
        failedCount++;
        continue;
      }

      // Prevent duplicate entries - remove existing branch config
      try {
        execSync(
          `git config -f .gitmodules --unset-all "submodule.${submodulePath}.branch"`,
          { stdio: "ignore" }
        );
      } catch (err) {
        // Ignore if the config doesn't exist
      }

      // Add the submodule
      execSync(`git submodule add --force "${projectUrl}" "${submodulePath}"`, {
        stdio: quiet ? "ignore" : "inherit",
      });

      // Set the branch
      execSync(
        `git config -f .gitmodules --add "submodule.${submodulePath}.branch" "${branchOrTag}"`,
        { stdio: quiet ? "ignore" : "inherit" }
      );

      // Update to the latest code in that submodule
      execSync(`git -C "${submodulePath}" pull origin "${branchOrTag}"`, {
        stdio: quiet ? "ignore" : "inherit",
      });

      // Unstage the submodule addition
      try {
        execSync(`git restore --staged "${submodulePath}"`, { stdio: "ignore" });
      } catch (err) {
        // Ignore if not staged or git restore not available
      }

      log(`│   └── ✅ Successfully added '${moduleName}'`);
      successCount++;
    } catch (err) {
      const errorMsg = err.message || "Unknown error";
      logError(`│   └── ❌ Failed to add '${moduleName}': ${errorMsg}`);
      failedCount++;
    }

    log("│");
  }

  // Unstage .gitmodules if it exists and at least one submodule was added
  if (successCount > 0 && fs.existsSync(".gitmodules") && !dryRun) {
    try {
      execSync("git restore --staged .gitmodules", { stdio: "ignore" });
    } catch (err) {
      // Ignore if not staged or git restore not available
    }
  }

  // Summary
  log("└──────────────────────────────────────");
  if (dryRun) {
    log(`🔍 Dry run complete: ${successCount} would be added, ${failedCount} would fail`);
  } else if (successCount > 0 && failedCount === 0) {
    log(`🏁 Setup complete: ${successCount} submodule(s) added successfully`);
  } else if (successCount > 0 && failedCount > 0) {
    log(`⚠️  Setup complete: ${successCount} added, ${failedCount} failed`);
  } else if (failedCount > 0) {
    log(`❌ Setup failed: ${failedCount} submodule(s) could not be added`);
  } else {
    log("ℹ️  No submodules to set up (config file may be empty or all comments)");
  }

  return { success: successCount, failed: failedCount, skipped: false };
}

// Execute the function when the script is run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  const result = setupSubmodules(execSyncDefault, options);

  // Exit with error code if any failures
  if (result.failed > 0) {
    process.exit(1);
  }
}
