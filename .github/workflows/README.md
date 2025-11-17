# GitHub Actions Workflows

## CI Workflow

Runs on every push to `main` and on pull requests:
- Linting
- Tests on Node.js 18.x, 20.x, and 22.x
- Coverage report

## Publish Workflow

Automatically publishes to npm when a new release is created.

### Setup NPM_TOKEN

1. Generate an npm token:
   - Go to https://www.npmjs.com/
   - Login to your account
   - Click on your profile picture → Access Tokens
   - Generate New Token → Classic Token
   - Select "Automation" type
   - Copy the token

2. Add the token to GitHub Secrets:
   - Go to your repository on GitHub
   - Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: paste your npm token
   - Click "Add secret"

### Publishing a new version

1. Update the version in `package.json`:
   ```bash
   npm version patch  # or minor, or major
   ```

2. Push the tag:
   ```bash
   git push --follow-tags
   ```

3. Create a new release on GitHub:
   - Go to Releases → Draft a new release
   - Choose the tag you just pushed
   - Add release notes
   - Click "Publish release"

The package will be automatically published to npm.
