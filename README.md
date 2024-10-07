# Git Submodule Setup

## Overview

This script automates the setup of Git submodules in your project based on a configuration file. It reads the configuration, checks access to the specified repositories, adds them as submodules at specified paths, and sets them to specific branches or tags.

## Features

- **Automated Submodule Setup**: Quickly add multiple submodules without manual configuration.
- **Customizable Paths and Branches**: Specify custom local paths and branches or tags for each submodule.
- **Access Verification**: Checks if you have access to the submodule repositories before adding them.
- **Clean Working Directory**: Unstages submodule changes to keep your working directory clean.

## Prerequisites

- **Git**: Ensure Git is installed and accessible in your system's PATH.
- **Node.js**: This script is written in Node.js and requires Node.js to run.
- **npm**: Node Package Manager, usually installed with Node.js.

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

5. **Final Output**

   - Displays a success message if submodules were added.
   - Displays an error message if no submodules were added.

## Error Handling

- **Missing Configuration File**

  - The script exits with an error if `.git-setup-submodules` is not found.

- **Git Repository Not Found**

  - If the script cannot retrieve the remote origin URL, it exits with an error, indicating you may not be in a Git repository.

- **Access Denied to Submodule**

  - If access to a submodule repository is denied, the script logs an error and continues with the next submodule.

## Logging

- **Progress Messages**

  - The script logs the setup process for each submodule, including paths and branches.

- **Access Notifications**

  - Informs you whether you have access to each submodule.

- **Final Status**

  - Displays a summary message upon completion.

## Contributing

1. **Fork the Repository**

   - Create a fork to contribute changes.

2. **Create a Feature Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Commit Your Changes**

   ```bash
   git commit -m "Add your feature"
   ```

4. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**

   - Submit a pull request to the main repository for review.

## License

This project is licensed under the [Apache 2.0](LICENSE).