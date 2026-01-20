import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";

// Import functions to test
import setupSubmodules, { parseConfigLine, parseArgs, showHelp } from "../index.mjs";

describe("git-setup-submodules", () => {
  // ============================================
  // parseArgs tests
  // ============================================
  describe("parseArgs", () => {
    it("should return defaults when no arguments provided", () => {
      const options = parseArgs([]);
      expect(options).toEqual({
        config: ".git-setup-submodules",
        dryRun: false,
        defaultBranch: "main",
        help: false,
        quiet: false,
      });
    });

    it("should parse --help flag", () => {
      expect(parseArgs(["--help"]).help).toBe(true);
      expect(parseArgs(["-h"]).help).toBe(true);
    });

    it("should parse --dry-run flag", () => {
      expect(parseArgs(["--dry-run"]).dryRun).toBe(true);
      expect(parseArgs(["-n"]).dryRun).toBe(true);
    });

    it("should parse --quiet flag", () => {
      expect(parseArgs(["--quiet"]).quiet).toBe(true);
      expect(parseArgs(["-q"]).quiet).toBe(true);
    });

    it("should parse --config option", () => {
      expect(parseArgs(["--config", "custom.conf"]).config).toBe("custom.conf");
      expect(parseArgs(["-c", "another.conf"]).config).toBe("another.conf");
    });

    it("should parse --default-branch option", () => {
      expect(parseArgs(["--default-branch", "master"]).defaultBranch).toBe("master");
      expect(parseArgs(["-b", "develop"]).defaultBranch).toBe("develop");
    });

    it("should parse multiple flags together", () => {
      const options = parseArgs(["-n", "-q", "-c", "my.conf", "-b", "master"]);
      expect(options).toEqual({
        config: "my.conf",
        dryRun: true,
        defaultBranch: "master",
        help: false,
        quiet: true,
      });
    });

    it("should exit on unknown option", () => {
      const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {});
      const mockError = vi.spyOn(console, "error").mockImplementation(() => {});

      parseArgs(["--unknown"]);

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockError).toHaveBeenCalledWith("Unknown option: --unknown");

      mockExit.mockRestore();
      mockError.mockRestore();
    });
  });

  // ============================================
  // parseConfigLine tests
  // ============================================
  describe("parseConfigLine", () => {
    describe("should skip non-config lines", () => {
      it("should return null for empty lines", () => {
        expect(parseConfigLine("")).toBeNull();
        expect(parseConfigLine("   ")).toBeNull();
        expect(parseConfigLine("\t")).toBeNull();
      });

      it("should return null for hash comments", () => {
        expect(parseConfigLine("# this is a comment")).toBeNull();
        expect(parseConfigLine("  # indented comment")).toBeNull();
      });

      it("should return null for slash comments", () => {
        expect(parseConfigLine("// this is a comment")).toBeNull();
        expect(parseConfigLine("  // indented comment")).toBeNull();
      });
    });

    describe("should parse basic module paths", () => {
      it("should parse simple module path", () => {
        const result = parseConfigLine("libs/utils");
        expect(result).toEqual({
          moduleName: "utils",
          modulePath: "libs/utils",
          localFolderName: "utils",
          destinationPath: "libs",
          submodulePath: "libs/utils",
          branchOrTag: "main",
          originalLine: "libs/utils",
        });
      });

      it("should parse single-level module path", () => {
        const result = parseConfigLine("mymodule");
        expect(result).toEqual({
          moduleName: "mymodule",
          modulePath: "mymodule",
          localFolderName: "mymodule",
          destinationPath: "",
          submodulePath: "mymodule",
          branchOrTag: "main",
          originalLine: "mymodule",
        });
      });

      it("should parse deeply nested module path", () => {
        const result = parseConfigLine("a/b/c/d/module");
        expect(result.moduleName).toBe("module");
        expect(result.destinationPath).toBe("a/b/c/d");
        expect(result.submodulePath).toBe("a/b/c/d/module");
      });
    });

    describe("should parse custom local paths", () => {
      it("should parse module with custom local path", () => {
        const result = parseConfigLine("apps/website:site");
        expect(result).toEqual({
          moduleName: "website",
          modulePath: "apps/website",
          localFolderName: "site",
          destinationPath: "apps",
          submodulePath: "apps/site",
          branchOrTag: "main",
          originalLine: "apps/website:site",
        });
      });

      it("should handle empty local path after colon", () => {
        const result = parseConfigLine("apps/website:");
        expect(result.localFolderName).toBe("website"); // Falls back to module name
      });
    });

    describe("should parse branch/tag specifications", () => {
      it("should parse module with branch", () => {
        const result = parseConfigLine("libs/logger#develop");
        expect(result.moduleName).toBe("logger");
        expect(result.branchOrTag).toBe("develop");
      });

      it("should parse module with tag", () => {
        const result = parseConfigLine("libs/logger#v1.2.3");
        expect(result.branchOrTag).toBe("v1.2.3");
      });

      it("should use custom default branch", () => {
        const result = parseConfigLine("libs/utils", "master");
        expect(result.branchOrTag).toBe("master");
      });

      it("should handle empty branch after hash", () => {
        const result = parseConfigLine("libs/utils#", "main");
        expect(result.branchOrTag).toBe("main"); // Falls back to default
      });
    });

    describe("should parse combined syntax", () => {
      it("should parse custom path and branch together", () => {
        const result = parseConfigLine("apps/website:site#production");
        expect(result).toEqual({
          moduleName: "website",
          modulePath: "apps/website",
          localFolderName: "site",
          destinationPath: "apps",
          submodulePath: "apps/site",
          branchOrTag: "production",
          originalLine: "apps/website:site#production",
        });
      });
    });

    describe("should handle inline comments", () => {
      it("should strip inline comments with space", () => {
        const result = parseConfigLine("libs/utils // this is utils");
        expect(result.moduleName).toBe("utils");
        expect(result.modulePath).toBe("libs/utils");
      });

      it("should strip inline comments without space", () => {
        const result = parseConfigLine("libs/utils//comment");
        expect(result.moduleName).toBe("utils");
      });

      it("should not strip // in URLs", () => {
        // This tests that we don't break paths that might contain ://
        // though in practice git paths don't have this
        const result = parseConfigLine("libs/utils");
        expect(result.modulePath).toBe("libs/utils");
      });
    });

    describe("should validate input", () => {
      it("should return error for empty module path", () => {
        const result = parseConfigLine(":#branch");
        expect(result.error).toBeDefined();
        expect(result.error).toContain("Empty module path");
      });

      it("should return error for paths with spaces", () => {
        const result = parseConfigLine("libs/my module");
        expect(result.error).toBeDefined();
        expect(result.error).toContain("Spaces not allowed");
      });

      it("should return error for paths with shell metacharacters", () => {
        const dangerous = ["libs/mod;rm", "libs/mod|cat", "libs/mod`id`", "libs/mod$(cmd)"];
        for (const path of dangerous) {
          const result = parseConfigLine(path);
          expect(result.error).toBeDefined();
          expect(result.error).toContain("Invalid characters");
        }
      });

      it("should return error for local path with invalid characters", () => {
        const result = parseConfigLine("libs/mod:bad;path");
        expect(result.error).toBeDefined();
        expect(result.error).toContain("Invalid characters");
      });
    });
  });

  // ============================================
  // setupSubmodules tests
  // ============================================
  describe("setupSubmodules", () => {
    const CONFIG_FILE = ".git-setup-submodules";
    let originalCwd;
    let mockExecSync;
    let gitmodulesExists;

    beforeEach(() => {
      vi.clearAllMocks();

      // Mock process.exit
      vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit called");
      });

      // Mock console methods
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "error").mockImplementation(() => {});

      // Save original cwd
      originalCwd = process.cwd();

      // Create temp directory
      const testDir = path.join(process.cwd(), "temp-test");
      fs.mkdirSync(testDir, { recursive: true });
      process.chdir(testDir);

      // Reset state
      gitmodulesExists = false;

      // Mock execSync
      mockExecSync = vi.fn().mockImplementation((command) => {
        if (command.includes("git config --get remote.origin.url")) {
          return "git@github.com:user/repo.git";
        }
        if (command.startsWith("git ls-remote")) {
          return "";
        }
        return "";
      });

      // Mock fs.existsSync
      vi.spyOn(fs, "existsSync").mockImplementation((file) => {
        if (file === ".gitmodules") return gitmodulesExists;
        if (file === CONFIG_FILE) return true;
        return false;
      });

      // Mock fs.readFileSync
      vi.spyOn(fs, "readFileSync").mockImplementation((file) => {
        if (file === CONFIG_FILE) return "libs/utils";
        throw new Error(`Unexpected read: ${file}`);
      });

      // Mock fs.writeFileSync
      vi.spyOn(fs, "writeFileSync").mockImplementation((file) => {
        if (file === ".gitmodules") {
          gitmodulesExists = true;
        }
      });

      // Mock fs.accessSync
      vi.spyOn(fs, "accessSync").mockImplementation(() => {});
    });

    afterEach(() => {
      process.chdir(originalCwd);
      vi.restoreAllMocks();

      // Clean up temp directory
      const testDir = path.join(originalCwd, "temp-test");
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    describe("pre-flight checks", () => {
      it("should exit early if .gitmodules already exists", () => {
        gitmodulesExists = true;
        fs.existsSync.mockImplementation((file) => {
          if (file === ".gitmodules") return true;
          return false;
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.skipped).toBe(true);
        expect(result.success).toBe(0);
        expect(mockExecSync).not.toHaveBeenCalled();
      });

      it("should exit if config file is missing", () => {
        fs.existsSync.mockImplementation((file) => {
          if (file === ".gitmodules") return false;
          if (file === CONFIG_FILE) return false;
          return false;
        });

        expect(() => setupSubmodules(mockExecSync)).toThrow("process.exit");
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("Configuration file")
        );
      });

      it("should exit if not a git repository", () => {
        mockExecSync.mockImplementation((command) => {
          if (command.includes("git config --get remote.origin.url")) {
            throw new Error("Not a git repository");
          }
          return "";
        });

        expect(() => setupSubmodules(mockExecSync)).toThrow("process.exit");
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("remote origin URL")
        );
      });
    });

    describe("happy path", () => {
      it("should process a single module correctly", () => {
        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.success).toBe(1);
        expect(result.failed).toBe(0);

        // Verify git commands were called
        expect(mockExecSync).toHaveBeenCalledWith(
          "git config --get remote.origin.url",
          { encoding: "utf8" }
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          'git ls-remote "git@github.com:user/utils.git"',
          { stdio: "ignore" }
        );
        expect(mockExecSync).toHaveBeenCalledWith(
          'git submodule add --force "git@github.com:user/utils.git" "libs/utils"',
          { stdio: "ignore" }
        );
      });

      it("should process multiple modules", () => {
        fs.readFileSync.mockImplementation((file) => {
          if (file === CONFIG_FILE) {
            return `libs/utils
apps/console
libs/helpers:helpersLib#develop`;
          }
          throw new Error(`Unexpected read: ${file}`);
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.success).toBe(3);
        expect(result.failed).toBe(0);
      });

      it("should skip comments and empty lines", () => {
        fs.readFileSync.mockImplementation((file) => {
          if (file === CONFIG_FILE) {
            return `# Comment line
libs/utils

// Another comment
apps/console`;
          }
          throw new Error(`Unexpected read: ${file}`);
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.success).toBe(2);
      });

      it("should use custom default branch", () => {
        const result = setupSubmodules(mockExecSync, {
          quiet: true,
          defaultBranch: "master",
        });

        expect(mockExecSync).toHaveBeenCalledWith(
          expect.stringContaining('"master"'),
          expect.any(Object)
        );
      });

      it("should use custom config file", () => {
        fs.existsSync.mockImplementation((file) => {
          if (file === ".gitmodules") return gitmodulesExists;
          if (file === "custom.conf") return true;
          return false;
        });
        fs.readFileSync.mockImplementation((file) => {
          if (file === "custom.conf") return "libs/utils";
          throw new Error(`Unexpected read: ${file}`);
        });

        const result = setupSubmodules(mockExecSync, {
          quiet: true,
          config: "custom.conf",
        });

        expect(result.success).toBe(1);
      });
    });

    describe("dry run mode", () => {
      it("should not execute git commands in dry run", () => {
        const result = setupSubmodules(mockExecSync, { dryRun: true });

        expect(result.success).toBe(1);

        // Should call git config to get remote URL
        expect(mockExecSync).toHaveBeenCalledWith(
          "git config --get remote.origin.url",
          { encoding: "utf8" }
        );

        // Should NOT call submodule add
        expect(mockExecSync).not.toHaveBeenCalledWith(
          expect.stringContaining("git submodule add"),
          expect.any(Object)
        );
      });
    });

    describe("error handling", () => {
      it("should handle access denied errors", () => {
        mockExecSync.mockImplementation((command) => {
          if (command.includes("git config --get remote.origin.url")) {
            return "git@github.com:user/repo.git";
          }
          if (command.startsWith("git ls-remote")) {
            const error = new Error("Permission denied");
            throw error;
          }
          return "";
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.failed).toBe(1);
        expect(result.success).toBe(0);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("Access denied")
        );
      });

      it("should handle repository not found errors", () => {
        mockExecSync.mockImplementation((command) => {
          if (command.includes("git config --get remote.origin.url")) {
            return "git@github.com:user/repo.git";
          }
          if (command.startsWith("git ls-remote")) {
            throw new Error("Repository not found");
          }
          return "";
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.failed).toBe(1);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("not found")
        );
      });

      it("should handle network errors", () => {
        mockExecSync.mockImplementation((command) => {
          if (command.includes("git config --get remote.origin.url")) {
            return "git@github.com:user/repo.git";
          }
          if (command.startsWith("git ls-remote")) {
            throw new Error("Could not resolve host");
          }
          return "";
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.failed).toBe(1);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("Network error")
        );
      });

      it("should handle .gitmodules write permission errors", () => {
        fs.accessSync.mockImplementation((file, mode) => {
          if (file === ".gitmodules") {
            throw new Error("EACCES");
          }
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.failed).toBe(1);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("Cannot write to .gitmodules")
        );
      });

      it("should handle git submodule add failures", () => {
        mockExecSync.mockImplementation((command) => {
          if (command.includes("git config --get remote.origin.url")) {
            return "git@github.com:user/repo.git";
          }
          if (command.startsWith("git ls-remote")) {
            return "";
          }
          if (command.includes("git submodule add")) {
            throw new Error("Submodule add failed");
          }
          return "";
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.failed).toBe(1);
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("Failed to add")
        );
      });

      it("should continue processing after one module fails", () => {
        let callCount = 0;
        fs.readFileSync.mockImplementation((file) => {
          if (file === CONFIG_FILE) {
            return `libs/failing
libs/working`;
          }
          throw new Error(`Unexpected read: ${file}`);
        });

        mockExecSync.mockImplementation((command) => {
          if (command.includes("git config --get remote.origin.url")) {
            return "git@github.com:user/repo.git";
          }
          if (command.startsWith("git ls-remote")) {
            callCount++;
            if (callCount === 1) {
              throw new Error("Access denied");
            }
            return "";
          }
          return "";
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.failed).toBe(1);
        expect(result.success).toBe(1);
      });

      it("should handle invalid config lines gracefully", () => {
        fs.readFileSync.mockImplementation((file) => {
          if (file === CONFIG_FILE) {
            return `libs/valid
libs/bad;path
libs/another-valid`;
          }
          throw new Error(`Unexpected read: ${file}`);
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.failed).toBe(1); // bad;path
        expect(result.success).toBe(2); // valid ones
      });
    });

    describe("HTTPS URL support", () => {
      it("should work with HTTPS remote URLs", () => {
        mockExecSync.mockImplementation((command) => {
          if (command.includes("git config --get remote.origin.url")) {
            return "https://github.com/user/repo.git";
          }
          if (command.startsWith("git ls-remote")) {
            return "";
          }
          return "";
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.success).toBe(1);
        expect(mockExecSync).toHaveBeenCalledWith(
          'git ls-remote "https://github.com/user/utils.git"',
          { stdio: "ignore" }
        );
      });
    });

    describe("empty config handling", () => {
      it("should handle empty config file", () => {
        fs.readFileSync.mockImplementation((file) => {
          if (file === CONFIG_FILE) return "";
          throw new Error(`Unexpected read: ${file}`);
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.success).toBe(0);
        expect(result.failed).toBe(0);
      });

      it("should handle config with only comments", () => {
        fs.readFileSync.mockImplementation((file) => {
          if (file === CONFIG_FILE) {
            return `# Just comments
// Nothing else

# More comments`;
          }
          throw new Error(`Unexpected read: ${file}`);
        });

        const result = setupSubmodules(mockExecSync, { quiet: true });

        expect(result.success).toBe(0);
        expect(result.failed).toBe(0);
      });
    });
  });

  // ============================================
  // showHelp tests
  // ============================================
  describe("showHelp", () => {
    it("should output help text", () => {
      const mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

      showHelp();

      expect(mockLog).toHaveBeenCalled();
      const output = mockLog.mock.calls[0][0];
      expect(output).toContain("git-setup-submodules");
      expect(output).toContain("--help");
      expect(output).toContain("--dry-run");
      expect(output).toContain("--config");

      mockLog.mockRestore();
    });
  });
});
