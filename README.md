# Git Submodule Setup

[![npm version](https://img.shields.io/npm/v/git-setup-submodules.svg)](https://www.npmjs.com/package/git-setup-submodules)
[![License](https://img.shields.io/npm/l/git-setup-submodules.svg)](https://github.com/leogme/git-setup-submodules/blob/main/LICENSE)

A CLI tool to automate Git submodule setup from a configuration file.

## Quick Start

```bash
# Create a config file
echo "libs/shared-utils" > .git-setup-submodules

# Run the setup
npx git-setup-submodules
```

## Overview

This tool automates the setup of Git submodules in your project based on a configuration file. It reads the configuration, checks access to the specified repositories, adds them as submodules at specified paths, and sets them to specific branches or tags.

## Features

- **Automated Submodule Setup**: Quickly add multiple submodules without manual configuration.
- **Customizable Paths and Branches**: Specify custom local paths and branches or tags for each submodule.
- **Access Verification**: Checks if you have access to the submodule repositories before adding them.
- **Clean Working Directory**: Unstages submodule changes to keep your working directory clean.
- **Dry Run Mode**: Preview what changes would be made without executing them.
- **Custom Config File**: Use a different configuration file with `--config`.
- **Input Validation**: Validates configuration and provides clear error messages.

## Requirements

- **Node.js**: Version 16.0.0 or higher
- **Git**: Version 2.23.0 or higher (required for `git restore --staged`)
- **npm**: Node Package Manager (usually installed with Node.js)

## Installation

You can use the script as a local dependency in your project or run it directly using `npx`.

### Option 1: Install as a Local Dependency

1. **Navigate to Your Project Directory**

   ```bash
   cd /path/to/your/project
   ```

2. **Install the Package**

   ```bash
   npm install git-setup-submodules --save-dev
   ```

### Option 2: Run Directly with `npx`

You can run the script without installing it by using `npx`:

```bash
npx git-setup-submodules
```

## CLI Options

```
git-setup-submodules [OPTIONS]

OPTIONS:
  -h, --help              Show help message
  -n, --dry-run           Preview changes without executing git commands
  -q, --quiet             Suppress non-essential output
  -c, --config <path>     Path to config file (default: .git-setup-submodules)
  -b, --default-branch <name>
                          Default branch when not specified (default: main)
```

### Examples

```bash
# Standard usage
git-setup-submodules

# Preview what would happen
git-setup-submodules --dry-run

# Use a custom config file
git-setup-submodules --config ./submodules.conf

# Use 'master' as the default branch
git-setup-submodules --default-branch master

# Quiet mode (only show errors)
git-setup-submodules --quiet
```

## Configuration

Create a configuration file named `.git-setup-submodules` in the root directory of your project. This file lists the submodules to be added along with their configurations.

### Configuration File Format

Each line in the configuration file represents a submodule and follows this format:

```
<remote-path>[:<local-path>][#<branch-or-tag>]
```

- **`<remote-path>`**: Path to the submodule repository relative to your Git remote URL base.
- **`<local-path>`** (optional): Custom local directory name for the submodule. Defaults to the module name if omitted.
- **`<branch-or-tag>`** (optional): Branch or tag to check out. Defaults to `main` if omitted.

### Examples

- **Basic Submodule**

  ```
  libs/utils
  ```

  - Clones `utils` from `libs/utils` into `libs/utils`, checking out the `main` branch.

- **Custom Local Path**

  ```
  apps/website:site
  ```

  - Clones `website` from `apps/website` into `apps/site`, checking out the `main` branch.

- **Specific Branch**

  ```
  libs/logger#v1.2.3
  ```

  - Clones `logger` from `libs/logger` into `libs/logger`, checking out the `v1.2.3` branch or tag.

- **Custom Path and Branch**

  ```
  apps/website:site#production
  ```

  - Clones `website` from `apps/website` into `apps/site`, checking out the `production` branch.

### Comments and Blank Lines

- Lines starting with `#` or `//` are treated as comments.
- Blank lines are ignored.
- Inline comments with `//` are supported.

### Sample Configuration File

```plaintext
# Submodules Configuration

# Add the utils library
libs/utils

# Add the website app to 'site' directory on 'production' branch
apps/website:site#production

# Add the logger library at tag 'v1.2.3'
libs/logger#v1.2.3

// Add the helpers library to 'helpersLib' directory
libs/helpers:helpersLib

// Add the console app
apps/console
```

## Usage

### Running the Script

#### If Installed Locally

If you've installed the script as a local dependency, you can run it using `npx`:

```bash
npx git-setup-submodules
```

Alternatively, you can add a script to your `package.json`:

```json
{
  "scripts": {
    "setup-submodules": "git-setup-submodules"
  }
}
```

Then run:

```bash
npm run setup-submodules
```

#### Using `npx` Directly

If you haven't installed the script locally, you can run it directly with `npx`:

```bash
npx git-setup-submodules
```

### Script Workflow

1. **Check for Existing `.gitmodules`**

   - If `.gitmodules` exists, the script assumes submodules are already initialized and exits.

2. **Read Configuration File**

   - Parses `.git-setup-submodules` for submodule definitions.

3. **Determine Remote URL Base**

   - Retrieves the Git remote origin URL to construct full submodule URLs.

4. **Process Each Submodule**

   For each submodule in the configuration:

   - **Access Verification**
     - Uses `git ls-remote` to check if you have access to the repository.
   - **Add Submodule**
     - Executes `git submodule add --force` to add the submodule.
   - **Set Branch or Tag**
     - Configures the submodule to track the specified branch or tag.
   - **Update Submodule**
     - Pulls the latest changes with `git pull`.
   - **Unstage Changes**
     - Runs `git restore --staged` to unstage the submodule and `.gitmodules`.

5. **Summary Output**

   - Displays a summary with counts of successful and failed submodule additions.

## Troubleshooting

### Common Issues

#### "Configuration file not found"

Make sure the `.git-setup-submodules` file exists in your project root, or specify a custom path with `--config`:

```bash
git-setup-submodules --config path/to/config
```

#### "Failed to get remote origin URL"

This error occurs when:
- You're not in a git repository. Run `git init` first.
- The repository has no remote. Add one with `git remote add origin <url>`.

#### "Access denied" errors

Check that:
- Your SSH keys are properly configured (`ssh -T git@github.com`)
- You have read access to the repository
- The repository exists at the expected URL

#### ".gitmodules already exists"

The script won't run if submodules are already configured. If you want to reconfigure:

```bash
# Remove existing submodules first
rm .gitmodules
rm -rf .git/modules/*
git config --remove-section submodule.<path>  # for each submodule
```

#### "git restore" command not found

The `git restore` command requires Git 2.23.0 or later. Update Git:

```bash
# macOS
brew upgrade git

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install git

# Check version
git --version
```

#### Invalid characters in path

Module paths cannot contain shell metacharacters like `;`, `|`, `$`, etc. Use only alphanumeric characters, `/`, `-`, `_`, and `.`.

### Debug Mode

Use `--dry-run` to preview what commands would be executed without making changes:

```bash
git-setup-submodules --dry-run
```

## Error Handling

- **Missing Configuration File**

  - The script exits with an error if `.git-setup-submodules` is not found.

- **Git Repository Not Found**

  - If the script cannot retrieve the remote origin URL, it exits with an error, indicating you may not be in a Git repository.

- **Access Denied to Submodule**

  - If access to a submodule repository is denied, the script logs an error and continues with the next submodule.

- **Invalid Configuration Lines**

  - Lines with invalid syntax or dangerous characters are skipped with an error message.

## Logging

- **Progress Messages**

  - The script logs the setup process for each submodule, including paths and branches.

- **Access Notifications**

  - Informs you whether you have access to each submodule.

- **Final Status**

  - Displays a summary message upon completion with success/failure counts.

## Contributing

1. **Fork the Repository**

   - Create a fork to contribute changes.

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Run Tests**

   ```bash
   npm test
   ```

4. **Commit Your Changes**

   ```bash
   git commit -m "Add your feature"
   ```

5. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request**

   - Submit a pull request to the main repository for review.

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Releasing

This project uses [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for versioning and changelog generation. Releases follow [Conventional Commits](https://www.conventionalcommits.org/).

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: A new feature (bumps minor version)
- `fix`: A bug fix (bumps patch version)
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Breaking Changes:** Add `BREAKING CHANGE:` in the footer or `!` after the type (e.g., `feat!:`) to trigger a major version bump.

### Release Commands

```bash
# Preview what would happen (dry run)
npm run release:dry

# Create a release (auto-determines version from commits)
npm run release

# Create a specific version bump
npm run release:patch   # 1.0.0 -> 1.0.1
npm run release:minor   # 1.0.0 -> 1.1.0
npm run release:major   # 1.0.0 -> 2.0.0

# First release (if starting fresh)
npm run release:first
```

### Publishing

After running a release command:

```bash
# Push the commit and tag
git push --follow-tags origin main

# The GitHub Action will automatically publish to npm when a tag is pushed
```

## License

This project is licensed under the [Apache 2.0](LICENSE).
