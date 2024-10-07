import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

// Create a mock execSync function
const execSync = vi.fn();

// Now import the script to test (after setting up the mocks)
import setupSubmodules from "../index.mjs";

describe("git-setup-submodules script", () => {
  const CONFIG_FILE = ".git-setup-submodules";
  let originalCwd;
  const originalExistsSync = fs.existsSync;
  const originalReadFileSync = fs.readFileSync;

  // Variable to track if .gitmodules exists
  let gitmodulesExists = false;

  // Variable to store config content
  let configContent;

  beforeEach(function () {
    // Clear mocks before each test
    vi.clearAllMocks();

    // Mock process.exit to prevent exiting the test runner
    vi.spyOn(process, "exit").mockImplementation(() => {});

    // Save the original working directory
    originalCwd = process.cwd();

    // Create a temporary directory for testing
    const testDir = path.join(process.cwd(), "temp");
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);

    // Reset gitmodulesExists
    gitmodulesExists = false;

    // Mock 'fs.existsSync' but call the original function when needed
    vi.spyOn(fs, "existsSync").mockImplementation((file) => {
      if (file === ".gitmodules") {
        return gitmodulesExists;
      } else if (file === CONFIG_FILE) {
        return true;
      }
      return originalExistsSync.call(fs, file);
    });

    // Mock 'fs.accessSync' to always pass
    vi.spyOn(fs, "accessSync").mockImplementation(() => {});

    // Mock 'fs.writeFileSync' to prevent actual file writing
    vi.spyOn(fs, "writeFileSync").mockImplementation((file, data) => {
      if (file === ".gitmodules") {
        gitmodulesExists = true; // Simulate that .gitmodules now exists
      }
      // Do nothing else
    });

    // Define the configuration content
    configContent = `
      apps/console
      apps/website:site#production
      libs/utils#develop
      libs/helpers:helpersLib
      libs/logger:loggerLib#v1.2.3
    `;

    // Mock 'fs.readFileSync' to return the configuration content
    vi.spyOn(fs, "readFileSync").mockImplementation((file) => {
      if (file === CONFIG_FILE) {
        return configContent;
      }
      return originalReadFileSync.call(fs, file);
    });

    // Mock 'execSync' for specific commands
    execSync.mockImplementation((command, options) => {
      if (command.includes("git config --get remote.origin.url")) {
        return "git@github.com:user/repo.git";
      } else if (command.startsWith("git ls-remote")) {
        // Simulate having access to the module
        return "";
      } else {
        // Simulate success for all other commands
        return "";
      }
    });
  });

  afterEach(() => {
    // Restore the original working directory
    process.chdir(originalCwd);
    // Restore process.exit
    process.exit.mockRestore();

    // Restore all mocks on fs
    vi.restoreAllMocks();
  });

  it("should process modules as per configuration file", function () {
    // Parse the configuration content
    const lines = configContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(
        (line) => line && !line.startsWith("#") && !line.startsWith("//")
      );

    const modules = lines.map((line) => {
      // Remove inline comments
      const commentIndex = line.indexOf("//");
      if (commentIndex !== -1) {
        line = line.substring(0, commentIndex).trim();
      }

      // Parse for branch/tag
      let [moduleStr, branchOrTag] = line.split("#");
      moduleStr = moduleStr.trim();
      if (branchOrTag) {
        branchOrTag = branchOrTag.trim();
      } else {
        branchOrTag = "main";
      }

      // Parse for local folder name
      let [modulePath, localFolderName] = moduleStr.split(":");
      modulePath = modulePath.trim();
      if (localFolderName) {
        localFolderName = localFolderName.trim();
      } else {
        // Default local folder name to module name
        const pathParts = modulePath.split("/");
        localFolderName = pathParts[pathParts.length - 1];
      }

      // Extract module name and destination path
      const pathParts = modulePath.split("/");
      const moduleName = pathParts[pathParts.length - 1];
      const destinationPath = pathParts.slice(0, -1).join("/");

      // The local folder where the submodule will be placed
      const submodulePath = path.join(destinationPath, localFolderName);

      return {
        moduleName,
        branchOrTag,
        modulePath,
        localFolderName,
        destinationPath,
        submodulePath,
        projectUrl: `git@github.com:user/${moduleName}.git`,
      };
    });

    // Call the function to test with the mocked execSync
    setupSubmodules(execSync);

    // Assert that execSync was called with expected commands
    expect(execSync).toHaveBeenCalledWith(
      "git config --get remote.origin.url",
      { encoding: "utf8" }
    );

    // Check 'git ls-remote' calls
    modules.forEach(({ projectUrl }) => {
      expect(execSync).toHaveBeenCalledWith(`git ls-remote "${projectUrl}"`, {
        stdio: "ignore",
      });
    });

    // Check submodule addition commands
    modules.forEach(({ projectUrl, submodulePath }) => {
      expect(execSync).toHaveBeenCalledWith(
        `git submodule add --force "${projectUrl}" "${submodulePath}"`,
        { stdio: "inherit" }
      );
    });

    // Check branch configuration commands
    modules.forEach(({ submodulePath, branchOrTag }) => {
      expect(execSync).toHaveBeenCalledWith(
        `git config -f .gitmodules --unset-all "submodule.${submodulePath}.branch"`,
        { stdio: "ignore" }
      );
      expect(execSync).toHaveBeenCalledWith(
        `git config -f .gitmodules --add "submodule.${submodulePath}.branch" ${branchOrTag}`,
        { stdio: "inherit" }
      );
    });

    // Check git pull commands
    modules.forEach(({ submodulePath, branchOrTag }) => {
      expect(execSync).toHaveBeenCalledWith(
        `git -C "${submodulePath}" pull origin ${branchOrTag}`,
        { stdio: "inherit" }
      );
    });

    // Check unstaging commands for submodules
    modules.forEach(({ submodulePath }) => {
      expect(execSync).toHaveBeenCalledWith(
        `git restore --staged "${submodulePath}"`,
        { stdio: "inherit" }
      );
    });

    // Check .gitmodules unstaging
    expect(execSync).toHaveBeenCalledWith("git restore --staged .gitmodules", {
      stdio: "inherit",
    });
  });
});
